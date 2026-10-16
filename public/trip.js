/**
 * BSA Phase 27 — Travel Kit trip page behaviour. Loaded by
 * components/TripPage.tsx on "trips/{slug}" pages only.
 *
 * 1. Stop panel. A route-map pin (<a href="#stop-N">) or a #stop-N link opens
 *    that stop in a panel: a bottom sheet under 640px, a side panel above.
 *    The article element itself is MOVED into the panel (and back on close),
 *    not cloned, so lightbox.js's per-image bindings keep working. A plain
 *    fixed <div role="dialog">, not a modal <dialog>: a top-layer modal would
 *    sit above lightbox.js's overlay and hide it. Without JS, the link just
 *    scrolls to the article.
 *
 * 2. Start (public preview): email → 6-digit code through the site's Phase 19
 *    relay (/api/shopper-auth/*, with tripSlug so only rostered emails get a
 *    code), then a reload — the server renders the participant version.
 *
 * 3. Progressive reveal (participant version, BSA Area 8). The highest
 *    revealed stop position is kept per device in localStorage; the page
 *    shows stops up to max(stored, scheduled-time reveal, trip ended → all).
 *    Revealing stop N reveals 1..N. GPS reveal arrives in a later slice.
 *    Locks are a surprise mechanic, not security: every stop is in the HTML.
 *
 * 4. Hidden test shortcuts (BSA P27), participant version only. Typed words
 *    (anywhere outside a text field), not key chords — browsers already own
 *    Shift+Alt+R (Firefox/Windows), Ctrl+Shift+N/A/R, etc.:
 *      vmsnext   next stop (as if just arrived: reveal + open its panel)
 *      vmsall    reveal all      vmsreset   reset this device
 *    On a phone: tap the map's compass 5× quickly = next; hold it 3 s = all;
 *    tap 5× then hold = reset. Each shows a "Test: …" toast.
 *
 * Also hides [data-online-only] links while the device is offline.
 */
