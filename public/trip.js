/**
 * BSA Phase 27 — Travel Kit trip page behaviour (slice 1: the stop panel).
 * Loaded by components/TripPage.tsx on "trips/{slug}" pages only.
 *
 * Without JS, a route-map marker (<a href="#stop-N">) just scrolls to that
 * stop's <article id="stop-N"> in the list. With JS, it opens the stop in a
 * panel: a bottom sheet under 640px, a side panel above. The article element
 * itself is MOVED into the panel (and back on close) rather than cloned, so
 * lightbox.js's per-image click bindings keep working inside it. The panel is
 * a plain fixed <div role="dialog">, not a modal <dialog>, because a top-layer
 * modal would sit above lightbox.js's overlay and hide it.
 *
 * Also hides [data-online-only] links (e.g. "Open in Google Maps") while the
 * device is offline — the offline trip mode in a later slice relies on that.
 */
( function () {
	if ( window.__vmsTripInit ) return;
	window.__vmsTripInit = true;

	var script = document.currentScript;
	var CLOSE_LABEL = ( script && script.getAttribute( 'data-close-label' ) ) || 'Close';
	var STOP_HASH = /^#stop-(\d+)$/;

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
		if ( ! panel ) buildPanel();
		if ( current ) restore();
		placeholder = document.createElement( 'span' );
		placeholder.className = 'vms-stop-placeholder';
		article.parentNode.insertBefore( placeholder, article );
		body.appendChild( article );
		current = article;
		var details = article.querySelector( 'details' );
		if ( details ) details.open = true;
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

	document.addEventListener( 'click', function ( e ) {
		var a = e.target && e.target.closest ? e.target.closest( 'a[href^="#stop-"]' ) : null;
		if ( ! a || ! a.closest( '.vms-trip' ) ) return;
		var m = STOP_HASH.exec( a.getAttribute( 'href' ) );
		if ( ! m ) return;
		if ( open( m[ 1 ], a, true ) ) e.preventDefault();
	} );

	document.addEventListener( 'keydown', function ( e ) {
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
		syncOnline();
		var m = STOP_HASH.exec( location.hash );
		if ( m ) open( m[ 1 ], null, false );
	}
	if ( document.readyState === 'loading' ) document.addEventListener( 'DOMContentLoaded', init );
	else init();
} )();
