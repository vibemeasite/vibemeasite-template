/**
 * Progressive enhancement for the blog index's search/filter widget
 * (components/BlogFilterWidget.tsx) when set_blog_filter_widget's
 * submit_mode is "auto" — selecting a category/tag re-submits the
 * widget's GET form immediately instead of waiting for the visitor to
 * press the Search button. The form still works with JS disabled (the
 * button is always rendered in markup); this only adds the auto-apply
 * behavior on top. Only included when submitMode is "auto" — see
 * components/BlogFilterWidget.tsx.
 *
 * Once this script actually runs, the Search button becomes redundant
 * for chip/dropdown selections (they submit themselves) and for
 * free-text search (Enter in a lone text field submits the form
 * natively, with or without a visible button) — so it's hidden via the
 * blog-filter-widget--js-ready class added below (CSS in
 * app/globals.css), not removed from markup. A visitor with JS
 * disabled never gets this class and keeps the visible button, which
 * is the only way they can submit a chip/checkbox selection at all.
 *
 * Free-text search also auto-submits, debounced: once the field holds
 * at least 3 characters (trimmed), a 1.5-second pause in typing submits
 * the form. Typing more before the 1.5 seconds is up resets the timer,
 * same as a normal search-as-you-type debounce. Enter (or the button,
 * with JS disabled) still works at any length regardless of the above.
 *
 * Dropping back below 3 characters (including back to empty, e.g. by
 * backspacing) does NOT search on that 1-2 character fragment — instead
 * it debounces submitting an EMPTY query, the same way, so a
 * previously-applied longer search actually clears instead of staying
 * stuck once the visitor backs out of it.
 */
( function () {
	if ( window.__cellpyBlogFilterAutoSubmitInit ) return;
	window.__cellpyBlogFilterAutoSubmitInit = true;

	var SEARCH_MIN_CHARS = 3;
	var SEARCH_DEBOUNCE_MS = 1500;

	function init() {
		document.querySelectorAll( '.blog-filter-widget--auto' ).forEach( function ( form ) {
			form.querySelectorAll( 'select, input[type="checkbox"]' ).forEach( function ( el ) {
				el.addEventListener( 'change', function () {
					form.requestSubmit();
				} );
			} );

			var searchInput = form.querySelector( 'input[type="search"]' );
			if ( searchInput ) {
				var debounceTimer = null;
				searchInput.addEventListener( 'input', function () {
					if ( debounceTimer ) clearTimeout( debounceTimer );
					if ( searchInput.value.trim().length < SEARCH_MIN_CHARS ) {
						// Below the minimum (including empty) — don't search on a
						// 1-2 character fragment, but still debounce clearing any
						// previously-applied longer query. The page navigates
						// away on submit, so blanking the field here needs no
						// restore.
						debounceTimer = setTimeout( function () {
							searchInput.value = '';
							form.requestSubmit();
						}, SEARCH_DEBOUNCE_MS );
						return;
					}
					debounceTimer = setTimeout( function () {
						form.requestSubmit();
					}, SEARCH_DEBOUNCE_MS );
				} );
			}

			form.classList.add( 'blog-filter-widget--js-ready' );
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