( function () {
	if ( window.__vmsTripInit ) return;
	window.__vmsTripInit = true;

	var script = document.currentScript;
	var CLOSE_LABEL = ( script && script.getAttribute( 'data-close-label' ) ) || 'Close';
	var STOP_HASH = /^#stop-(\d+)$/;

	var root = null;
	var T = {};
	var mode = 'preview';
	var tripSlug = '';

	// ── Storage (never required) ────────────────────────────────────────────
	function load( key ) {
		try { return window.localStorage.getItem( key ); } catch ( e ) { return null; }
	}
	function save( key, value ) {
		try {
			if ( value === null ) window.localStorage.removeItem( key );
			else window.localStorage.setItem( key, value );
		} catch ( e ) { /* private mode etc. */ }
	}

	// ── Stop panel ──────────────────────────────────────────────────────────
	var panel = null;
	var body = null;
	var placeholder = null;
	var current = null;
	var lastTrigger = null;

	function buildPanel() {
		panel = document.createElement( 'div' );
		panel.className = 'vms-stop-panel';
		panel.setAttribute( 'role', 'dialog' );
		panel.setAttribute( 'aria-modal', 'true' );
		panel.hidden = true;
		panel.innerHTML =
			'<div class="vms-stop-panel__backdrop" data-close="1"></div>' +
			'<div class="vms-stop-panel__sheet" tabindex="-1">' +
			'<button type="button" class="vms-stop-panel__close" data-close="1"></button>' +
			'<div class="vms-stop-panel__body"></div>' +
			'</div>';
		var closeBtn = panel.querySelector( '.vms-stop-panel__close' );
		closeBtn.setAttribute( 'aria-label', CLOSE_LABEL );
		closeBtn.textContent = '×';
		body = panel.querySelector( '.vms-stop-panel__body' );
		panel.addEventListener( 'click', function ( e ) {
			if ( e.target && e.target.getAttribute && e.target.getAttribute( 'data-close' ) ) close( true );
		} );
		document.body.appendChild( panel );
	}

	function open( n, trigger, pushHash ) {
		var article = document.getElementById( 'stop-' + n );
		if ( ! article || ! article.classList.contains( 'vms-stop' ) ) return false;
		if ( article.classList.contains( 'is-locked' ) ) return false;
		if ( ! panel ) buildPanel();
		if ( current ) restore();
		placeholder = document.createElement( 'span' );
		placeholder.className = 'vms-stop-placeholder';
		article.parentNode.insertBefore( placeholder, article );
		body.appendChild( article );
		current = article;
		var details = article.querySelector( 'details' );
		if ( details ) details.open = true;
		// Lazy images don't reliably start loading once moved into the fixed,
		// scrollable sheet — load this stop's photos now.
		article.querySelectorAll( 'img[loading="lazy"]' ).forEach( function ( img ) {
			img.loading = 'eager';
		} );
		var title = article.querySelector( '.vms-stop__title' );
		if ( title ) {
			if ( ! title.id ) title.id = 'stop-title-' + n;
			panel.setAttribute( 'aria-labelledby', title.id );
		}
		panel.hidden = false;
		document.documentElement.classList.add( 'vms-stop-panel-open' );
		lastTrigger = trigger || null;
		markActive( n );
		panel.querySelector( '.vms-stop-panel__sheet' ).focus();
		body.scrollTop = 0;
		if ( pushHash && history.replaceState ) history.replaceState( null, '', '#stop-' + n );
		return true;
	}

	function restore() {
		if ( ! current || ! placeholder ) return;
		var details = current.querySelector( 'details' );
		if ( details ) details.open = false;
		placeholder.parentNode.insertBefore( current, placeholder );
		placeholder.parentNode.removeChild( placeholder );
		current = null;
		placeholder = null;
	}

	function close( clearHash ) {
		if ( ! panel || panel.hidden ) return;
		// lightbox.js open over the panel: let it handle Escape first.
		if ( document.getElementById( 'cellpy-lightbox-overlay' ) ) return;
		restore();
		panel.hidden = true;
		document.documentElement.classList.remove( 'vms-stop-panel-open' );
		markActive( null );
		if ( clearHash && STOP_HASH.test( location.hash ) && history.replaceState ) {
			history.replaceState( null, '', location.pathname + location.search );
		}
		if ( lastTrigger && lastTrigger.focus ) lastTrigger.focus();
	}

	function markActive( n ) {
		document.querySelectorAll( '.vms-route__stop' ).forEach( function ( a ) {
			a.classList.toggle( 'is-active', n !== null && a.getAttribute( 'data-stop' ) === String( n ) );
		} );
	}

	// ── Progressive reveal (participant version) ────────────────────────────
	var stops = []; // [{ pos, at (ms|null), el, item }]
	var revealKey = '';

	function storedReveal() {
		var v = parseInt( load( revealKey ) || '0', 10 );
		return isNaN( v ) ? 0 : v;
	}

	function computedReveal() {
		if ( ! stops.length ) return 0;
		var last = stops[ stops.length - 1 ].pos;
		var endAt = Date.parse( root.getAttribute( 'data-end-at' ) || '' );
		if ( ! isNaN( endAt ) && Date.now() > endAt ) return last;
		var timeMax = 0;
		stops.forEach( function ( s ) {
			if ( s.at !== null && s.at <= Date.now() ) timeMax = Math.max( timeMax, s.pos );
		} );
		return Math.min( last, Math.max( storedReveal(), timeMax ) );
	}

	function applyReveal() {
		var upTo = computedReveal();
		stops.forEach( function ( s ) {
			var locked = s.pos > upTo;
			s.el.classList.toggle( 'is-locked', locked );
			if ( s.item ) s.item.classList.toggle( 'is-locked', locked );
		} );
		document.querySelectorAll( '.vms-route__stop' ).forEach( function ( pin ) {
			var pos = parseInt( pin.getAttribute( 'data-stop' ), 10 );
			pin.classList.toggle( 'is-locked', pos > upTo );
		} );
		var next = null;
		for ( var i = 0; i < stops.length; i++ ) {
			if ( stops[ i ].pos > upTo ) { next = stops[ i ]; break; }
		}
		var teaser = root.querySelector( '.vms-trip__next' );
		if ( teaser ) {
			teaser.hidden = ! next;
			var title = teaser.querySelector( '.vms-trip__next-title' );
			if ( title && next ) title.textContent = next.el.getAttribute( 'data-title' ) || '';
		}
		return { upTo: upTo, next: next };
	}

	// Reveal up to stop `pos` (and everything before it). openIt = arrival UX.
	function revealUpTo( pos, openIt ) {
		save( revealKey, String( Math.max( storedReveal(), pos ) ) );
		applyReveal();
		if ( openIt ) open( pos, null, true );
	}

	// ── Test shortcuts (P27) ────────────────────────────────────────────────
	var toastEl = null;
	var toastTimer = null;
	function toast( msg ) {
		if ( ! toastEl ) {
			toastEl = document.createElement( 'div' );
			toastEl.className = 'vms-trip-toast';
			toastEl.setAttribute( 'role', 'status' );
			document.body.appendChild( toastEl );
		}
		toastEl.textContent = msg;
		toastEl.classList.add( 'is-on' );
		clearTimeout( toastTimer );
		toastTimer = setTimeout( function () { toastEl.classList.remove( 'is-on' ); }, 2600 );
	}

	function testNext() {
		var r = applyReveal();
		if ( ! r.next ) { toast( T.testAll || 'Test: all stops revealed' ); return; }
		revealUpTo( r.next.pos, true );
		toast( T.testNext || 'Test: next stop revealed' );
	}
	function testAll() {
		if ( stops.length ) revealUpTo( stops[ stops.length - 1 ].pos, false );
		toast( T.testAll || 'Test: all stops revealed' );
	}
	function testReset() {
		save( revealKey, null );
		close( true );
		applyReveal();
		toast( T.testReset || 'Test: reveal reset' );
	}

	// Phone gestures on the map's compass rose: 5 quick taps = next stop; hold
	// 3 s = reveal all; 5 taps and then a hold = reset.
	function bindCompassGestures() {
		var taps = 0;
		var tapsTimer = null; // forgets taps after a pause
		var nextTimer = null; // fires "next" unless a hold follows the 5th tap
		var holdTimer = null;
		function forget() { taps = 0; clearTimeout( tapsTimer ); clearTimeout( nextTimer ); }
		document.querySelectorAll( '.vms-map__compass' ).forEach( function ( c ) {
			c.style.cursor = 'pointer';
			c.style.touchAction = 'manipulation';
			c.addEventListener( 'pointerdown', function ( e ) {
				e.preventDefault();
				clearTimeout( nextTimer );
				var resetHold = taps >= 5;
				holdTimer = setTimeout( function () {
					holdTimer = null;
					forget();
					if ( resetHold ) testReset();
					else testAll();
				}, 3000 );
			} );
			c.addEventListener( 'pointerup', function () {
				if ( ! holdTimer ) return; // the hold already fired
				clearTimeout( holdTimer );
				holdTimer = null;
				taps += 1;
				clearTimeout( tapsTimer );
				if ( taps >= 5 ) {
					nextTimer = setTimeout( function () { forget(); testNext(); }, 700 );
				} else {
					tapsTimer = setTimeout( forget, 1500 );
				}
			} );
			c.addEventListener( 'pointercancel', function () { clearTimeout( holdTimer ); holdTimer = null; } );
		} );
	}

	// ── Start (public preview) ──────────────────────────────────────────────
	function postJson( url, payload ) {
		return fetch( url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify( payload ),
		} ).then( function ( res ) {
			return res.json().catch( function () { return {}; } ).then( function ( json ) {
				return { status: res.status, json: json };
			} );
		} );
	}

	function initStart( section ) {
		var btn = section.querySelector( '.vms-trip__start-btn' );
		var box = section.querySelector( '.vms-start' );
		if ( ! btn || ! box ) return;
		var pid = section.getAttribute( 'data-pid' );
		var slug = section.getAttribute( 'data-trip' );
		var email = '';

		function err( msg ) {
			var p = box.querySelector( '.vms-start__error' );
			if ( p ) { p.textContent = msg || ''; p.hidden = ! msg; }
		}
		function busy( on ) {
			box.querySelectorAll( 'button, input' ).forEach( function ( el ) { el.disabled = on; } );
		}
		function emailStep() {
			box.innerHTML =
				'<form class="vms-start__form" novalidate>' +
				'<label class="vms-start__label"></label>' +
				'<input class="vms-start__input" type="email" autocomplete="email" inputmode="email" required>' +
				'<button type="submit" class="vms-start__go"></button>' +
				'<p class="vms-start__error" hidden></p>' +
				'</form>';
			box.querySelector( 'label' ).textContent = T.email || 'Your email';
			box.querySelector( '.vms-start__go' ).textContent = T.sendCode || 'Send code';
			var input = box.querySelector( 'input' );
			input.value = email;
			input.focus();
			box.querySelector( 'form' ).addEventListener( 'submit', function ( e ) {
				e.preventDefault();
				email = input.value.trim();
				if ( ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email ) ) { err( T.email ); return; }
				busy( true );
				postJson( '/api/shopper-auth/request-code', { shopAuthPublicId: pid, email: email, tripSlug: slug } ).then( function ( r ) {
					busy( false );
					if ( r.status === 429 ) { err( T.tooMany ); return; }
					if ( r.status !== 200 ) { err( T.genericError ); return; }
					codeStep();
				}, function () { busy( false ); err( T.genericError ); } );
			} );
		}
		function codeStep() {
			box.innerHTML =
				'<form class="vms-start__form" novalidate>' +
				'<p class="vms-start__sent"></p>' +
				'<label class="vms-start__label"></label>' +
				'<input class="vms-start__input vms-start__code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>' +
				'<button type="submit" class="vms-start__go"></button>' +
				'<button type="button" class="vms-start__back"></button>' +
				'<p class="vms-start__error" hidden></p>' +
				'</form>';
			box.querySelector( '.vms-start__sent' ).textContent = ( T.codeSent || 'Code sent to' ) + ' ' + email;
			box.querySelector( 'label' ).textContent = T.code || '6-digit code';
			box.querySelector( '.vms-start__go' ).textContent = T.verify || 'Confirm';
			box.querySelector( '.vms-start__back' ).textContent = T.changeEmail || 'Use another email';
			box.querySelector( '.vms-start__back' ).addEventListener( 'click', emailStep );
			var input = box.querySelector( 'input' );
			input.focus();
			box.querySelector( 'form' ).addEventListener( 'submit', function ( e ) {
				e.preventDefault();
				var code = input.value.replace( /\D/g, '' );
				if ( code.length !== 6 ) { err( T.code ); return; }
				busy( true );
				postJson( '/api/shopper-auth/verify-code', { shopAuthPublicId: pid, email: email, code: code, tripSlug: slug } ).then( function ( r ) {
					if ( r.status === 200 && r.json && r.json.ok ) { location.reload(); return; }
					busy( false );
					var msg = r.json && r.json.message ? String( r.json.message ) : '';
					if ( /expired/i.test( msg ) ) err( T.expired );
					else if ( r.json && typeof r.json.attemptsRemaining === 'number' ) {
						err( r.json.attemptsRemaining > 0 ? ( T.wrongCode || 'Wrong code.' ) + ' ' + r.json.attemptsRemaining : T.tooMany );
					} else err( T.genericError );
				}, function () { busy( false ); err( T.genericError ); } );
			} );
		}

		btn.addEventListener( 'click', function () {
			btn.hidden = true;
			box.hidden = false;
			emailStep();
		} );
	}

	function initSignOut() {
		var b = root.querySelector( '.vms-trip__signout' );
		if ( ! b ) return;
		b.addEventListener( 'click', function () {
			b.disabled = true;
			fetch( '/api/shopper-auth/logout', { method: 'POST', credentials: 'same-origin' } ).then( function () {
				location.reload();
			}, function () { location.reload(); } );
		} );
	}

	// ── Events ──────────────────────────────────────────────────────────────
	document.addEventListener( 'click', function ( e ) {
		var a = e.target && e.target.closest ? e.target.closest( 'a[href^="#stop-"]' ) : null;
		if ( ! a || ! a.closest( '.vms-trip' ) ) return;
		var m = STOP_HASH.exec( a.getAttribute( 'href' ) );
		if ( ! m ) return;
		if ( a.classList.contains( 'is-locked' ) ) { e.preventDefault(); return; }
		if ( open( m[ 1 ], a, true ) ) e.preventDefault();
		else if ( document.getElementById( 'stop-' + m[ 1 ] ) && document.getElementById( 'stop-' + m[ 1 ] ).classList.contains( 'is-locked' ) ) e.preventDefault();
	} );

	// Last letters typed outside text fields, matched against the test words.
	// e.code (physical key), so it works on any keyboard layout (e.g. Cyrillic).
	var typed = '';
	var TEST_WORDS = { vmsnext: function () { testNext(); }, vmsall: function () { testAll(); }, vmsreset: function () { testReset(); } };
	document.addEventListener( 'keydown', function ( e ) {
		if ( mode === 'participant' && ! e.ctrlKey && ! e.metaKey && ! e.altKey && /^Key[A-Z]$/.test( e.code || '' ) ) {
			var t = e.target;
			var editable = t && ( t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test( t.tagName ) );
			if ( ! editable ) {
				typed = ( typed + e.code.slice( 3 ).toLowerCase() ).slice( -12 );
				for ( var w in TEST_WORDS ) {
					if ( typed.slice( -w.length ) === w ) { typed = ''; TEST_WORDS[ w ](); return; }
				}
			}
		}
		if ( e.key === 'Escape' ) close( true );
		if ( e.key === 'Tab' && panel && ! panel.hidden ) {
			// Keep focus inside the panel.
			var f = panel.querySelectorAll( 'a[href], button, summary, [tabindex]:not([tabindex="-1"])' );
			if ( ! f.length ) return;
			var first = f[ 0 ], last = f[ f.length - 1 ];
			if ( e.shiftKey && document.activeElement === first ) { e.preventDefault(); last.focus(); }
			else if ( ! e.shiftKey && document.activeElement === last ) { e.preventDefault(); first.focus(); }
		}
	} );

	// Audio guides: only one plays at a time; language buttons swap the source.
	document.addEventListener( 'play', function ( e ) {
		if ( ! e.target || e.target.tagName !== 'AUDIO' ) return;
		document.querySelectorAll( 'audio.vms-audio__player' ).forEach( function ( a ) {
			if ( a !== e.target && ! a.paused ) a.pause();
		} );
	}, true );
	document.addEventListener( 'click', function ( e ) {
		var b = e.target && e.target.closest ? e.target.closest( '.vms-audio__lang' ) : null;
		if ( ! b ) return;
		var box = b.closest( '.vms-audio' );
		var player = box && box.querySelector( 'audio' );
		if ( ! player ) return;
		var wasPlaying = ! player.paused;
		player.src = b.getAttribute( 'data-src' );
		player.setAttribute( 'data-lang', b.getAttribute( 'data-lang' ) );
		box.querySelectorAll( '.vms-audio__lang' ).forEach( function ( x ) { x.classList.toggle( 'is-current', x === b ); } );
		if ( wasPlaying ) player.play().catch( function () {} );
	} );

	window.addEventListener( 'hashchange', function () {
		var m = STOP_HASH.exec( location.hash );
		if ( m ) open( m[ 1 ], null, false );
		else close( false );
	} );

	function syncOnline() {
		var offline = navigator.onLine === false;
		document.documentElement.classList.toggle( 'vms-offline', offline );
		document.querySelectorAll( '[data-online-only]' ).forEach( function ( el ) {
			el.hidden = offline;
		} );
	}
	window.addEventListener( 'online', syncOnline );
	window.addEventListener( 'offline', syncOnline );

	function init() {
		root = document.querySelector( '.vms-trip' );
		if ( root ) {
			mode = root.getAttribute( 'data-mode' ) || 'preview';
			tripSlug = root.getAttribute( 'data-trip' ) || '';
			try { T = JSON.parse( root.getAttribute( 'data-i18n' ) || '{}' ); } catch ( e ) { T = {}; }
			revealKey = 'vms-trip-reveal:' + location.host + ':' + tripSlug;
			var start = root.querySelector( '.vms-trip__start' );
			if ( start ) initStart( start );
			initSignOut();
			if ( mode === 'participant' ) {
				root.querySelectorAll( '.vms-stop' ).forEach( function ( el ) {
					var at = Date.parse( el.getAttribute( 'data-reveal-at' ) || '' );
					stops.push( {
						pos: parseInt( el.getAttribute( 'data-stop' ), 10 ),
						at: isNaN( at ) ? null : at,
						el: el,
						item: el.closest( '.vms-trip__stop-item' ),
					} );
				} );
				stops.sort( function ( a, b ) { return a.pos - b.pos; } );
				applyReveal();
				// Scheduled-time reveal (P21c) needs no reload: re-check each minute.
				setInterval( applyReveal, 60000 );
				document.addEventListener( 'visibilitychange', function () {
					if ( document.visibilityState === 'visible' ) applyReveal();
				} );
				bindCompassGestures();
			}
		}
		syncOnline();
		var m = STOP_HASH.exec( location.hash );
		if ( m ) open( m[ 1 ], null, false );
	}
	if ( document.readyState === 'loading' ) document.addEventListener( 'DOMContentLoaded', init );
	else init();
} )();
