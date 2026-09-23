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
 * Free-text search is otherwise untouched: typing doesn't auto-submit
 * on every keystroke.
 */
( function () {
	if ( window.__cellpyBlogFilterAutoSubmitInit ) return;
	window.__cellpyBlogFilterAutoSubmitInit = true;

	function init() {
		document.querySelectorAll( '.blog-filter-widget--auto' ).forEach( function ( form ) {
			form.querySelectorAll( 'select, input[type="checkbox"]' ).forEach( function ( el ) {
				el.addEventListener( 'change', function () {
					form.requestSubmit();
				} );
			} );
			form.classList.add( 'blog-filter-widget--js-ready' );
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
