/**
 * Google Business Profile reviews widget interactivity (BSA Phase 17).
 * Host-page script, not sandboxed block content — same architecture as
 * booking.js / forms.js: the block's own HTML
 * (vibemeasite-mcp's lib/google-reviews-template.ts) is a fixed, mostly-empty
 * mount point; all UI here is built with plain DOM APIs and styled entirely
 * by whatever CSS the Site Owner's block carries, against the class-name
 * contract documented alongside that skeleton. Only included on pages that
 * render a reviews widget block — see components/SitePage.tsx.
 *
 * The .vms-reviews__attribution "Reviews from Google" link and the per-card
 * link to the business's Google reviews page are always rendered here — they
 * are required by Google's brand terms and are not the Site Owner's to hide.
 */
( function () {
	if ( window.__cellpyReviewsInit ) return;
	window.__cellpyReviewsInit = true;

	// Same cellpy_lang cookie middleware.ts sets for block content. Only used
	// for the relative-date formatter's locale here.
	function currentLang() {
		var m = document.cookie.match( /(?:^|; )cellpy_lang=([^;]+)/ );
		return m ? decodeURIComponent( m[ 1 ] ) : '';
	}

	function el( tag, className, text ) {
		var n = document.createElement( tag );
		if ( className ) n.className = className;
		if ( undefined !== text ) n.textContent = text;
		return n;
	}

	function emptyLine( mount, text ) {
		mount.innerHTML = '';
		mount.appendChild( el( 'p', 'vms-reviews__empty', text ) );
	}

	function stars( n ) {
		var wrap = el( 'span', 'vms-reviews__stars' );
		wrap.setAttribute( 'role', 'img' );
		wrap.setAttribute( 'aria-label', n + ' out of 5' );
		for ( var i = 1; i <= 5; i++ ) {
			var s = el( 'span', null, i <= n ? '★' : '☆' );
			if ( i > n ) s.setAttribute( 'data-empty', '' );
			s.setAttribute( 'aria-hidden', 'true' );
			wrap.appendChild( s );
		}
		return wrap;
	}

	function relTime( iso, lang ) {
		try {
			var then = new Date( iso ).getTime();
			if ( isNaN( then ) ) return '';
			var diffDays = Math.round( ( Date.now() - then ) / 86400000 );
			var rtf = new Intl.RelativeTimeFormat( lang || 'en', { numeric: 'auto' } );
			if ( diffDays < 1 ) return rtf.format( 0, 'day' );
			if ( diffDays < 30 ) return rtf.format( -diffDays, 'day' );
			if ( diffDays < 365 ) return rtf.format( -Math.round( diffDays / 30 ), 'month' );
			return rtf.format( -Math.round( diffDays / 365 ), 'year' );
		} catch ( e ) {
			try {
				return new Date( iso ).toLocaleDateString( lang || undefined );
			} catch ( e2 ) {
				return '';
			}
		}
	}

	function initials( name ) {
		var parts = String( name || '' ).trim().split( /\s+/ ).slice( 0, 2 );
		return parts.map( function ( p ) { return p.charAt( 0 ).toUpperCase(); } ).join( '' ) || '?';
	}

	function avatar( review ) {
		if ( review.authorPhotoUrl ) {
			var img = el( 'img', 'vms-reviews__avatar' );
			img.src = review.authorPhotoUrl;
			img.alt = '';
			img.loading = 'lazy';
			img.referrerPolicy = 'no-referrer';
			img.onerror = function () {
				var span = el( 'span', 'vms-reviews__avatar', initials( review.authorName ) );
				if ( img.parentNode ) img.parentNode.replaceChild( span, img );
			};
			return img;
		}
		return el( 'span', 'vms-reviews__avatar', initials( review.authorName ) );
	}

	var CLAMP_AT = 240;

	function card( review, lang ) {
		var c = el( 'article', 'vms-reviews__card' );

		var head = el( 'div', 'vms-reviews__rating' );
		head.appendChild( avatar( review ) );
		var who = el( 'div' );
		who.appendChild( el( 'span', 'vms-reviews__author', review.authorName ) );
		who.appendChild( stars( review.starRating ) );
		head.appendChild( who );
		c.appendChild( head );

		if ( review.comment ) {
			var text = el( 'p', 'vms-reviews__text', review.comment );
			if ( review.comment.length > CLAMP_AT ) {
				text.classList.add( 'vms-reviews__text--clamped' );
				var more = el( 'button', 'vms-reviews__more', 'Read more' );
				more.type = 'button';
				more.addEventListener( 'click', function () {
					var clamped = text.classList.toggle( 'vms-reviews__text--clamped' );
					more.textContent = clamped ? 'Read more' : 'Show less';
				} );
				c.appendChild( text );
				c.appendChild( more );
			} else {
				c.appendChild( text );
			}
		}

		if ( review.ownerReply && review.ownerReply.comment ) {
			var reply = el( 'div', 'vms-reviews__reply' );
			reply.appendChild( el( 'strong', null, 'Response from the owner' ) );
			reply.appendChild( document.createTextNode( review.ownerReply.comment ) );
			c.appendChild( reply );
		}

		var date = el( review.googleReviewUrl ? 'a' : 'span', 'vms-reviews__date', relTime( review.updateTime, lang ) );
		if ( review.googleReviewUrl ) {
			date.href = review.googleReviewUrl;
			date.target = '_blank';
			date.rel = 'nofollow noopener';
		}
		c.appendChild( date );

		return c;
	}

	function render( mount, data, lang ) {
		mount.innerHTML = '';

		var header = el( 'div', 'vms-reviews__header' );
		if ( typeof data.averageRating === 'number' ) {
			header.appendChild( el( 'span', 'vms-reviews__avg', data.averageRating.toFixed( 1 ) ) );
			header.appendChild( stars( Math.round( data.averageRating ) ) );
		}
		if ( data.totalReviewCount ) {
			header.appendChild( el( 'span', 'vms-reviews__count', data.totalReviewCount + ( data.totalReviewCount === 1 ? ' review' : ' reviews' ) ) );
		}
		if ( header.childNodes.length ) mount.appendChild( header );

		var list = el( 'div', 'vms-reviews__list vms-reviews__list--' + ( data.style === 'list' ? 'list' : 'grid' ) );
		data.reviews.forEach( function ( r ) { list.appendChild( card( r, lang ) ); } );
		mount.appendChild( list );

		var attr = el( 'div', 'vms-reviews__attribution' );
		var link = el( 'a', null, 'Reviews from Google' );
		var href = ( data.reviews[ 0 ] && data.reviews[ 0 ].googleReviewUrl ) || 'https://www.google.com/maps';
		link.href = href;
		link.target = '_blank';
		link.rel = 'nofollow noopener';
		attr.appendChild( link );
		mount.appendChild( attr );
	}

	function load( wrapper, isRetry ) {
		var id = wrapper.getAttribute( 'data-cellpy-google-reviews' );
		var mount = wrapper.querySelector( '[data-vms-reviews-mount]' );
		if ( ! id || ! mount ) return;
		var lang = currentLang();

		fetch( '/api/reviews/data?widget=' + encodeURIComponent( id ) + ( lang ? '&lang=' + encodeURIComponent( lang ) : '' ) )
			.then( function ( res ) { return res.json().catch( function () { return { ok: false }; } ); } )
			.then( function ( data ) {
				if ( ! data || data.ok === false ) {
					emptyLine( mount, 'Reviews are unavailable right now.' );
					return;
				}
				if ( data.connected === false ) {
					emptyLine( mount, 'No Google reviews to show yet.' );
					return;
				}
				if ( data.pending ) {
					if ( isRetry ) {
						emptyLine( mount, 'Reviews are still loading — check back shortly.' );
					} else {
						setTimeout( function () { load( wrapper, true ); }, 3000 );
					}
					return;
				}
				if ( ! data.reviews || data.reviews.length === 0 ) {
					emptyLine( mount, 'No reviews to show yet.' );
					return;
				}
				render( mount, data, lang );
			} )
			.catch( function () {
				emptyLine( mount, 'Reviews are unavailable right now.' );
			} );
	}

	function init() {
		var widgets = document.querySelectorAll( '[data-cellpy-google-reviews]' );
		for ( var i = 0; i < widgets.length; i++ ) load( widgets[ i ], false );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
