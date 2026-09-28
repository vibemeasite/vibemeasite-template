/**
 * Carousel widget interactivity for the Cellpy carousel block rendered by
 * this template (BSA Phase 21). Host-page script, not sandboxed block
 * content — same architecture as shop.js/booking.js: the block's own HTML
 * (vibemeasite-mcp's lib/carousel-widget-template.ts) is just a fixed,
 * mostly-empty mount point; slide content and arrows/autoplay/transition
 * behavior are all built here from what /api/carousel/slides returns
 * (config + already-resolved slides — entry/product/block, whichever kind
 * each slide is, mixed freely in one carousel).
 *
 * v48 — "slide" transition now supports multiple slides per view
 * (config.slidesPerView, responsive across desktop/tablet/mobile), touch
 * swipe (config.swipe), and a true seamless infinite loop (config.loop)
 * via cloned lead/tail slides instead of the old modulo-index jump. The
 * track is an in-flow flex row instead of absolutely-positioned slides, so
 * the mount's height now follows its tallest slide instead of collapsing
 * to zero. "fade" transition is unchanged (always one slide, no loop
 * cloning needed — a crossfade never had a visible "rewind"). All of this
 * is opt-in via config: a carousel with no slidesPerView/loop set behaves
 * exactly as before (1 slide, modulo-wrap jump on wrap), so existing
 * carousels don't change look. Swipe defaults on since it has no visible
 * effect unless a viewer actually drags.
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

	// Shared by both transition modes: builds prev/next arrows and dots,
	// wires them (and autoplay) to a `goTo(index)` callback, and returns a
	// `resetAutoplay` the caller re-invokes after any manual navigation.
	function attachControls( mount, config, slideCount, controller ) {
		var dots = [];

		if ( config.arrows !== false && slideCount > 1 ) {
			var prev = el( 'button', 'vms-carousel__arrow vms-carousel__arrow--prev', '‹' );
			var next = el( 'button', 'vms-carousel__arrow vms-carousel__arrow--next', '›' );
			prev.type = 'button';
			next.type = 'button';
			prev.addEventListener( 'click', function () { controller.prev(); resetAutoplay(); } );
			next.addEventListener( 'click', function () { controller.next(); resetAutoplay(); } );
			mount.appendChild( prev );
			mount.appendChild( next );
		}

		if ( slideCount > 1 ) {
			var dotsWrap = el( 'div', 'vms-carousel__dots' );
			for ( var i = 0; i < slideCount; i++ ) {
				( function ( index ) {
					var dot = el( 'button', 'vms-carousel__dot' );
					dot.type = 'button';
					dot.addEventListener( 'click', function () { controller.goTo( index ); resetAutoplay(); } );
					dotsWrap.appendChild( dot );
					dots.push( dot );
				} )( i );
			}
			mount.appendChild( dotsWrap );
		}

		function updateDots( current ) {
			dots.forEach( function ( d, i ) { d.setAttribute( 'aria-current', i === current ? 'true' : 'false' ); } );
		}

		var timer = null;
		function resetAutoplay() {
			if ( timer ) clearInterval( timer );
			if ( config.autoplay && slideCount > 1 ) {
				timer = setInterval( function () { controller.next(); }, config.intervalMs || 5000 );
			}
		}

		return { updateDots: updateDots, resetAutoplay: resetAutoplay };
	}

	function renderCarousel( mount, config, slides ) {
		mount.innerHTML = '';
		var usesFade = config.transition !== 'slide';
		if ( usesFade || slides.length <= 1 ) {
			renderFade( mount, config, slides );
		} else {
			renderSlideTrack( mount, config, slides );
		}
	}

	// Unchanged from the pre-v48 implementation: one full-bleed slide,
	// cross-faded. Never had a "rewind" problem (nothing slides), so it
	// doesn't need loop cloning or multi-per-view.
	function renderFade( mount, config, slides ) {
		var track = el( 'div', 'vms-carousel__track' );
		var slideEls = slides.map( buildSlideEl );
		slideEls.forEach( function ( s, i ) {
			s.style.display = i === 0 ? '' : 'none';
			track.appendChild( s );
		} );
		mount.appendChild( track );

		var current = 0;
		function show( index ) {
			current = ( index + slideEls.length ) % slideEls.length;
			slideEls.forEach( function ( s, i ) { s.style.display = i === current ? '' : 'none'; } );
			controls.updateDots( current );
		}

		var controls = attachControls( mount, config, slideEls.length, {
			next: function () { show( current + 1 ); },
			prev: function () { show( current - 1 ); },
			goTo: function ( i ) { show( i ); },
		} );

		show( 0 );
		controls.resetAutoplay();
	}

	// Picks slides-per-view for the current viewport width from the
	// (desktop/tablet/mobile) config, each defaulting to 1 so a carousel
	// with no slidesPerView set renders exactly one slide at a time, same
	// as before v48.
	function getPerView( config ) {
		var spv = config.slidesPerView || {};
		var desktop = spv.desktop || 1;
		var tablet = spv.tablet || desktop;
		var mobile = spv.mobile || 1;
		var w = window.innerWidth;
		if ( w < 640 ) return Math.max( 1, mobile );
		if ( w < 1024 ) return Math.max( 1, tablet );
		return Math.max( 1, desktop );
	}

	// Multi-slide-per-view "slide" transition: an in-flow flex track (fixes
	// the old absolute-positioning height collapse), optional seamless loop
	// via cloned lead/tail slides, and optional touch/pointer swipe.
	function renderSlideTrack( mount, config, rawSlides ) {
		var viewport = el( 'div', 'vms-carousel__viewport' );
		viewport.style.overflow = 'hidden';
		viewport.style.position = 'relative';
		var track = el( 'div', 'vms-carousel__track' );
		track.style.display = 'flex';
		track.style.alignItems = 'stretch';
		viewport.appendChild( track );
		mount.appendChild( viewport );

		var realCount = rawSlides.length;
		var slideEls = rawSlides.map( buildSlideEl );
		var perView, loop, trackIndex, current = 0;

		function setFlexBasis() {
			var basis = ( 100 / perView ) + '%';
			slideEls.forEach( function ( s ) { s.style.flex = '0 0 ' + basis; s.style.boxSizing = 'border-box'; } );
		}

		function buildTrackChildren() {
			track.innerHTML = '';
			if ( loop ) {
				rawSlides.slice( -perView ).map( buildSlideEl ).forEach( function ( c ) {
					c.setAttribute( 'aria-hidden', 'true' );
					c.style.flex = '0 0 ' + ( 100 / perView ) + '%';
					c.style.boxSizing = 'border-box';
					track.appendChild( c );
				} );
				slideEls.forEach( function ( s ) { track.appendChild( s ); } );
				rawSlides.slice( 0, perView ).map( buildSlideEl ).forEach( function ( c ) {
					c.setAttribute( 'aria-hidden', 'true' );
					c.style.flex = '0 0 ' + ( 100 / perView ) + '%';
					c.style.boxSizing = 'border-box';
					track.appendChild( c );
				} );
			} else {
				slideEls.forEach( function ( s ) { track.appendChild( s ); } );
			}
		}

		function setPosition( animate ) {
			track.style.transition = animate ? 'transform 0.4s ease' : 'none';
			track.style.transform = 'translateX(' + ( -trackIndex * ( 100 / perView ) ) + '%)';
		}

		function layout() {
			perView = getPerView( config );
			loop = config.loop === true && realCount > perView;
			setFlexBasis();
			buildTrackChildren();
			trackIndex = loop ? perView + current : current;
			setPosition( false );
		}

		function step( dir ) {
			if ( loop ) {
				trackIndex += dir;
				current = ( ( current + dir ) % realCount + realCount ) % realCount;
			} else {
				current = current + dir;
				if ( current < 0 ) current = realCount - 1;
				if ( current > realCount - 1 ) current = 0;
				trackIndex = current;
			}
			setPosition( true );
			controls.updateDots( current );
		}

		function goTo( index ) {
			current = ( index % realCount + realCount ) % realCount;
			trackIndex = loop ? perView + current : current;
			setPosition( true );
			controls.updateDots( current );
		}

		// A step() can animate one slide-width past either end, into the
		// cloned region — once that transition finishes, snap (no
		// transition) back to the equivalent real position. The clone is
		// pixel-identical to what's there, so the snap is invisible.
		track.addEventListener( 'transitionend', function ( e ) {
			if ( e.target !== track || ! loop ) return;
			var minValid = perView;
			var maxValid = perView + realCount - 1;
			if ( trackIndex < minValid || trackIndex > maxValid ) {
				trackIndex = perView + current;
				setPosition( false );
			}
		} );

		var resizeTimer = null;
		window.addEventListener( 'resize', function () {
			clearTimeout( resizeTimer );
			resizeTimer = setTimeout( function () {
				var newPerView = getPerView( config );
				if ( newPerView !== perView ) layout();
			}, 150 );
		} );

		if ( config.swipe !== false ) {
			var dragging = false, dragStartX = 0, dragDeltaPct = 0;
			viewport.style.touchAction = 'pan-y';
			viewport.addEventListener( 'pointerdown', function ( e ) {
				if ( realCount <= perView && ! loop ) return;
				dragging = true;
				dragStartX = e.clientX;
				dragDeltaPct = 0;
				track.style.transition = 'none';
				try { viewport.setPointerCapture( e.pointerId ); } catch ( err ) {}
			} );
			viewport.addEventListener( 'pointermove', function ( e ) {
				if ( ! dragging ) return;
				var width = viewport.getBoundingClientRect().width || 1;
				dragDeltaPct = ( ( e.clientX - dragStartX ) / width ) * 100;
				track.style.transform = 'translateX(' + ( -trackIndex * ( 100 / perView ) + dragDeltaPct ) + '%)';
			} );
			function endDrag() {
				if ( ! dragging ) return;
				dragging = false;
				var threshold = ( 100 / perView ) * 0.2;
				if ( dragDeltaPct <= -threshold ) { step( 1 ); controls.resetAutoplay(); }
				else if ( dragDeltaPct >= threshold ) { step( -1 ); controls.resetAutoplay(); }
				else setPosition( true );
			}
			viewport.addEventListener( 'pointerup', endDrag );
			viewport.addEventListener( 'pointercancel', endDrag );
			viewport.addEventListener( 'pointerleave', function () { if ( dragging ) endDrag(); } );
		}

		var controls = attachControls( mount, config, realCount, {
			next: function () { step( 1 ); },
			prev: function () { step( -1 ); },
			goTo: function ( i ) { goTo( i ); },
		} );

		layout();
		controls.updateDots( current );
		controls.resetAutoplay();
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
