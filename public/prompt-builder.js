/**
 * Live prompt-scaffold assembler for the "Prompt Builder" tool block
 * (vibemeasite.com marketing page). Host-page script, not sandboxed block
 * content — the block-validator forbids <script> inside a block, so a block
 * emits plain checkboxes/inputs/textareas (is_form: true unlocks those tags)
 * and this script wires the live-preview behavior from the outside (same
 * architecture as booking.js / carousel.js / toggle.js). Only included on
 * pages whose block HTML contains `data-cellpy-prompt-builder` — see
 * components/SitePage.tsx's conditional enqueue. Copy-to-clipboard is handled
 * by the existing generic copy-button.js via a `data-copy-target` button —
 * this script only owns building the text.
 *
 * Block authoring contract:
 *   <div data-cellpy-prompt-builder>
 *     <input data-pb-field="business_name" type="text">
 *     <textarea data-pb-field="description"></textarea>
 *     <input type="checkbox" data-pb-group="pages" value="the Home page">
 *     ...
 *     <textarea id="pb-output" readonly></textarea>
 *   </div>
 * - data-pb-field="<key>" : a text input/textarea. Its value is inserted
 *                           verbatim next to FIELD_LABELS[key].
 * - data-pb-group="<key>" : a checkbox. Its `value` attribute is the exact
 *                           clause inserted under GROUP_LABELS[key] when
 *                           checked (not its visible label text).
 * - #pb-output            : where the assembled prompt text is written.
 * Field/group keys not present in the maps below still render, using the
 * raw key as a fallback heading/label.
 */
( function () {
	if ( window.__cellpyPromptBuilderInit ) return;
	window.__cellpyPromptBuilderInit = true;

	var FIELD_LABELS = {
		business_name: 'Business / site name',
		industry: 'Industry / niche',
		location: 'Location / service area',
		tagline: 'Tagline',
		description: 'Description',
		audience: 'Target audience',
		languages: 'Languages to support',
		colors: 'Preferred colors / mood',
		extra: 'Anything else'
	};

	var GROUP_LABELS = {
		site_type: 'Type of site',
		pages: 'Pages to include',
		commerce: 'Booking & commerce',
		leads: 'Lead capture & communication',
		legal: 'Trust & legal',
		seo: 'SEO & reach',
		structure: 'Structure & style',
		tone: 'Tone of voice'
	};

	// Order sections appear in the assembled prompt.
	var FIELD_ORDER = [ 'business_name', 'industry', 'location', 'tagline', 'description', 'audience' ];
	var GROUP_ORDER = [ 'site_type', 'pages', 'commerce', 'leads', 'legal', 'seo', 'structure', 'tone' ];
	var TRAILING_FIELD_ORDER = [ 'languages', 'colors', 'extra' ];

	var PLACEHOLDER = 'Fill in your business details and check a few boxes on the left — your prompt will build itself here.';

	function fieldLabel( key ) { return FIELD_LABELS[ key ] || key; }
	function groupLabel( key ) { return GROUP_LABELS[ key ] || key; }

	function buildPrompt( root ) {
		var lines = [];

		var basics = [];
		FIELD_ORDER.forEach( function ( key ) {
			var el = root.querySelector( '[data-pb-field="' + key + '"]' );
			var val = el && el.value ? el.value.trim() : '';
			if ( val ) basics.push( '- ' + fieldLabel( key ) + ': ' + val );
		} );
		if ( basics.length ) {
			lines.push( 'BUSINESS' );
			lines = lines.concat( basics );
			lines.push( '' );
		}

		GROUP_ORDER.forEach( function ( group ) {
			var checked = root.querySelectorAll( 'input[type="checkbox"][data-pb-group="' + group + '"]:checked' );
			if ( ! checked.length ) return;
			lines.push( groupLabel( group ).toUpperCase() );
			checked.forEach( function ( cb ) {
				var val = ( cb.value || cb.getAttribute( 'value' ) || '' ).trim();
				if ( val ) lines.push( '- ' + val );
			} );
			lines.push( '' );
		} );

		var trailing = [];
		TRAILING_FIELD_ORDER.forEach( function ( key ) {
			var el = root.querySelector( '[data-pb-field="' + key + '"]' );
			var val = el && el.value ? el.value.trim() : '';
			if ( val ) trailing.push( '- ' + fieldLabel( key ) + ': ' + val );
		} );
		if ( trailing.length ) {
			lines.push( 'NOTES' );
			lines = lines.concat( trailing );
			lines.push( '' );
		}

		var body = lines.join( '\n' ).trim();
		if ( ! body ) return '';
		return 'Build me a website with these requirements:\n\n' + body;
	}

	function refresh( root, output ) {
		var text = buildPrompt( root );
		output.value = text || PLACEHOLDER;
	}

	function init() {
		document.querySelectorAll( '[data-cellpy-prompt-builder]' ).forEach( function ( root ) {
			var output = root.querySelector( '#pb-output' );
			if ( ! output ) return;
			var handler = function () { refresh( root, output ); };
			root.addEventListener( 'input', handler );
			root.addEventListener( 'change', handler );
			refresh( root, output );
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
