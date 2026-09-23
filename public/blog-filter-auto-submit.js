/**
 * Progressive enhancement for the blog index's search/filter widget
 * (components/BlogFilterWidget.tsx) when set_blog_filter_widget's
 * submit_mode is "auto" — selecting a category/tag re-submits the
 * widget's GET form immediately instead of waiting for the visitor to
 * press the Search button. The form still works with JS disabled (the
 * button is always rendered); this only adds the auto-apply behavior on
 * top. Only included when submitMode is "auto" — see
 * components/BlogFilterWidget.tsx.
 *
 * Free-text search is untouched: Enter still submits the form natively,
 * but typing doesn't auto-submit on every keystroke.
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
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
