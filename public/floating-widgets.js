/**
 * Floating widget interactivity for the Cellpy floating-widget blocks
 * rendered by this template — click-to-open/close for popup-mode widgets
 * (link-mode widgets are plain <a href> and need no JS at all). Host-page
 * script, not sandboxed block content, same architecture as
 * cookie-consent.js/booking.js: the trigger's own HTML (vibemeasite-mcp's
 * lib/floating-widget-template.ts) is a fixed skeleton carrying
 * data-cellpy-floating-widget; the matching popup panel (ships `hidden`) is
 * rendered by components/FloatingWidgets.tsx, not by the block itself.
 * Guarded against double-inclusion the same way forms.js/lightbox.js/
 * booking.js are — app/layout.tsx's FloatingWidgets component decides on
 * this script independently of any given page's own content, so it's not
 * safe to assume it's only ever included once.
 *
 * Optional per-widget scheduling (add_floating_widget's auto_open_delay_
 * seconds / hide_on_paths / expires_at) arrives as data-fw-* attributes on
 * the trigger itself, stamped by vibemeasite-mcp's fixed skeleton — not on
 * the trusted wrapper, so it needs no column in the site's own
 * floating_widgets mirror table:
 *   data-fw-hide-paths="/a,/b" — hide the whole widget (trigger + popup) on
 *     those paths, with or without a locale prefix (/en/a matches /a).
 *   data-fw-expires="ISO date" — hide the whole widget from then on.
 *   data-fw-auto-open="N" — popup mode only: open by itself N seconds after
 *     load, once per browser session (closing it is remembered in
 *     sessionStorage, so it doesn't follow the visitor from page to page).
 */
( function () {
	if ( window.__cellpyFloatingWidgetsInit ) return;
	window.__cellpyFloatingWidgetsInit = true;

	function openPopup( panel ) {
		panel.hidden = false;
		document.body.classList.add( 'fw-popup-open' );
		var closeBtn = panel.querySelector( '.fw-popup-close' );
		if ( closeBtn ) closeBtn.focus();
	}

	function closePopup( panel ) {
		panel.hidden = true;
		document.body.classList.remove( 'fw-popup-open' );
	}

	// Multi-instance — any number of popup-mode widgets can exist on a page,
	// same forEach pattern lang-switcher.js uses for its own repeated widget.
	function normalizePath( path ) {
		return path.replace( /\/+$/, '' ) || '/';
	}

	// "/en/black-friday" → "/black-friday". Both forms are checked, so a
	// listed path also matches when a real page slug looks like a locale.
	function stripLocale( path ) {
		return path.replace( /^\/[a-z]{2}(?:-[a-z]{2,4})?(?=\/|$)/i, '' ) || '/';
	}

	function hiddenHere( trigger ) {
		var expires = trigger.getAttribute( 'data-fw-expires' );
		if ( expires ) {
			var t = Date.parse( expires );
			if ( ! isNaN( t ) && Date.now() >= t ) return true;
		}
		var paths = trigger.getAttribute( 'data-fw-hide-paths' );
		if ( ! paths ) return false;
		var here = normalizePath( window.location.pathname );
		var bare = stripLocale( here );
		return paths.split( ',' ).some( function ( p ) {
			p = normalizePath( p.trim() );
			return p !== '' && ( p === here || p === bare );
		} );
	}

	function storageGet( key ) {
		try { return window.sessionStorage.getItem( key ); } catch ( e ) { return null; }
	}

	function storageSet( key, value ) {
		try { window.sessionStorage.setItem( key, value ); } catch ( e ) {}
	}

	// Link-mode widgets can carry hide_on_paths/expires_at too.
	document.querySelectorAll( '.fw-slot' ).forEach( function ( slot ) {
		var trigger = slot.querySelector( '[data-cellpy-floating-widget]' );
		if ( trigger && hiddenHere( trigger ) ) slot.hidden = true;
	} );

	document.querySelectorAll( '.fw-slot[data-fw-mode="popup"]' ).forEach( function ( slot ) {
		var trigger = slot.querySelector( '[data-cellpy-floating-widget]' );
		var panel = document.getElementById( 'fw-popup-' + slot.getAttribute( 'data-fw-widget-id' ) );
		if ( ! trigger || ! panel || slot.hidden ) return;

		var seenKey = 'fw-auto-open-seen-' + slot.getAttribute( 'data-fw-widget-id' );
		function close() {
			closePopup( panel );
			storageSet( seenKey, '1' );
		}

		trigger.addEventListener( 'click', function () { openPopup( panel ); } );
		panel.querySelectorAll( '[data-fw-popup-close]' ).forEach( function ( closer ) {
			closer.addEventListener( 'click', close );
		} );
		panel.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Escape' ) close();
		} );
		// Following a link inside the popup counts as having seen it too.
		panel.addEventListener( 'click', function ( e ) {
			if ( e.target.closest && e.target.closest( 'a[href]' ) ) storageSet( seenKey, '1' );
		} );

		var delay = parseFloat( trigger.getAttribute( 'data-fw-auto-open' ) );
		if ( ! isNaN( delay ) && delay >= 0 && ! storageGet( seenKey ) ) {
			window.setTimeout( function () {
				// Don't stack on top of another popup the visitor opened meanwhile.
				if ( document.body.classList.contains( 'fw-popup-open' ) ) return;
				openPopup( panel );
			}, delay * 1000 );
		}
	} );
} )();
