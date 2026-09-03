/**
 * BSA Phase 16 — progressive enhancement for entity directories rendered by
 * <EntityList> (components/EntityList.tsx). The server already renders the
 * first page, the search form (a plain GET), and the facet <select>s, so
 * the directory works with no JS. This script adds two things on top:
 *
 *   1. Instant client-side filter: typing in the search box hides
 *      already-rendered .entry cards that don't match, for immediate
 *      feedback. Submitting the form still does the authoritative GET
 *      (which also re-runs the server search + facets + pagination).
 *   2. Infinite scroll: when a [data-entry-sentinel] scrolls into view,
 *      fetch the next page fragment from /api/entries/{slug} and append it.
 *
 * Only loaded when a page's block HTML contains `data-entity=` — see
 * components/SitePage.tsx.
 */
( function () {
	if ( window.__cellpyDirectoryInit ) return;
	window.__cellpyDirectoryInit = true;

	function debounce( fn, ms ) {
		var t;
		return function () {
			var args = arguments;
			clearTimeout( t );
			t = setTimeout( function () {
				fn.apply( null, args );
			}, ms );
		};
	}

	/* ---- 1. instant client filter ---- */
	function wireFilter( wrap ) {
		var input = wrap.querySelector( '.entry-search__q' );
		if ( ! input ) return;
		var list = wrap.querySelector( '.entry-list' );
		if ( ! list ) return;

		var run = debounce( function () {
			var q = input.value.trim().toLowerCase();
			var cards = list.querySelectorAll( '.entry' );
			var shown = 0;
			cards.forEach( function ( card ) {
				var match = q === '' || card.textContent.toLowerCase().indexOf( q ) !== -1;
				card.hidden = ! match;
				if ( match ) shown++;
			} );
			var empty = wrap.querySelector( '.entry-empty' );
			if ( empty ) empty.hidden = shown !== 0 || q === '';
		}, 120 );

		input.addEventListener( 'input', run );
	}

	/* ---- 2. infinite scroll ---- */
	function wireInfinite( wrap ) {
		var slug = wrap.getAttribute( 'data-entry-list' );
		var list = wrap.querySelector( '.entry-list' );
		if ( ! slug || ! list || typeof IntersectionObserver === 'undefined' ) return;

		var loading = false;

		// JS drives pagination now — the no-JS "Show more" link is redundant
		// (and would do a full-page navigation), so hide it.
		var moreLink = wrap.querySelector( '.entry-more' );
		if ( moreLink ) moreLink.hidden = true;

		function currentSentinel() {
			return wrap.querySelector( '[data-entry-sentinel]' );
		}

		function loadNext( sentinel ) {
			if ( loading ) return;
			var next = sentinel.getAttribute( 'data-next' );
			if ( ! next ) return;
			loading = true;

			var params = new URLSearchParams( window.location.search );
			params.set( 'page', next );
			// Multi-language entries (v22) — the directory's resolved language
			// isn't in the page URL (it comes from a "/uk/" path prefix or a
			// cookie), so carry it explicitly from the wrap's data-lang.
			var lang = sentinel.getAttribute( 'data-lang' ) || wrap.getAttribute( 'data-lang' );
			if ( lang ) params.set( 'lang', lang );

			fetch( '/api/entries/' + encodeURIComponent( slug ) + '?' + params.toString(), {
				headers: { 'Accept': 'text/html' },
			} )
				.then( function ( r ) {
					return r.ok ? r.text() : '';
				} )
				.then( function ( html ) {
					loading = false;
					sentinel.remove();
					if ( ! html ) return;
					var tmp = document.createElement( 'div' );
					tmp.innerHTML = html;
					var newSentinel = tmp.querySelector( '[data-entry-sentinel]' );
					var frag = document.createDocumentFragment();
					Array.prototype.slice.call( tmp.querySelectorAll( '.entry' ) ).forEach( function ( el ) {
						frag.appendChild( el );
					} );
					list.appendChild( frag );
					if ( newSentinel ) {
						wrap.appendChild( newSentinel );
						observe( newSentinel );
					}
				} )
				.catch( function () {
					loading = false;
				} );
		}

		var io = new IntersectionObserver(
			function ( entries ) {
				entries.forEach( function ( e ) {
					if ( e.isIntersecting ) loadNext( e.target );
				} );
			},
			{ rootMargin: '400px 0px' }
		);

		function observe( el ) {
			io.observe( el );
		}

		var first = currentSentinel();
		if ( first ) observe( first );
	}

	function init() {
		document.querySelectorAll( '[data-entry-list]' ).forEach( function ( wrap ) {
			wireFilter( wrap );
			wireInfinite( wrap );
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
