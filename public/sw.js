/**
 * BSA Phase 27 (slice 3) — Travel Kit offline service worker.
 * Registered by public/trip.js on trip pages only (sites with the Travel Kit).
 *
 * Inert for everything a participant hasn't downloaded (BSA P12): there is
 * no precache, and any request not found in a "vms-trip-*" cache goes to the
 * network untouched. Downloaded trips live in versioned caches
 * "vms-trip-<slug>-<version>" written by trip.js, each with a
 * "/__vms-offline-meta/<slug>" JSON entry holding its accessUntil.
 *
 *  - Navigations: network first (6 s timeout), then the cached page (query
 *    string ignored, so "?hl=fr" language links still match), then a small
 *    "you're offline" page listing the trips saved on this device.
 *  - Everything else (same-origin + cdn.cellpy.com): cache first if it was
 *    downloaded, else network.
 *  - Audio with a Range header is answered from the cached file as a proper
 *    206 Partial Content (BSA P14) so <audio> can seek offline (iOS needs it).
 *  - Caches past their accessUntil are deleted (activate + "gc" message).
 */
const PREFIX = 'vms-trip-';
const META = '/__vms-offline-meta/';

self.addEventListener( 'install', function () { self.skipWaiting(); } );
self.addEventListener( 'activate', function ( e ) {
	e.waitUntil( gc().then( function () { return self.clients.claim(); } ) );
} );
self.addEventListener( 'message', function ( e ) {
	if ( e.data === 'gc' ) e.waitUntil( gc() );
} );

function tripCacheNames() {
	return caches.keys().then( function ( keys ) {
		return keys.filter( function ( k ) { return k.indexOf( PREFIX ) === 0; } );
	} );
}

function gc() {
	return tripCacheNames().then( function ( names ) {
		return Promise.all( names.map( function ( name ) {
			return caches.open( name ).then( function ( c ) {
				return c.keys().then( function ( reqs ) {
					var metaReq = reqs.find( function ( r ) { return new URL( r.url ).pathname.indexOf( META ) === 0; } );
					if ( ! metaReq ) return;
					return c.match( metaReq ).then( function ( r ) { return r && r.json(); } ).then( function ( meta ) {
						if ( meta && meta.accessUntil && Date.now() > Date.parse( meta.accessUntil ) ) return caches.delete( name );
					} );
				} );
			} );
		} ) );
	} ).catch( function () {} );
}

function matchTrip( url, opts ) {
	return tripCacheNames().then( function ( names ) {
		// Newest cache first: names sort by creation order in caches.keys().
		var i = names.length - 1;
		function next() {
			if ( i < 0 ) return undefined;
			return caches.open( names[ i-- ] ).then( function ( c ) { return c.match( url, opts ); } ).then( function ( r ) { return r || next(); } );
		}
		return next();
	} );
}

function rangeResponse( resp, rangeHeader ) {
	return resp.blob().then( function ( blob ) {
		var size = blob.size;
		var m = /^bytes=(\d*)-(\d*)$/.exec( ( rangeHeader || '' ).trim() );
		if ( ! m || ( m[ 1 ] === '' && m[ 2 ] === '' ) ) {
			return new Response( null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } } );
		}
		var start, end;
		if ( m[ 1 ] === '' ) { start = Math.max( 0, size - Number( m[ 2 ] ) ); end = size - 1; }
		else { start = Number( m[ 1 ] ); end = m[ 2 ] === '' ? size - 1 : Math.min( size - 1, Number( m[ 2 ] ) ); }
		if ( start > end || start >= size ) {
			return new Response( null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } } );
		}
		return new Response( blob.slice( start, end + 1 ), {
			status: 206,
			headers: {
				'Content-Type': resp.headers.get( 'Content-Type' ) || blob.type || 'audio/mpeg',
				'Content-Length': String( end - start + 1 ),
				'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
				'Accept-Ranges': 'bytes',
			},
		} );
	} );
}

function timeout( ms ) {
	return new Promise( function ( _, reject ) { setTimeout( function () { reject( new Error( 'timeout' ) ); }, ms ); } );
}

function offlinePage() {
	return tripCacheNames().then( function ( names ) {
		return Promise.all( names.map( function ( n ) {
			return caches.open( n ).then( function ( c ) { return c.keys(); } );
		} ) );
	} ).then( function ( lists ) {
		var seen = {};
		var links = [];
		lists.forEach( function ( reqs ) {
			reqs.forEach( function ( r ) {
				var u = new URL( r.url );
				if ( r.headers && u.pathname.indexOf( META ) !== 0 && /\/trips\/[a-z0-9-]+$/.test( u.pathname ) && ! seen[ u.pathname ] ) {
					seen[ u.pathname ] = true;
					links.push( '<li><a href="' + u.pathname + '">' + u.pathname + '</a></li>' );
				}
			} );
		} );
		var html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
			'<title>Offline</title><style>body{font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;line-height:1.5;color:#222}' +
			'a{color:#1d5fd1}button{margin-top:12px;padding:10px 18px;border-radius:999px;border:1px solid #ccc;background:#fff;font:inherit}</style>' +
			'<h1>📴</h1><p>You’re offline and this page isn’t saved on this device. ' +
			'Ви офлайн, і цю сторінку не збережено на пристрої.</p>' +
			( links.length ? '<ul>' + links.join( '' ) + '</ul>' : '' ) +
			'<button onclick="history.back()">← Back</button>';
		return new Response( html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } } );
	} );
}

self.addEventListener( 'fetch', function ( e ) {
	var req = e.request;
	if ( req.method !== 'GET' ) return;
	// trip-offline.js fetches the bundle with cache:'reload' — it must get the
	// network's fresh copy, never an older one from a downloaded cache.
	if ( req.cache === 'reload' || req.cache === 'no-store' ) return;
	var url = new URL( req.url );
	if ( url.pathname.indexOf( META ) === 0 ) return;

	if ( req.mode === 'navigate' ) {
		e.respondWith(
			Promise.race( [ fetch( req ), timeout( 6000 ) ] ).catch( function () {
				return matchTrip( url.origin + url.pathname, { ignoreSearch: true } ).then( function ( r ) { return r || offlinePage(); } );
			} )
		);
		return;
	}

	if ( url.origin !== self.location.origin && url.hostname !== 'cdn.cellpy.com' ) return;

	e.respondWith(
		matchTrip( req.url ).then( function ( cached ) {
			if ( ! cached ) return fetch( req );
			var range = req.headers.get( 'range' );
			if ( range && url.pathname === '/api/trips/audio' ) return rangeResponse( cached, range );
			return cached;
		} ).catch( function () { return fetch( req ); } )
	);
} );
