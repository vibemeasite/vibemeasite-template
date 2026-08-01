/**
 * Image lightbox for Cellpy blocks rendered by this template.
 * Host-page script, not sandboxed block content — position: fixed is fine
 * here even though the Cellpy block-validator forbids it in block CSS
 * (platform/docs/bsa-documentation.md, US-VAL-01 Principle 3). Same
 * architecture as forms.js: binds behavior to already-rendered block
 * markup from the outside. See vibemeasite/docs/bsa-documentation-vibemeasite-service.md,
 * US-VMAS-CHAT-05. Only included on pages that render an img.cellpy-lightbox —
 * see components/SitePage.tsx.
 */
( function () {
	var OVERLAY_ID = 'cellpy-lightbox-overlay';
	var NAV_BTN_STYLE =
		'position:fixed;top:50%;transform:translateY(-50%);font-size:3rem;' +
		'line-height:1;color:#fff;background:none;border:0;cursor:pointer;' +
		'padding:8px 16px;';
	var lastTrigger = null;
	var gallery = [];
	var galleryIndex = -1;

	function buildOverlay() {
		var overlay = document.createElement( 'div' );
		overlay.id = OVERLAY_ID;
		overlay.className = 'cellpy-lightbox-overlay';
		overlay.setAttribute( 'role', 'dialog' );
		overlay.setAttribute( 'aria-modal', 'true' );
		overlay.style.cssText =
			'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;' +
			'justify-content:center;padding:5vh 5vw;background:rgba(0,0,0,0.85);' +
			'opacity:0;transition:opacity 150ms ease;';

		var img = document.createElement( 'img' );
		img.className = 'cellpy-lightbox-image';
		img.style.cssText =
			'max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,0.5);';
		overlay.appendChild( img );

		var closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.className = 'cellpy-lightbox-close';
		closeBtn.setAttribute( 'aria-label', 'Close' );
		closeBtn.textContent = '×';
		closeBtn.style.cssText =
			'position:fixed;top:16px;right:24px;font-size:2.5rem;line-height:1;' +
			'color:#fff;background:none;border:0;cursor:pointer;padding:8px;';
		overlay.appendChild( closeBtn );

		var prevBtn = document.createElement( 'button' );
		prevBtn.type = 'button';
		prevBtn.className = 'cellpy-lightbox-prev';
		prevBtn.setAttribute( 'aria-label', 'Previous image' );
		prevBtn.textContent = '‹';
		prevBtn.style.cssText = NAV_BTN_STYLE + 'left:8px;';
		prevBtn.addEventListener( 'click', function ( e ) {
			e.stopPropagation();
			step( -1 );
		} );
		overlay.appendChild( prevBtn );

		var nextBtn = document.createElement( 'button' );
		nextBtn.type = 'button';
		nextBtn.className = 'cellpy-lightbox-next';
		nextBtn.setAttribute( 'aria-label', 'Next image' );
		nextBtn.textContent = '›';
		nextBtn.style.cssText = NAV_BTN_STYLE + 'right:8px;';
		nextBtn.addEventListener( 'click', function ( e ) {
			e.stopPropagation();
			step( 1 );
		} );
		overlay.appendChild( nextBtn );

		overlay.addEventListener( 'click', function ( e ) {
			if ( e.target === overlay || e.target === closeBtn ) {
				close();
			}
		} );

		document.body.appendChild( overlay );
		return overlay;
	}

	function getOverlay() {
		return document.getElementById( OVERLAY_ID ) || buildOverlay();
	}

	// Images authored within the same block share a wrapper div named
	// cellpy-block-{slug} (components/CellpyBlock.tsx) — that's the natural
	// gallery boundary, since unrelated images elsewhere on the page (e.g. a
	// hero photo and a testimonial photo) live in different blocks and
	// shouldn't be steppable into each other.
	function findGallery( img ) {
		var scope = img.closest( '[class*="cellpy-block-"]' ) || document;
		return Array.prototype.slice.call(
			scope.querySelectorAll( 'img.cellpy-lightbox' )
		);
	}

	function showImage( index ) {
		var overlay = getOverlay();
		var full = overlay.querySelector( '.cellpy-lightbox-image' );
		var img = gallery[ index ];
		full.src = img.currentSrc || img.src;
		full.alt = img.alt || '';
		galleryIndex = index;

		var showNav = gallery.length > 1;
		overlay.querySelector( '.cellpy-lightbox-prev' ).style.display = showNav ? '' : 'none';
		overlay.querySelector( '.cellpy-lightbox-next' ).style.display = showNav ? '' : 'none';
	}

	function step( delta ) {
		if ( gallery.length < 2 ) {
			return;
		}
		showImage( ( galleryIndex + delta + gallery.length ) % gallery.length );
	}

	function open( img ) {
		var overlay = getOverlay();

		gallery = findGallery( img );
		showImage( gallery.indexOf( img ) );

		lastTrigger = img;
		document.body.style.overflow = 'hidden';
		overlay.style.display = 'flex';
		// Force layout before transitioning opacity so it actually animates.
		overlay.getBoundingClientRect();
		overlay.style.opacity = '1';

		document.addEventListener( 'keydown', onKeydown );
		overlay.querySelector( '.cellpy-lightbox-close' ).focus();
	}

	function close() {
		var overlay = document.getElementById( OVERLAY_ID );
		if ( ! overlay ) {
			return;
		}
		overlay.style.opacity = '0';
		document.body.style.overflow = '';
		document.removeEventListener( 'keydown', onKeydown );
		setTimeout( function () {
			overlay.style.display = 'none';
		}, 150 );

		if ( lastTrigger ) {
			lastTrigger.focus();
			lastTrigger = null;
		}
		gallery = [];
		galleryIndex = -1;
	}

	function onKeydown( e ) {
		if ( 'Escape' === e.key ) {
			close();
		} else if ( 'ArrowLeft' === e.key ) {
			step( -1 );
		} else if ( 'ArrowRight' === e.key ) {
			step( 1 );
		}
	}

	function init() {
		document.querySelectorAll( 'img.cellpy-lightbox' ).forEach( function ( img ) {
			img.style.cursor = 'zoom-in';
			img.addEventListener( 'click', function ( e ) {
				e.preventDefault();
				open( img );
			} );
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
