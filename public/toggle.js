/**
 * Cross-block content toggles for Cellpy blocks rendered by this template
 * (e.g. a Monthly / Annual pricing switch that updates prices in several
 * different sections at once). Host-page script — the block-validator
 * forbids <script> and on*= handlers in a block, and a block's own CSS is
 * rewritten to be scoped to that block, so it can't react to a state
 * change owned by a sibling block. This script owns the state and flips
 * the plain `hidden` attribute on marked elements anywhere on the page.
 * Only included when a page's block HTML contains `data-set` — see
 * components/SitePage.tsx.
 *
 * Block authoring contract (no CSS needed, pure hidden toggling):
 *   <!-- the switch: one button per value in a named group -->
 *   <button type="button" data-set="billing:monthly" data-set-default>Monthly</button>
 *   <button type="button" data-set="billing:annual">Annual</button>
 *
 *   <!-- anything that should show only for a given value -->
 *   <span data-when="billing:monthly">$35</span>
 *   <span data-when="billing:annual">$29</span>
 *
 *   - data-set="<group>:<value>"   — a toggle button. Mark one per group
 *                                    data-set-default (falls back to the
 *                                    first button of the group).
 *   - data-when="<group>:<value>"  — shown only while that group's current
 *                                    value matches; otherwise `hidden`.
 *   - the active button in a group gets aria-pressed="true".
 * Groups are independent; a page can have several.
 */
( function () {
	if ( window.__cellpyToggleInit ) return;
	window.__cellpyToggleInit = true;

	var state = {}; // group -> current value

	function parse( v ) {
		var i = v.indexOf( ':' );
		return i === -1 ? null : { group: v.slice( 0, i ), value: v.slice( i + 1 ) };
	}

	function apply( group ) {
		var current = state[ group ];
		document.querySelectorAll( '[data-when]' ).forEach( function ( el ) {
			var p = parse( el.getAttribute( 'data-when' ) );
			if ( ! p || p.group !== group ) return;
			el.hidden = p.value !== current;
		} );
		document.querySelectorAll( '[data-set]' ).forEach( function ( btn ) {
			var p = parse( btn.getAttribute( 'data-set' ) );
			if ( ! p || p.group !== group ) return;
			btn.setAttribute( 'aria-pressed', String( p.value === current ) );
		} );
	}

	function init() {
		var buttons = document.querySelectorAll( '[data-set]' );
		// resolve each group's default
		buttons.forEach( function ( btn ) {
			var p = parse( btn.getAttribute( 'data-set' ) );
			if ( ! p ) return;
			if ( ! ( p.group in state ) ) state[ p.group ] = p.value; // first seen
			if ( btn.hasAttribute( 'data-set-default' ) ) state[ p.group ] = p.value;
		} );

		buttons.forEach( function ( btn ) {
			btn.addEventListener( 'click', function ( e ) {
				e.preventDefault();
				var p = parse( btn.getAttribute( 'data-set' ) );
				if ( ! p ) return;
				state[ p.group ] = p.value;
				apply( p.group );
			} );
		} );

		Object.keys( state ).forEach( apply );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
