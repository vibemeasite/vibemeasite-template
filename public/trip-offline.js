/**
 * BSA Phase 27 (slice 3) — offline trip mode, participant version of a trip
 * page only (components/TripPage.tsx loads it). US-VMAS-TRAVEL-13/14/15.
 *
 * Saves everything needed to use the trip without internet into a versioned
 * Cache Storage cache "vms-trip-<slug>-<version>" served by /sw.js:
 *   - the trip page in every site language (participant version, fetched
 *     with this visitor's cookie),
 *   - the scripts, styles and photos those pages use (read from their HTML),
 *   - every audio guide in every language, fetched in 2 MB Range pieces
 *     (a single serverless response is capped at ~4.5 MB) and stored whole.
 * Resumable (files already saved are skipped), four downloads at a time,
 * progress bar. Updates build a NEW version cache, copying unchanged files
 * from the old one, and only then delete it (BSA P15: never half-applied).
 */
( function () {
	if ( window.__vmsTripOfflineInit ) return;
	window.__vmsTripOfflineInit = true;

	var PREFIX = 'vms-trip-';
	var META = '/__vms-offline-meta/';
	var CHUNK = 2 * 1024 * 1024;
	var PARALLEL = 4;

	var root, box, T = {}, slug = '', metaKey = '', manifest = null, busy = false;
	var installEvent = null;

	function t( k, fb ) { return T[ k ] || fb; }
	function load( k ) { try { return JSON.parse( window.localStorage.getItem( k ) || 'null' ); } catch ( e ) { return null; } }
	function save( k, v ) { try { if ( v === null ) window.localStorage.removeItem( k ); else window.localStorage.setItem( k, JSON.stringify( v ) ); } catch ( e ) {} }
	function mb( b ) { return ( b / 1048576 ).toFixed( b > 10485760 ? 0 : 1 ); }
	function esc( s ) { return String( s ).replace( /[&<>"]/g, function ( c ) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ]; } ); }
	function dateText( iso ) {
		try { return new Date( iso ).toLocaleDateString( document.documentElement.lang || undefined, { day: 'numeric', month: 'long', year: 'numeric' } ); } catch ( e ) { return iso.slice( 0, 10 ); }
	}
	function isIos() {
		return /iPad|iPhone|iPod/.test( navigator.userAgent ) || ( navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 );
	}
	function isStandalone() {
		return window.navigator.standalone === true || ( window.matchMedia && window.matchMedia( '(display-mode: standalone)' ).matches );
	}

	// ── Manifest ────────────────────────────────────────────────────────────
	function fetchManifest() {
		return fetch( '/api/trips/offline-manifest?trip=' + encodeURIComponent( slug ), { credentials: 'same-origin', cache: 'reload' } )
			.then( function ( r ) { if ( ! r.ok ) throw new Error( 'manifest ' + r.status ); return r.json(); } );
	}

	// ── Asset discovery from a page's HTML ──────────────────────────────────
	function assetsFrom( html ) {
		var out = {};
		var m, re;
		re = /\/_next\/static\/[A-Za-z0-9_\-\/.~%]+/g;
		while ( ( m = re.exec( html ) ) ) out[ m[ 0 ].replace( /\\$/, '' ) ] = 1;
		re = /(?:src|href)="(\/[^"#?]+\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?))(?:\?[^"]*)?"/g;
		while ( ( m = re.exec( html ) ) ) if ( m[ 1 ].indexOf( '/api/' ) !== 0 && m[ 1 ] !== '/sw.js' ) out[ m[ 1 ] ] = 1;
		re = /https:\/\/cdn\.cellpy\.com\/[^"'()\s<>\\]+/g;
		while ( ( m = re.exec( html ) ) ) out[ m[ 0 ].replace( /&amp;/g, '&' ) ] = 1;
		return Object.keys( out );
	}

	// ── Cache helpers ───────────────────────────────────────────────────────
	function tripCaches() {
		return caches.keys().then( function ( keys ) {
			return keys.filter( function ( k ) { return k.indexOf( PREFIX + slug + '-' ) === 0; } );
		} );
	}
	function copyFromOld( url, cache, current ) {
		return tripCaches().then( function ( names ) {
			var others = names.filter( function ( n ) { return n !== current; } );
			var i = 0;
			function next() {
				if ( i >= others.length ) return false;
				return caches.open( others[ i++ ] ).then( function ( c ) { return c.match( url ); } ).then( function ( r ) {
					if ( ! r ) return next();
					return cache.put( url, r ).then( function () { return true; } );
				} );
			}
			return next();
		} );
	}

	function fetchAudioWhole( url, onBytes ) {
		var parts = [];
		var type = 'audio/mpeg';
		function piece( start ) {
			return fetch( url, { credentials: 'same-origin', cache: 'reload', headers: { Range: 'bytes=' + start + '-' + ( start + CHUNK - 1 ) } } ).then( function ( r ) {
				if ( r.status !== 206 && r.status !== 200 ) throw new Error( 'audio ' + r.status );
				type = r.headers.get( 'Content-Type' ) || type;
				var cr = r.headers.get( 'Content-Range' );
				var total = cr ? Number( cr.split( '/' )[ 1 ] ) : null;
				return r.arrayBuffer().then( function ( buf ) {
					parts.push( buf );
					onBytes( buf.byteLength );
					var got = start + buf.byteLength;
					if ( r.status === 200 || ! total || got >= total ) return;
					return piece( got );
				} );
			} );
		}
		return piece( 0 ).then( function () {
			var blob = new Blob( parts, { type: type } );
			return new Response( blob, { headers: { 'Content-Type': type, 'Content-Length': String( blob.size ), 'Accept-Ranges': 'bytes' } } );
		} );
	}

	// ── Download ────────────────────────────────────────────────────────────
	function download( m ) {
		if ( busy ) return;
		busy = true;
		var cacheName = PREFIX + slug + '-' + m.version;
		var done = 0;
		var total = m.audioBytes + 1500000; // pages + assets, refined as they arrive
		var files = 0, filesTotal = 0;
		renderProgress( 0, total, 0, 0 );

		function bump( n ) { done += n; renderProgress( done, Math.max( total, done ), files, filesTotal ); }

		var cache;
		return ( navigator.storage && navigator.storage.persist ? navigator.storage.persist().catch( function () {} ) : Promise.resolve() )
			.then( function () { return caches.open( cacheName ); } )
			.then( function ( c ) {
				cache = c;
				// 1. Pages (always fresh), collecting their assets.
				var assets = {};
				return Promise.all( m.pages.map( function ( p ) {
					return fetch( p, { credentials: 'same-origin', cache: 'reload' } ).then( function ( r ) {
						if ( ! r.ok ) throw new Error( 'page ' + r.status );
						return r.text();
					} ).then( function ( html ) {
						assetsFrom( html ).forEach( function ( a ) { assets[ a ] = 1; } );
						bump( html.length );
						return cache.put( p, new Response( html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } } ) );
					} );
				} ) ).then( function () { return Object.keys( assets ); } );
			} )
			.then( function ( assets ) {
				var jobs = assets.map( function ( u ) { return { url: u, audio: false } } )
					.concat( m.audio.map( function ( a ) { return { url: a.url, audio: true, bytes: a.bytes }; } ) );
				filesTotal = jobs.length;
				var i = 0;
				function worker() {
					if ( i >= jobs.length ) return Promise.resolve();
					var job = jobs[ i++ ];
					return cache.match( job.url ).then( function ( have ) {
						if ( have ) { files++; bump( job.bytes || 0 ); return; }
						return copyFromOld( job.url, cache, cacheName ).then( function ( copied ) {
							if ( copied ) { files++; bump( job.bytes || 0 ); return; }
							if ( job.audio ) {
								return fetchAudioWhole( job.url, bump ).then( function ( resp ) { files++; return cache.put( job.url, resp ); } );
							}
							var cross = job.url.indexOf( 'https://' ) === 0;
							return fetch( job.url, { mode: cross ? 'cors' : 'same-origin', credentials: cross ? 'omit' : 'same-origin', cache: 'reload' } ).then( function ( r ) {
								if ( ! r.ok ) return; // a missing asset shouldn't sink the whole download
								return r.clone().arrayBuffer().then( function ( b ) { total += b.byteLength; bump( b.byteLength ); files++; return cache.put( job.url, r ); } );
							} );
						} );
					} ).then( worker );
				}
				var pool = [];
				for ( var k = 0; k < PARALLEL; k++ ) pool.push( worker() );
				return Promise.all( pool );
			} )
			.then( function () {
				return cache.put( META + slug, new Response( JSON.stringify( { accessUntil: m.accessUntil, version: m.version } ), { headers: { 'Content-Type': 'application/json' } } ) );
			} )
			.then( function () { return tripCaches(); } )
			.then( function ( names ) {
				return Promise.all( names.filter( function ( n ) { return n !== cacheName; } ).map( function ( n ) { return caches.delete( n ); } ) );
			} )
			.then( function () {
				save( metaKey, { version: m.version, accessUntil: m.accessUntil, bytes: done, at: new Date().toISOString() } );
				document.dispatchEvent( new CustomEvent( 'vms-trip-offline-ready' ) ); // unlocks the wall composer
				if ( navigator.serviceWorker && navigator.serviceWorker.controller ) navigator.serviceWorker.controller.postMessage( 'gc' );
				busy = false;
				render();
			} )
			.catch( function ( err ) {
				busy = false;
				console.error( 'Offline download stopped:', err );
				renderError();
			} );
	}

	function removeCopy() {
		tripCaches().then( function ( names ) { return Promise.all( names.map( function ( n ) { return caches.delete( n ); } ) ); } ).then( function () {
			save( metaKey, null );
			render();
		} );
	}

	// ── UI ──────────────────────────────────────────────────────────────────
	function renderProgress( done, total, files, filesTotal ) {
		var pct = Math.min( 100, Math.round( ( done / Math.max( 1, total ) ) * 100 ) );
		box.innerHTML =
			'<p class="vms-offline__title">' + esc( t( 'offlineSaving', 'Saving the trip…' ) ) + '</p>' +
			'<div class="vms-offline__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
			'<p class="vms-offline__meta">' + pct + '% · ' + mb( done ) + ' / ' + mb( total ) + ' MB' + ( filesTotal ? ' · ' + files + '/' + filesTotal : '' ) + '</p>' +
			'<p class="vms-offline__hint">' + esc( t( 'offlineKeepOpen', 'Keep this page open until it finishes.' ) ) + '</p>';
	}

	function renderError() {
		box.innerHTML =
			'<p class="vms-offline__title">' + esc( t( 'offlinePaused', 'Download paused' ) ) + '</p>' +
			'<p class="vms-offline__hint">' + esc( t( 'offlinePausedHint', 'The connection dropped. Files already saved are kept.' ) ) + '</p>' +
			'<button type="button" class="vms-offline__btn" data-act="resume">' + esc( t( 'offlineResume', 'Continue' ) ) + '</button>';
	}

	function render() {
		if ( busy ) return;
		var meta = load( metaKey );
		var offline = navigator.onLine === false;
		var html = '';
		if ( meta ) {
			html += '<p class="vms-offline__title vms-offline__title--ok">✓ ' + esc( t( 'offlineReady', 'Available offline' ) ) + '</p>' +
				'<p class="vms-offline__meta">' + mb( meta.bytes || 0 ) + ' MB · ' + esc( t( 'offlineUntil', 'until' ) ) + ' ' + esc( dateText( meta.accessUntil ) ) + '</p>';
			if ( offline ) html += '<p class="vms-offline__chip">📴 ' + esc( t( 'offlineNow', 'You are offline — using the saved copy.' ) ) + '</p>';
			if ( manifest && manifest.version !== meta.version && ! offline ) {
				html += '<button type="button" class="vms-offline__btn" data-act="update">' + esc( t( 'offlineUpdate', 'Update the saved trip' ) ) + '</button>';
			}
			if ( isIos() && ! isStandalone() ) html += '<p class="vms-offline__hint">' + esc( t( 'offlineIosHint', 'On iPhone: tap Share → Add to Home Screen, and open the trip from there.' ) ) + '</p>';
			if ( installEvent ) html += '<button type="button" class="vms-offline__btn vms-offline__btn--ghost" data-act="install">' + esc( t( 'offlineInstall', 'Install as an app' ) ) + '</button>';
			html += '<button type="button" class="vms-offline__link" data-act="remove">' + esc( t( 'offlineRemove', 'Remove offline copy' ) ) + '</button>';
		} else if ( offline ) {
			html += '<p class="vms-offline__chip">📴 ' + esc( t( 'offlineNeedNet', 'Connect to the internet to save this trip for offline use.' ) ) + '</p>';
		} else {
			var size = manifest ? ' (≈' + mb( manifest.audioBytes + 1500000 ) + ' MB)' : '';
			html += '<p class="vms-offline__title">' + esc( t( 'offlineTitle', 'Save the trip on this phone' ) ) + '</p>' +
				'<p class="vms-offline__hint">' + esc( t( 'offlineIntro', 'Download once on Wi-Fi: the map, the stories and every audio guide will work without internet.' ) ) + '</p>' +
				'<button type="button" class="vms-offline__btn" data-act="download"' + ( manifest ? '' : ' disabled' ) + '>' + esc( t( 'offlineDownload', 'Download' ) ) + esc( size ) + '</button>';
		}
		box.innerHTML = html;
	}

	function onClick( e ) {
		var b = e.target && e.target.closest ? e.target.closest( '[data-act]' ) : null;
		if ( ! b || ! box.contains( b ) ) return;
		var act = b.getAttribute( 'data-act' );
		if ( act === 'remove' ) { if ( window.confirm( t( 'offlineRemoveConfirm', 'Remove the offline copy from this phone?' ) ) ) removeCopy(); return; }
		if ( act === 'install' && installEvent ) { installEvent.prompt(); installEvent = null; render(); return; }
		if ( act === 'download' || act === 'update' || act === 'resume' ) {
			( manifest ? Promise.resolve( manifest ) : fetchManifest().then( function ( m ) { manifest = m; return m; } ) )
				.then( function ( m ) {
					if ( ! navigator.storage || ! navigator.storage.estimate ) return m;
					return navigator.storage.estimate().then( function ( est ) {
						var free = ( est.quota || 0 ) - ( est.usage || 0 );
						if ( est.quota && free < ( m.audioBytes + 1500000 ) * 1.2 && ! window.confirm( t( 'offlineLowSpace', 'This phone may not have enough free space. Try anyway?' ) ) ) return null;
						return m;
					} );
				} )
				.then( function ( m ) { if ( m ) download( m ); } )
				.catch( function () { renderError(); } );
		}
	}

	function init() {
		root = document.querySelector( '.vms-trip[data-mode="participant"]' );
		box = root && root.querySelector( '.vms-offline' );
		if ( ! root || ! box ) return;
		if ( ! ( 'serviceWorker' in navigator ) || ! ( 'caches' in window ) ) {
			box.hidden = false;
			box.innerHTML = '<p class="vms-offline__hint">' + esc( t( 'offlineUnsupported', 'This browser can’t save the trip for offline use.' ) ) + '</p>';
			return;
		}
		try { T = JSON.parse( root.getAttribute( 'data-i18n' ) || '{}' ); } catch ( e ) { T = {}; }
		slug = root.getAttribute( 'data-trip' ) || '';
		metaKey = 'vms-offline:' + location.host + ':' + slug;
		box.hidden = false;
		box.addEventListener( 'click', onClick );
		navigator.serviceWorker.register( '/sw.js' ).catch( function ( err ) { console.error( 'sw register failed', err ); } );
		window.addEventListener( 'beforeinstallprompt', function ( e ) { e.preventDefault(); installEvent = e; render(); } );
		window.addEventListener( 'online', function () { refresh(); } );
		window.addEventListener( 'offline', render );
		render();
		refresh();
	}

	function refresh() {
		if ( navigator.onLine === false ) return render();
		fetchManifest().then( function ( m ) { manifest = m; render(); } ).catch( function () { render(); } );
	}

	// Start only after load: React hydrates this server-rendered page, and DOM
	// changes made before it finishes trigger a hydration mismatch (#418) that
	// makes React re-render the page and wipe them.
	function whenSettled( fn ) {
		if ( document.readyState === 'complete' ) setTimeout( fn, 60 );
		else window.addEventListener( 'load', function () { setTimeout( fn, 60 ); } );
	}
	whenSettled( init );
} )();
