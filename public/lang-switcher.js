/**
 * Progressively collapses the header language switcher's "select"
 * presentation (MobileNav.tsx) from a plain expanded list of
 * <a href="?lang="> links into a toggle button + dropdown list. The links
 * themselves need no JS at all to work — this only adds the collapse/
 * expand interaction, so a page that never loads this script (or a site
 * running an older template build — see set_language_switcher_style's
 * live-push note) still gets a working, if uncollapsed, list. Only
 * included on sites configured for the "select" switcher style — see the
 * conditional <script> in app/layout.tsx.
 */
( function () {
	function closeMenu( toggle, menu ) {
		menu.hidden = true;
		toggle.setAttribute( 'aria-expanded', 'false' );
	}

	function openMenu( toggle, menu ) {
		menu.hidden = false;
		toggle.setAttribute( 'aria-expanded', 'true' );
	}

	document.querySelectorAll( '[data-lang-switcher]' ).forEach( function ( widget ) {
		var toggle = widget.querySelector( '.lang-switcher-toggle' );
		var menu = widget.querySelector( '.lang-switcher-menu' );
		if ( ! toggle || ! menu ) return;

		// Only collapse once JS is confirmed running — the server-rendered
		// markup ships with the list expanded and the toggle button hidden
		// (see MobileNav.tsx), so this is the one place that flips both
		// into their "enhanced" state.
		closeMenu( toggle, menu );
		toggle.hidden = false;

		toggle.addEventListener( 'click', function () {
			if ( menu.hidden ) {
				openMenu( toggle, menu );
			} else {
				closeMenu( toggle, menu );
			}
		} );

		document.addEventListener( 'click', function ( event ) {
			if ( ! widget.contains( event.target ) ) closeMenu( toggle, menu );
		} );

		document.addEventListener( 'keydown', function ( event ) {
			if ( event.key === 'Escape' ) closeMenu( toggle, menu );
		} );
	} );
} )();
