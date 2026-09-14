/**
 * Carousel widget interactivity for the Cellpy carousel block rendered by
 * this template (BSA Phase 21). Host-page script, not sandboxed block
 * content — same architecture as shop.js/booking.js: the block's own HTML
 * (vibemeasite-mcp's lib/carousel-widget-template.ts) is just a fixed,
 * mostly-empty mount point; slide content and arrows/autoplay/transition
 * behavior are all built here from what /api/carousel/slides returns
 * (config + already-resolved slides — entry/product/block, whichever kind
 * each slide is, mixed freely in one carousel).
 */
( function () {
	if ( window.__cellpyCarouselInit ) return;
	window.__cellpyCarouselInit = true;

	var SLIDES_ENDPOINT = '/api/carousel/slides';

	function el( tag, className, text ) {
		var node = document.createElement( tag );
		if ( className ) node.className = className;
		if ( text !== undefined && text !== null ) node.textContent = text;
		return node;
	}

	function formatCents( cents, currency ) {
		var symbol = ( currency || 'usd' ).toLowerCase() === 'usd' ? '$' : ( currency || '' ).toUpperCase() + ' ';
		return symbol + ( cents / 100 ).toFixed( 2 );
	}

	function buildSlideEl( slide ) {
		var wrap = el( 'div', 'vms-carousel__slide' );

		if ( slide.slideType === 'block' ) {
			wrap.innerHTML = slide.html || '';
			if ( slide.css ) {
				var style = document.createElement( 'style' );
				style.textContent = slide.css;
				wrap.appendChild( style );
			}
			return wrap;
		}

		if ( slide.image ) {
			var img = el( 'img', 'vms-carousel__slide-image' );
			img.src = slide.image;
			img.alt = slide.title || '';
			wrap.appendChild( img );
		}
		if ( slide.title ) wrap.appendChild( el( 'h3', 'vms-carousel__slide-title', slide.title ) );
		if ( slide.description ) wrap.appendChild( el( 'p', 'vms-carousel__slide-description', slide.description ) );
		if ( slide.slideType === 'product' && typeof slide.priceCents === 'number' ) {
			var price = el( 'p', 'vms-carousel__slide-price', formatCents( slide.priceCents, slide.currency ) );
			if ( slide.inStock === false ) price.textContent += ' — Out of stock';
			wrap.appendChild( price );
		}
		if ( slide.link ) {
			var a = el( 'a', 'vms-carousel__slide-link', 'Learn more' );
			a.href = slide.link;
			wrap.appendChild( a );
		}
		return wrap;
	}

	function setupWidget( wrapper ) {
		var carouselId = wrapper.getAttribute( 'data-cellpy-carousel' );
		var mount = wrapper.querySelector( '[data-vms-carousel-mount]' );
		if ( ! carouselId || ! mount ) return;

		fetch( SLIDES_ENDPOINT + '?carousel=' + encodeURIComponent( carouselId ) )
			.then( function ( res ) { return res.json(); } )
			.then( function ( json ) {
				if ( ! json || ! json.ok || ! json.slides || json.slides.length === 0 ) {
					mount.innerHTML = '';
					return;
				}
				renderCarousel( mount, json.config || {}, json.slides );
			} )
			.catch( function () { mount.innerHTML = ''; } );
	}

	function renderCarousel( mount, config, slides ) {
		mount.innerHTML = '';

		var track = el( 'div', 'vms-carousel__track' );
		var slideEls = slides.map( buildSlideEl );
		slideEls.forEach( function ( s, i ) {
			s.style.display = i === 0 ? '' : 'none';
			track.appendChild( s );
		} );
		mount.appendChild( track );

		var current = 0;
		var usesFade = config.transition !== 'slide';

		function show( index ) {
			current = ( index + slideEls.length ) % slideEls.length;
			slideEls.forEach( function ( s, i ) {
				if ( usesFade ) {
					s.style.display = i === current ? '' : 'none';
				} else {
					s.style.transform = 'translateX(' + ( 100 * ( i - current ) ) + '%)';
					s.style.display = '';
				}
			} );
			dots.forEach( function ( d, i ) { d.setAttribute( 'aria-current', i === current ? 'true' : 'false' ); } );
		}

		if ( ! usesFade ) {
			track.style.position = 'relative';
			track.style.overflow = 'hidden';
			slideEls.forEach( function ( s ) {
				s.style.position = 'absolute';
				s.style.top = '0';
				s.style.left = '0';
				s.style.width = '100%';
				s.style.transition = 'transform 0.4s ease';
			} );
		}

		if ( config.arrows !== false && slideEls.length > 1 ) {
			var prev = el( 'button', 'vms-carousel__arrow vms-carousel__arrow--prev', '‹' );
			var next = el( 'button', 'vms-carousel__arrow vms-carousel__arrow--next', '›' );
			prev.type = 'button';
			next.type = 'button';
			prev.addEventListener( 'click', function () { show( current - 1 ); resetAutoplay(); } );
			next.addEventListener( 'click', function () { show( current + 1 ); resetAutoplay(); } );
			mount.appendChild( prev );
			mount.appendChild( next );
		}

		var dots = [];
		if ( slideEls.length > 1 ) {
			var dotsWrap = el( 'div', 'vms-carousel__dots' );
			slideEls.forEach( function ( _s, i ) {
				var dot = el( 'button', 'vms-carousel__dot' );
				dot.type = 'button';
				dot.addEventListener( 'click', function () { show( i ); resetAutoplay(); } );
				dotsWrap.appendChild( dot );
				dots.push( dot );
			} );
			mount.appendChild( dotsWrap );
		}

		var timer = null;
		function resetAutoplay() {
			if ( timer ) clearInterval( timer );
			if ( config.autoplay && slideEls.length > 1 ) {
				timer = setInterval( function () { show( current + 1 ); }, config.intervalMs || 5000 );
			}
		}

		show( 0 );
		resetAutoplay();
	}

	function init() {
		document.querySelectorAll( '[data-cellpy-carousel]' ).forEach( setupWidget );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
