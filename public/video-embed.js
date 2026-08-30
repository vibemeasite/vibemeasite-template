/**
 * Click-to-load video embeds for Cellpy blocks rendered by this template.
 * Host-page script, not sandboxed block content — the Cellpy
 * block-validator strips <iframe> and forbids <script> inside a block, so
 * a block emits only a static facade element and this script injects the
 * real player iframe on click (same architecture as forms.js /
 * lightbox.js / countdown.js). Only included on pages whose block HTML
 * contains `video-embed` — see components/SitePage.tsx's conditional
 * enqueue.
 *
 * Block authoring contract:
 *   <div class="video-embed" data-youtube="dQw4w9WgXcQ"
 *        data-video-title="Product walkthrough"></div>
 *   <div class="video-embed" data-vimeo="76979871"
 *        data-poster="https://cdn.cellpy.com/.../poster.jpg"
 *        data-video-title="Founder story"></div>
 *   - data-youtube / data-vimeo : the video id (exactly one required)
 *   - data-video-title          : used for the iframe title + play-button
 *                                 aria-label (optional but recommended)
 *   - data-poster               : facade thumbnail. Derived from the id
 *                                 for YouTube; REQUIRED for Vimeo (no
 *                                 stable thumbnail URL without an API call)
 *
 * Nothing loads from youtube.com / vimeo.com until the visitor clicks —
 * the facade is a plain <img> + button, so a page with an unplayed embed
 * sets no third-party cookies.
 */
( function () {
	if ( window.__cellpyVideoEmbedInit ) return;
	window.__cellpyVideoEmbedInit = true;

	var WRAP_STYLE =
		'position:relative;width:100%;max-width:100%;aspect-ratio:16/9;' +
		'overflow:hidden;background:#000;border-radius:8px;';
	var POSTER_STYLE =
		'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
		'border:0;display:block;';
	var BUTTON_STYLE =
		'position:absolute;inset:0;width:100%;height:100%;display:flex;' +
		'align-items:center;justify-content:center;background:rgba(0,0,0,0.25);' +
		'border:0;cursor:pointer;padding:0;transition:background 150ms ease;';
	var GLYPH_STYLE =
		'display:flex;align-items:center;justify-content:center;width:68px;' +
		'height:48px;border-radius:12px;background:rgba(0,0,0,0.75);' +
		'color:#fff;font-size:24px;line-height:1;';
	var IFRAME_STYLE = 'position:absolute;inset:0;width:100%;height:100%;border:0;';

	function youtubePoster( id ) {
		return 'https://i.ytimg.com/vi/' + encodeURIComponent( id ) + '/hqdefault.jpg';
	}

	function playerSrc( provider, id ) {
		if ( provider === 'youtube' ) {
			return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent( id ) +
				'?autoplay=1&rel=0';
		}
		return 'https://player.vimeo.com/video/' + encodeURIComponent( id ) + '?autoplay=1';
	}

	function hydrate( el ) {
		var ytId = el.getAttribute( 'data-youtube' );
		var vimeoId = el.getAttribute( 'data-vimeo' );
		var provider = ytId ? 'youtube' : vimeoId ? 'vimeo' : null;
		if ( ! provider ) return;

		var id = provider === 'youtube' ? ytId : vimeoId;
		var title = el.getAttribute( 'data-video-title' ) || 'Video';
		var poster = el.getAttribute( 'data-poster' ) ||
			( provider === 'youtube' ? youtubePoster( id ) : '' );

		el.style.cssText = WRAP_STYLE;
		el.textContent = '';

		if ( poster ) {
			var img = document.createElement( 'img' );
			img.src = poster;
			img.alt = '';
			img.loading = 'lazy';
			img.style.cssText = POSTER_STYLE;
			el.appendChild( img );
		}

		var button = document.createElement( 'button' );
		button.type = 'button';
		button.setAttribute( 'aria-label', 'Play: ' + title );
		button.style.cssText = BUTTON_STYLE;

		var glyph = document.createElement( 'span' );
		glyph.setAttribute( 'aria-hidden', 'true' );
		glyph.textContent = '▶';
		glyph.style.cssText = GLYPH_STYLE;
		button.appendChild( glyph );

		button.addEventListener( 'mouseenter', function () {
			button.style.background = 'rgba(0,0,0,0.1)';
		} );
		button.addEventListener( 'mouseleave', function () {
			button.style.background = 'rgba(0,0,0,0.25)';
		} );

		button.addEventListener( 'click', function () {
			var iframe = document.createElement( 'iframe' );
			iframe.src = playerSrc( provider, id );
			iframe.title = title;
			iframe.allow =
				'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
			iframe.setAttribute( 'allowfullscreen', '' );
			iframe.style.cssText = IFRAME_STYLE;
			el.textContent = '';
			el.appendChild( iframe );
		} );

		el.appendChild( button );
	}

	function start() {
		document.querySelectorAll( '.video-embed' ).forEach( hydrate );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
} )();
