/**
 * Enables the header language switcher's "select" presentation to actually
 * navigate on change. The "buttons" presentation is plain <a href> links
 * that need no JS at all; a native <select> has no href, so this listens
 * for change and builds the same `?lang=` URL those links would have used
 * (see middleware.ts — the query param only needs to survive one
 * navigation, since it persists into a cookie from there). Only included
 * on sites configured for the "select" switcher style — see the
 * conditional <script> in app/layout.tsx.
 */
( function () {
	function onLangChange( event ) {
		var select = event.target;
		var lang = select.value;
		if ( ! lang ) return;
		window.location.search = 'lang=' + encodeURIComponent( lang );
	}

	document.querySelectorAll( '[data-lang-switcher]' ).forEach( function ( select ) {
		select.addEventListener( 'change', onLangChange );
	} );
} )();
