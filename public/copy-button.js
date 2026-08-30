/**
 * Copy-to-clipboard buttons for Cellpy blocks rendered by this template.
 * Host-page script, not sandboxed block content — the block-validator
 * forbids <script> and on*= handlers inside a block, so a block emits a
 * plain button and this script wires the copy behavior from the outside
 * (same architecture as forms.js / lightbox.js / countdown.js). Only
 * included on pages whose block HTML contains `data-copy` — see
 * components/SitePage.tsx's conditional enqueue.
 *
 * Block authoring contract — one of:
 *   <button type="button" data-copy="mcp.example.com/mcp">Copy</button>
 *   <button type="button" data-copy-target="#connection-url">Copy</button>
 *   - data-copy         : literal text to copy
 *   - data-copy-target  : CSS selector of an element whose textContent
 *                         (or value, for inputs) is copied
 *   - data-copied-label : optional confirmation text (default "Copied!")
 * On success the button's text is swapped to the confirmation for ~1.6s,
 * and it gets a `data-copied` attribute for the duration (style it in
 * block CSS if you want a colour change).
 */
( function () {
	if ( window.__cellpyCopyInit ) return;
	window.__cellpyCopyInit = true;

	function resolveText( btn ) {
		var literal = btn.getAttribute( 'data-copy' );
		if ( literal !== null && literal !== '' ) return literal;
		var sel = btn.getAttribute( 'data-copy-target' );
		if ( sel ) {
			var el = document.querySelector( sel );
			if ( el ) return 'value' in el && el.value !== undefined ? el.value : el.textContent || '';
		}
		return '';
	}

	function flash( btn ) {
		var original = btn.getAttribute( 'data-original-label' );
		if ( original === null ) {
			original = btn.textContent;
			btn.setAttribute( 'data-original-label', original );
		}
		btn.textContent = btn.getAttribute( 'data-copied-label' ) || 'Copied!';
		btn.setAttribute( 'data-copied', '' );
		window.clearTimeout( btn.__cellpyCopyTimer );
		btn.__cellpyCopyTimer = window.setTimeout( function () {
			btn.textContent = original;
			btn.removeAttribute( 'data-copied' );
		}, 1600 );
	}

	function copy( text, btn ) {
		if ( ! text ) return;
		if ( navigator.clipboard && navigator.clipboard.writeText ) {
			navigator.clipboard.writeText( text ).then(
				function () { flash( btn ); },
				function () { legacyCopy( text, btn ); }
			);
		} else {
			legacyCopy( text, btn );
		}
	}

	function legacyCopy( text, btn ) {
		try {
			var ta = document.createElement( 'textarea' );
			ta.value = text;
			ta.setAttribute( 'readonly', '' );
			ta.style.position = 'absolute';
			ta.style.left = '-9999px';
			document.body.appendChild( ta );
			ta.select();
			document.execCommand( 'copy' );
			document.body.removeChild( ta );
			flash( btn );
		} catch ( e ) {
			/* give up silently — nothing worse than a no-op button */
		}
	}

	document.addEventListener( 'click', function ( event ) {
		var btn = event.target.closest ? event.target.closest( '[data-copy], [data-copy-target]' ) : null;
		if ( ! btn ) return;
		event.preventDefault();
		copy( resolveText( btn ), btn );
	} );
} )();
