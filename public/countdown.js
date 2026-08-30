/**
 * Live countdown for Cellpy blocks rendered by this template.
 * Host-page script, not sandboxed block content — the Cellpy
 * block-validator forbids <script> inside a block, so a block can only
 * emit the static target element and this script fills it in from the
 * outside (same architecture as forms.js / lightbox.js). Only included on
 * pages whose block HTML contains `data-countdown` — see
 * components/SitePage.tsx's conditional enqueue.
 *
 * Block authoring contract:
 *   <span data-countdown="2026-09-15T18:00:00Z"
 *         data-countdown-ended="Registration closed"></span>
 *   - data-countdown        : ISO 8601 target instant (required)
 *   - data-countdown-ended  : text shown once the target passes
 *                             (optional; the element is emptied if absent)
 *
 * Unit labels are language-neutral abbreviations for now (d/h/m/s); a
 * future i18n pass can read data-countdown-labels or documentElement.lang.
 */
( function () {
	if ( window.__cellpyCountdownInit ) return;
	window.__cellpyCountdownInit = true;

	var nodes = [];

	function collect() {
		nodes = [];
		document.querySelectorAll( '[data-countdown]' ).forEach( function ( el ) {
			var target = Date.parse( el.getAttribute( 'data-countdown' ) );
			if ( isNaN( target ) ) return;
			nodes.push( { el: el, target: target, ended: false } );
		} );
	}

	function format( ms ) {
		var total = Math.floor( ms / 1000 );
		var days = Math.floor( total / 86400 );
		var hours = Math.floor( ( total % 86400 ) / 3600 );
		var mins = Math.floor( ( total % 3600 ) / 60 );
		var secs = total % 60;

		function pad( n ) {
			return n < 10 ? '0' + n : String( n );
		}

		var parts = [];
		if ( days > 0 ) parts.push( days + 'd' );
		if ( days > 0 || hours > 0 ) parts.push( pad( hours ) + 'h' );
		parts.push( pad( mins ) + 'm' );
		parts.push( pad( secs ) + 's' );
		return parts.join( ' ' );
	}

	function tick() {
		var now = Date.now();
		var live = false;

		nodes.forEach( function ( node ) {
			if ( node.ended ) return;
			var remaining = node.target - now;

			if ( remaining <= 0 ) {
				node.ended = true;
				var endedText = node.el.getAttribute( 'data-countdown-ended' );
				node.el.textContent = endedText || '';
				return;
			}

			live = true;
			node.el.textContent = format( remaining );
		} );

		if ( live ) {
			window.setTimeout( tick, 1000 );
		}
	}

	function start() {
		collect();
		if ( nodes.length ) tick();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
} )();
