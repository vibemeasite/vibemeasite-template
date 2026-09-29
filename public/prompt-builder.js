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
 * Only the keys in FIELD_ORDER / GROUP_ORDER / TRAILING_FIELD_ORDER below
 * are read by this legacy contract.
 *
 * v2 contract (v52+) — opted into with <div data-cellpy-prompt-builder
 * data-pb-v="2">. Fully markup-driven, so the block can add/reword/reorder
 * options without touching this script:
 *   - Contributors: [data-pb-group] on a checkbox, radio (only the checked
 *     one counts) or type="hidden" input (always on); [data-pb-field] on a
 *     text input, textarea or <select>.
 *   - Output section = nearest ancestor-or-self with data-pb-heading (empty
 *     string → no heading line). data-pb-order on that same element sorts
 *     sections (default 100, ties keep document order). data-pb-plain on it
 *     drops the "- " bullet prefix (for multi-line fixed text blocks).
 *   - Text: a checkable's `value`; a field's `data-pb-template` with {value}
 *     substituted, else "<data-pb-label>: value". An empty field emits
 *     `data-pb-empty` if present, else nothing.
 *   - data-pb-short: alternate text used while any checked [data-pb-mode="short"]
 *     toggle exists in the root.
 *   - data-pb-requires="id …" / data-pb-unless="id …": include only if every
 *     listed element (by id) is checked / exclude if any listed one is checked.
 *   - [data-pb-count]: its text is set to its attribute value with {n}
 *     replaced by the output's approximate word count (default "≈ {n} words").
 *   - Identical lines are emitted once. When nothing contributes, #pb-output
 *     is emptied so its placeholder attribute shows.
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

	function attrIds( el, name ) {
		var raw = el.getAttribute( name );
		return raw ? raw.split( /\s+/ ).filter( Boolean ) : [];
	}

	function isOn( root, id ) {
		var el = root.querySelector( '#' + id );
		if ( ! el ) return false;
		if ( el.type === 'checkbox' || el.type === 'radio' ) return el.checked;
		return !! ( el.value && el.value.trim() );
	}

	function contributionText( el, shortMode ) {
		var isField = el.hasAttribute( 'data-pb-field' );
		if ( ! isField ) {
			if ( ( el.type === 'checkbox' || el.type === 'radio' ) && ! el.checked ) return '';
			var alt = shortMode ? el.getAttribute( 'data-pb-short' ) : null;
			return ( alt !== null ? alt : el.value || '' ).trim();
		}
		var val = el.value ? el.value.trim() : '';
		if ( ! val ) return ( el.getAttribute( 'data-pb-empty' ) || '' ).trim();
		var tpl = el.getAttribute( 'data-pb-template' );
		if ( tpl ) return tpl.split( '{value}' ).join( val );
		var key = el.getAttribute( 'data-pb-field' );
		return ( el.getAttribute( 'data-pb-label' ) || FIELD_LABELS[ key ] || key ) + ': ' + val;
	}

	function buildPromptV2( root ) {
		var shortMode = !! root.querySelector( '[data-pb-mode="short"]:checked' );
		var sections = [];
		var byEl = new Map();
		var seen = {};

		root.querySelectorAll( '[data-pb-group], [data-pb-field]' ).forEach( function ( el ) {
			if ( attrIds( el, 'data-pb-requires' ).some( function ( id ) { return ! isOn( root, id ); } ) ) return;
			if ( attrIds( el, 'data-pb-unless' ).some( function ( id ) { return isOn( root, id ); } ) ) return;
			var text = contributionText( el, shortMode );
			if ( ! text || seen[ text ] ) return;
			seen[ text ] = true;

			var host = el.closest( '[data-pb-heading]' ) || root;
			var section = byEl.get( host );
			if ( ! section ) {
				var order = parseFloat( host.getAttribute( 'data-pb-order' ) );
				section = {
					heading: ( host.getAttribute( 'data-pb-heading' ) || '' ).trim(),
					order: isNaN( order ) ? 100 : order,
					plain: host.hasAttribute( 'data-pb-plain' ),
					index: sections.length,
					lines: []
				};
				byEl.set( host, section );
				sections.push( section );
			}
			section.lines.push( section.plain ? text : '- ' + text );
		} );

		sections.sort( function ( a, b ) { return a.order - b.order || a.index - b.index; } );
		return sections.map( function ( s ) {
			var block = s.plain ? s.lines.join( '\n\n' ) : s.lines.join( '\n' );
			return s.heading ? s.heading.toUpperCase() + '\n' + block : block;
		} ).join( '\n\n' ).trim();
	}

	function updateCounts( root, text ) {
		var words = text ? text.split( /\s+/ ).filter( Boolean ).length : 0;
		var rounded = words < 100 ? words : Math.round( words / 10 ) * 10;
		root.querySelectorAll( '[data-pb-count]' ).forEach( function ( el ) {
			var tpl = el.getAttribute( 'data-pb-count' ) || '≈ {n} words';
			el.textContent = words ? tpl.split( '{n}' ).join( rounded.toLocaleString( 'en-US' ) ) : '';
		} );
	}

	function refresh( root, output ) {
		if ( root.getAttribute( 'data-pb-v' ) === '2' ) {
			var textV2 = buildPromptV2( root );
			output.value = textV2;
			updateCounts( root, textV2 );
			return;
		}
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
