/**
 * BSA Phase 27 (slice 5, US-VMAS-TRAVEL-16) — the trip wall. Loaded by
 * components/TripPage.tsx whenever the wall is shown.
 *
 * Everyone: stop filter chips over the server-rendered posts.
 *
 * Participant version only:
 *   - Composer, once this phone holds the downloaded trip (P26) and while the
 *     trip's access window is open: text (≤ 2,000), 1–10 photos with optional
 *     captions, an optional stop (revealed stops only).
 *   - Photos are resized here (long edge 2048 px, JPEG ~80%). Re-encoding
 *     through a canvas drops EXIF, GPS included.
 *   - Offline-first: a post goes to an IndexedDB outbox first, shows as
 *     "Waiting to upload", and is sent when online (page open, `online`
 *     event, return to the tab, every 30 s while anything waits). Each photo
 *     is uploaded on its own (the platform caps a request at ~4.5 MB), then
 *     the post. The client post id makes retries safe. Background Sync isn't
 *     used: the service worker only serves the offline copy.
 *   - Edit / delete your own posts (online only).
 */
( function () {
	if ( window.__vmsTripWallInit ) return;
	window.__vmsTripWallInit = true;

	var MAX_PHOTOS = 10;
	var MAX_TEXT = 2000;
	var LONG_EDGE = 2048;
	var MAX_BYTES = 4 * 1024 * 1024;
	var RETRY_MS = 30000;

	var root, wall, box, T = {}, slug = '', stops = [], items = [], flushing = false, retryTimer = null, signedOut = false;

	function t( k, fb ) { return T[ k ] || fb; }
	function esc( s ) {
		return String( s ).replace( /[&<>"]/g, function ( c ) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ]; } );
	}
	function textHtml( s ) { return esc( s ).replace( /\n/g, '<br>' ); }
	function toast( msg ) {
		if ( window.__vmsTrip && window.__vmsTrip.toast ) window.__vmsTrip.toast( msg );
		else window.alert( msg );
	}
	function newId() {
		var a = new Uint8Array( 16 );
		( window.crypto || window.msCrypto ).getRandomValues( a );
		return Array.prototype.map.call( a, function ( b ) { return ( '0' + b.toString( 16 ) ).slice( -2 ); } ).join( '' );
	}

	// ── Stop filter (everyone) ──────────────────────────────────────────────
	function bindFilter() {
		wall.addEventListener( 'click', function ( e ) {
			var chip = e.target.closest ? e.target.closest( '.vms-wall__chip' ) : null;
			if ( ! chip ) return;
			var f = chip.getAttribute( 'data-filter' );
			wall.querySelectorAll( '.vms-wall__chip' ).forEach( function ( c ) { c.classList.toggle( 'is-current', c === chip ); } );
			wall.querySelectorAll( '.vms-wall__day' ).forEach( function ( day ) {
				var any = false;
				day.querySelectorAll( '.vms-post' ).forEach( function ( p ) {
					var show = ! f || p.getAttribute( 'data-stop' ) === f;
					p.hidden = ! show;
					any = any || show;
				} );
				day.hidden = ! any;
			} );
		} );
	}

	// ── IndexedDB outbox ────────────────────────────────────────────────────
	var dbp = null;
	function idb() {
		if ( dbp ) return dbp;
		dbp = new Promise( function ( resolve, reject ) {
			if ( ! window.indexedDB ) return reject( new Error( 'no indexedDB' ) );
			var req = indexedDB.open( 'vms-trip-wall', 1 );
			req.onupgradeneeded = function () { req.result.createObjectStore( 'outbox', { keyPath: 'cid' } ); };
			req.onsuccess = function () { resolve( req.result ); };
			req.onerror = function () { reject( req.error ); };
		} );
		return dbp;
	}
	function tx( mode, fn ) {
		return idb().then( function ( db ) {
			return new Promise( function ( resolve, reject ) {
				var x = db.transaction( 'outbox', mode );
				var out = fn( x.objectStore( 'outbox' ) );
				x.oncomplete = function () { resolve( out && out.result !== undefined ? out.result : out ); };
				x.onerror = function () { reject( x.error ); };
			} );
		} );
	}
	function loadOutbox() {
		return tx( 'readonly', function ( st ) { return st.getAll(); } ).then( function ( all ) {
			return ( all || [] ).filter( function ( it ) { return it.host === location.host && it.trip === slug; } )
				.sort( function ( a, b ) { return a.createdAt < b.createdAt ? -1 : 1; } );
		} );
	}
	// Storage failures never block posting: without IndexedDB (private mode etc.)
	// the outbox just lives as long as the page.
	function putItem( it ) { return tx( 'readwrite', function ( st ) { st.put( it ); } ).catch( function () {} ); }
	function dropItem( cid ) { return tx( 'readwrite', function ( st ) { st.delete( cid ); } ).catch( function () {} ); }

	// ── Photos ──────────────────────────────────────────────────────────────
	function decode( file ) {
		if ( window.createImageBitmap ) {
			return createImageBitmap( file, { imageOrientation: 'from-image' } ).catch( function () { return createImageBitmap( file ); } ).catch( function () { return viaImg( file ); } );
		}
		return viaImg( file );
	}
	function viaImg( file ) {
		return new Promise( function ( resolve, reject ) {
			var url = URL.createObjectURL( file );
			var img = new Image();
			img.onload = function () { resolve( img ); };
			img.onerror = function () { URL.revokeObjectURL( url ); reject( new Error( 'decode' ) ); };
			img.src = url;
		} );
	}
	function toBlob( canvas, q ) {
		return new Promise( function ( resolve ) { canvas.toBlob( resolve, 'image/jpeg', q ); } );
	}
	function resize( file ) {
		return decode( file ).then( function ( src ) {
			var w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
			var k = Math.min( 1, LONG_EDGE / Math.max( w, h ) );
			var c = document.createElement( 'canvas' );
			c.width = Math.round( w * k );
			c.height = Math.round( h * k );
			c.getContext( '2d' ).drawImage( src, 0, 0, c.width, c.height );
			if ( src.close ) src.close();
			return toBlob( c, 0.8 ).then( function ( b ) { return b && b.size > MAX_BYTES ? toBlob( c, 0.6 ) : b; } );
		} );
	}

	// ── Composer ────────────────────────────────────────────────────────────
	var draft = null; // { photos: [{ blob, url, caption }] }

	function downloaded() {
		try { return !! window.localStorage.getItem( 'vms-offline:' + location.host + ':' + slug ); } catch ( e ) { return false; }
	}
	function revealedStops() {
		var upTo = window.__vmsTrip && window.__vmsTrip.upTo ? window.__vmsTrip.upTo() : stops.length;
		return stops.filter( function ( s ) { return s.p <= upTo; } );
	}

	function renderCompose() {
		box.hidden = false;
		var html = '';
		if ( wall.getAttribute( 'data-open' ) !== '1' ) html = '<p class="vms-wall__note">' + esc( t( 'wallClosed', 'The wall is closed for new posts.' ) ) + '</p>';
		else if ( ! downloaded() ) html = '<p class="vms-wall__note">' + esc( t( 'wallNeedDownload', 'Save the trip on this phone first — then you can post to the wall.' ) ) + '</p>';
		else if ( ! draft ) html = '<button type="button" class="vms-wall__add">＋ ' + esc( t( 'wallAdd', 'Add to the trip wall' ) ) + '</button>';
		else html = formHtml();
		box.innerHTML = '<div class="vms-wall__form-wrap">' + html + '</div><div class="vms-wall__outbox"></div>';
		renderOutbox();
		if ( draft ) renderThumbs();
	}

	function formHtml() {
		var rs = revealedStops();
		var opts = '<option value="">' + esc( t( 'wallNoStop', 'No stop' ) ) + '</option>' + rs.map( function ( s ) {
			return '<option value="' + s.p + '"' + ( s.p === ( draft.stop || 0 ) ? ' selected' : '' ) + '>' + s.p + '. ' + esc( s.t ) + '</option>';
		} ).join( '' );
		return '<form class="vms-wall__form" novalidate>' +
			'<textarea class="vms-wall__text" maxlength="' + MAX_TEXT + '" rows="3" placeholder="' + esc( t( 'wallTextPh', 'What happened? (optional)' ) ) + '">' + esc( draft.body || '' ) + '</textarea>' +
			'<p class="vms-wall__count" aria-live="polite"></p>' +
			'<div class="vms-wall__thumbs"></div>' +
			'<label class="vms-wall__pick">📷 ' + esc( t( 'wallPhotos', 'Add photos' ) ) + '<input type="file" accept="image/*" multiple hidden></label>' +
			( rs.length ? '<label class="vms-wall__stop">' + esc( t( 'wallStop', 'Stop' ) ) + ' <select>' + opts + '</select></label>' : '' ) +
			'<p class="vms-wall__err" role="alert" hidden></p>' +
			'<p class="vms-wall__actions"><button type="submit" class="vms-wall__post">' + esc( t( 'wallPost', 'Post' ) ) + '</button> ' +
			'<button type="button" class="vms-wall__cancel">' + esc( t( 'wallCancel', 'Cancel' ) ) + '</button></p>' +
			'</form>';
	}

	function renderThumbs() {
		var el = box.querySelector( '.vms-wall__thumbs' );
		if ( ! el ) return;
		el.innerHTML = draft.photos.map( function ( ph, i ) {
			return '<figure class="vms-wall__thumb" data-i="' + i + '">' +
				( ph.url ? '<img src="' + ph.url + '" alt="">' : '<span class="vms-wall__spin" aria-hidden="true"></span>' ) +
				'<button type="button" class="vms-wall__rm" aria-label="' + esc( t( 'wallDelete', 'Delete' ) ) + '">×</button>' +
				'<input type="text" class="vms-wall__cap" maxlength="200" placeholder="' + esc( t( 'wallCaptionPh', 'Caption (optional)' ) ) + '" value="' + esc( ph.caption || '' ) + '">' +
				'</figure>';
		} ).join( '' );
		var count = box.querySelector( '.vms-wall__count' );
		var text = box.querySelector( '.vms-wall__text' );
		if ( count && text ) count.textContent = text.value.length > MAX_TEXT * 0.8 ? text.value.length + ' / ' + MAX_TEXT : '';
	}

	function showErr( msg ) {
		var el = box.querySelector( '.vms-wall__err' );
		if ( el ) { el.textContent = msg; el.hidden = ! msg; }
	}

	function syncDraft() {
		var text = box.querySelector( '.vms-wall__text' );
		var sel = box.querySelector( '.vms-wall__stop select' );
		if ( text ) draft.body = text.value;
		if ( sel ) draft.stop = sel.value ? parseInt( sel.value, 10 ) : 0;
		box.querySelectorAll( '.vms-wall__thumb' ).forEach( function ( f ) {
			var ph = draft.photos[ parseInt( f.getAttribute( 'data-i' ), 10 ) ];
			var cap = f.querySelector( '.vms-wall__cap' );
			if ( ph && cap ) ph.caption = cap.value;
		} );
	}

	function addFiles( files ) {
		syncDraft();
		showErr( '' );
		var list = Array.prototype.slice.call( files || [] ).filter( function ( f ) { return /^image\//.test( f.type ) || /\.(jpe?g|png|webp|heic|heif)$/i.test( f.name ); } );
		if ( draft.photos.length + list.length > MAX_PHOTOS ) {
			showErr( t( 'wallTooMany', 'Up to 10 photos per post.' ) );
			list = list.slice( 0, Math.max( 0, MAX_PHOTOS - draft.photos.length ) );
		}
		list.forEach( function ( f ) {
			var ph = { blob: null, url: null, caption: '', busy: true };
			draft.photos.push( ph );
			resize( f ).then( function ( b ) {
				if ( ! b ) throw new Error( 'encode' );
				ph.blob = b;
				ph.url = URL.createObjectURL( b );
			} ).catch( function () {
				draft.photos.splice( draft.photos.indexOf( ph ), 1 );
				showErr( t( 'genericError', 'Something went wrong. Please try again.' ) );
			} ).then( function () {
				ph.busy = false;
				syncDraft();
				renderThumbs();
			} );
		} );
		renderThumbs();
	}

	function submit() {
		syncDraft();
		var body = ( draft.body || '' ).trim();
		if ( draft.photos.some( function ( p ) { return p.busy; } ) ) return;
		if ( body.length > MAX_TEXT ) return showErr( t( 'wallTooLong', 'Up to 2,000 characters.' ) );
		if ( ! body && ! draft.photos.length ) return showErr( t( 'wallEmptyPost', 'Add a photo or some text.' ) );
		var it = {
			cid: newId(),
			host: location.host,
			trip: slug,
			body: body,
			stop: draft.stop || null,
			createdAt: new Date().toISOString(),
			images: draft.photos.map( function ( p ) { return { blob: p.blob, caption: ( p.caption || '' ).trim(), url: null, sig: null }; } ),
			error: null,
		};
		var btn = box.querySelector( '.vms-wall__post' );
		if ( btn ) btn.disabled = true;
		putItem( it ).then( function () {
			draft.photos.forEach( function ( p ) { if ( p.url ) URL.revokeObjectURL( p.url ); } );
			draft = null;
			items.push( it );
			renderCompose();
			if ( navigator.onLine === false ) toast( t( 'wallOffline', "You're offline — the post is saved and will upload when you're back online." ) );
			flush();
		} );
	}

	// ── Outbox cards + sending ──────────────────────────────────────────────
	var thumbUrls = {};
	function thumbFor( it, i ) {
		var k = it.cid + ':' + i;
		if ( ! thumbUrls[ k ] && it.images[ i ].blob ) thumbUrls[ k ] = URL.createObjectURL( it.images[ i ].blob );
		return thumbUrls[ k ] || '';
	}
	function stopName( n ) {
		for ( var i = 0; i < stops.length; i++ ) if ( stops[ i ].p === n ) return stops[ i ].t;
		return '';
	}
	function renderOutbox() {
		var el = box.querySelector( '.vms-wall__outbox' );
		if ( ! el ) return;
		el.innerHTML = items.map( function ( it ) {
			var state = it.done
				? ( it.status === 'pending' ? '<span class="vms-post__badge">' + esc( t( 'wallPending', 'Waiting for approval' ) ) + '</span>' : '' )
				: '<span class="vms-post__badge vms-post__badge--wait">' + esc( it.sending ? t( 'wallSending', 'Uploading…' ) : it.error ? it.error : t( 'wallWaiting', 'Waiting to upload' ) ) + '</span>';
			var photos = it.images.map( function ( im, i ) {
				var src = im.url || thumbFor( it, i );
				return '<figure class="vms-post__photo"><img src="' + esc( src ) + '" alt="">' + ( im.caption ? '<figcaption>' + esc( im.caption ) + '</figcaption>' : '' ) + '</figure>';
			} ).join( '' );
			return '<article class="vms-post is-local' + ( it.done ? ' is-sent' : '' ) + '" data-cid="' + esc( it.cid ) + '">' +
				'<header class="vms-post__head"><strong class="vms-post__author">' + esc( ( root.querySelector( '.vms-trip__me strong' ) || {} ).textContent || t( 'wallParticipant', 'Participant' ) ) + '</strong>' +
				'<time class="vms-post__time">' + esc( new Date( it.createdAt ).toLocaleTimeString( document.documentElement.lang || undefined, { hour: '2-digit', minute: '2-digit' } ) ) + '</time>' +
				( it.stop ? '<span class="vms-post__stop">📍 ' + esc( stopName( it.stop ) ) + '</span>' : '' ) + state + '</header>' +
				( it.body ? '<div class="vms-post__body">' + textHtml( it.body ) + '</div>' : '' ) +
				( photos ? '<div class="vms-post__photos vms-post__photos--' + Math.min( it.images.length, 4 ) + '">' + photos + '</div>' : '' ) +
				( ! it.done && it.fatal ? '<p class="vms-post__own"><button type="button" class="vms-post__act" data-drop="' + esc( it.cid ) + '">' + esc( t( 'wallDelete', 'Delete' ) ) + '</button></p>' : '' ) +
				'</article>';
		} ).join( '' );
	}

	function api( action, body, isBlob ) {
		var url = '/api/trips/wall/' + action + ( isBlob ? '?trip=' + encodeURIComponent( slug ) : '' );
		return fetch( url, {
			method: 'POST',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: { 'Content-Type': isBlob ? 'application/octet-stream' : 'application/json' },
			body: isBlob ? body : JSON.stringify( body ),
		} ).then( function ( r ) {
			return r.json().catch( function () { return {}; } ).then( function ( j ) { j.httpStatus = r.status; return j; } );
		} );
	}

	// Permanent: the server rejected the content itself. Transient: retry later.
	function classify( r ) {
		if ( r.httpStatus === 401 ) return 'signed_out';
		if ( r.httpStatus === 403 || r.httpStatus === 400 || r.httpStatus === 413 || r.httpStatus === 415 ) return 'fatal';
		return 'retry';
	}

	function sendOne( it ) {
		var chain = Promise.resolve();
		it.images.forEach( function ( im ) {
			chain = chain.then( function () {
				if ( im.url ) return;
				return api( 'upload', im.blob, true ).then( function ( r ) {
					if ( ! r.ok ) { var e = new Error( r.message || 'upload' ); e.kind = classify( r ); throw e; }
					im.url = r.url;
					im.sig = r.sig;
					return putItem( it ); // a retry won't upload this photo again
				} );
			} );
		} );
		return chain.then( function () {
			return api( 'post', {
				trip: slug,
				clientPostId: it.cid,
				body: it.body,
				stopPosition: it.stop,
				images: it.images.map( function ( im ) { return { url: im.url, sig: im.sig, caption: im.caption }; } ),
			} );
		} ).then( function ( r ) {
			if ( ! r.ok ) { var e = new Error( r.message || 'post' ); e.kind = classify( r ); throw e; }
			it.done = true;
			it.status = r.post && r.post.status;
			return dropItem( it.cid );
		} );
	}

	function flush() {
		if ( flushing || signedOut || navigator.onLine === false ) return;
		var queue = items.filter( function ( it ) { return ! it.done && ! it.fatal; } );
		if ( ! queue.length ) return;
		flushing = true;
		var chain = Promise.resolve();
		queue.forEach( function ( it ) {
			chain = chain.then( function () {
				if ( signedOut ) return;
				it.sending = true;
				it.error = null;
				renderOutbox();
				return sendOne( it ).catch( function ( err ) {
					if ( err.kind === 'signed_out' ) { signedOut = true; it.error = t( 'wallSignedOut', 'Sign in again to post.' ); }
					else if ( err.kind === 'fatal' ) { it.fatal = true; it.error = err.message; }
					else it.error = t( 'wallFailed', "Couldn't post yet — it will retry automatically." );
				} ).then( function () { it.sending = false; renderOutbox(); } );
			} );
		} );
		chain.then( function () {
			flushing = false;
			scheduleRetry();
		} );
	}
	function scheduleRetry() {
		clearTimeout( retryTimer );
		if ( items.some( function ( it ) { return ! it.done && ! it.fatal; } ) && ! signedOut ) retryTimer = setTimeout( flush, RETRY_MS );
	}

	// ── Own posts: edit / delete (server-rendered, online) ──────────────────
	function bindOwn() {
		wall.addEventListener( 'click', function ( e ) {
			var drop = e.target.closest ? e.target.closest( '[data-drop]' ) : null;
			if ( drop ) {
				var cid = drop.getAttribute( 'data-drop' );
				dropItem( cid ).then( function () {
					items = items.filter( function ( it ) { return it.cid !== cid; } );
					renderOutbox();
				} );
				return;
			}
			var btn = e.target.closest ? e.target.closest( '.vms-post__act[data-act]' ) : null;
			if ( ! btn ) return;
			var post = btn.closest( '.vms-post' );
			var id = post && post.getAttribute( 'data-post' );
			if ( ! id ) return;
			if ( navigator.onLine === false ) { toast( t( 'offlineNeedNet', 'Connect to the internet first.' ) ); return; }
			if ( btn.getAttribute( 'data-act' ) === 'delete' ) {
				if ( ! window.confirm( t( 'wallDeleteConfirm', 'Delete this post?' ) ) ) return;
				btn.disabled = true;
				api( 'delete', { trip: slug, postId: id } ).then( function ( r ) {
					if ( r.ok ) post.remove();
					else { btn.disabled = false; toast( r.message || t( 'genericError', 'Something went wrong.' ) ); }
				}, function () { btn.disabled = false; toast( t( 'genericError', 'Something went wrong.' ) ); } );
			} else {
				startEdit( post, id );
			}
		} );
	}
	function startEdit( post, id ) {
		if ( post.querySelector( '.vms-post__edit' ) ) return;
		var bodyEl = post.querySelector( '.vms-post__body' );
		var current = bodyEl ? bodyEl.innerText : '';
		var form = document.createElement( 'div' );
		form.className = 'vms-post__edit';
		form.innerHTML = '<textarea class="vms-wall__text" maxlength="' + MAX_TEXT + '" rows="3"></textarea>' +
			'<p class="vms-wall__actions"><button type="button" class="vms-wall__post">' + esc( t( 'wallSave', 'Save' ) ) + '</button> ' +
			'<button type="button" class="vms-wall__cancel">' + esc( t( 'wallCancel', 'Cancel' ) ) + '</button></p>';
		form.querySelector( 'textarea' ).value = current;
		( bodyEl || post.querySelector( '.vms-post__head' ) ).insertAdjacentElement( 'afterend', form );
		if ( bodyEl ) bodyEl.hidden = true;
		form.querySelector( '.vms-wall__cancel' ).addEventListener( 'click', function () { form.remove(); if ( bodyEl ) bodyEl.hidden = false; } );
		form.querySelector( '.vms-wall__post' ).addEventListener( 'click', function () {
			var val = form.querySelector( 'textarea' ).value.trim();
			var save = this;
			save.disabled = true;
			api( 'edit', { trip: slug, postId: id, body: val } ).then( function ( r ) {
				if ( ! r.ok ) { save.disabled = false; toast( r.message || t( 'genericError', 'Something went wrong.' ) ); return; }
				if ( ! bodyEl ) {
					bodyEl = document.createElement( 'div' );
					bodyEl.className = 'vms-post__body';
					form.insertAdjacentElement( 'beforebegin', bodyEl );
				}
				bodyEl.innerHTML = textHtml( val );
				bodyEl.hidden = ! val;
				form.remove();
			}, function () { save.disabled = false; toast( t( 'genericError', 'Something went wrong.' ) ); } );
		} );
	}

	function bindCompose() {
		box.addEventListener( 'click', function ( e ) {
			var el = e.target;
			if ( ! el.closest ) return;
			if ( el.closest( '.vms-wall__add' ) ) { draft = { photos: [], body: '', stop: ( window.__vmsTrip && window.__vmsTrip.upTo && window.__vmsTrip.upTo() ) || 0 }; renderCompose(); var ta = box.querySelector( '.vms-wall__text' ); if ( ta ) ta.focus(); }
			else if ( el.closest( '.vms-wall__cancel' ) && ! el.closest( '.vms-post__edit' ) ) {
				draft.photos.forEach( function ( p ) { if ( p.url ) URL.revokeObjectURL( p.url ); } );
				draft = null;
				renderCompose();
			} else if ( el.closest( '.vms-wall__rm' ) ) {
				syncDraft();
				var i = parseInt( el.closest( '.vms-wall__thumb' ).getAttribute( 'data-i' ), 10 );
				var ph = draft.photos.splice( i, 1 )[ 0 ];
				if ( ph && ph.url ) URL.revokeObjectURL( ph.url );
				renderThumbs();
			}
		} );
		box.addEventListener( 'change', function ( e ) {
			if ( e.target.type === 'file' ) { addFiles( e.target.files ); e.target.value = ''; }
		} );
		box.addEventListener( 'input', function ( e ) {
			if ( e.target.classList && e.target.classList.contains( 'vms-wall__text' ) && ! e.target.closest( '.vms-post__edit' ) ) {
				var count = box.querySelector( '.vms-wall__count' );
				if ( count ) count.textContent = e.target.value.length > MAX_TEXT * 0.8 ? e.target.value.length + ' / ' + MAX_TEXT : '';
			}
		} );
		box.addEventListener( 'submit', function ( e ) { e.preventDefault(); submit(); } );
	}

	function init() {
		root = document.querySelector( '.vms-trip' );
		wall = root && root.querySelector( '.vms-wall' );
		if ( ! wall ) return;
		try { T = JSON.parse( root.getAttribute( 'data-i18n' ) || '{}' ); } catch ( e ) { T = {}; }
		slug = root.getAttribute( 'data-trip' ) || '';
		try { stops = JSON.parse( wall.getAttribute( 'data-stops' ) || '[]' ); } catch ( e ) { stops = []; }
		bindFilter();
		if ( root.getAttribute( 'data-mode' ) !== 'participant' ) return;
		bindOwn();
		box = wall.querySelector( '.vms-wall__compose' );
		if ( ! box ) return;
		bindCompose();
		renderCompose();
		// The download finishing (trip-offline.js) unlocks the composer.
		document.addEventListener( 'vms-trip-offline-ready', function () { if ( ! draft ) renderCompose(); } );
		loadOutbox().then( function ( list ) {
			items = list;
			renderOutbox();
			flush();
		}, function () { /* no IndexedDB */ } );
		window.addEventListener( 'online', flush );
		document.addEventListener( 'visibilitychange', function () { if ( document.visibilityState === 'visible' ) flush(); } );
	}

	// After load: see trip.js (React hydration).
	function whenSettled( fn ) {
		if ( document.readyState === 'complete' ) setTimeout( fn, 80 );
		else window.addEventListener( 'load', function () { setTimeout( fn, 80 ); } );
	}
	whenSettled( init );
} )();
