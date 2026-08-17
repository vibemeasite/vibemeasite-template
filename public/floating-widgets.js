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
	document.querySelectorAll( '.fw-slot[data-fw-mode="popup"]' ).forEach( function ( slot ) {
		var trigger = slot.querySelector( '[data-cellpy-floating-widget]' );
		var panel = document.getElementById( 'fw-popup-' + slot.getAttribute( 'data-fw-widget-id' ) );
		if ( ! trigger || ! panel ) return;

		trigger.addEventListener( 'click', function () { openPopup( panel ); } );
		panel.querySelectorAll( '[data-fw-popup-close]' ).forEach( function ( closer ) {
			closer.addEventListener( 'click', function () { closePopup( panel ); } );
		} );
		panel.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'Escape' ) closePopup( panel );
		} );
	} );
} )();
