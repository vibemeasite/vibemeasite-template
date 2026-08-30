/**
 * Modal / lightbox-style overlays for Cellpy blocks rendered by this
 * template. Host-page script, not sandboxed block content — the
 * block-validator forbids <script>, on*= handlers, and position:fixed
 * inside a block, so a block emits a plain trigger button plus a hidden
 * content container, and this script does the show/hide, focus trapping,
 * and fixed-position overlay from the outside (same architecture as
 * lightbox.js / floating-widgets.js). Only included on pages whose block
 * HTML contains `data-modal-open` — see components/SitePage.tsx.
 *
 * Block authoring contract:
 *   <button type="button" data-modal-open="connect">Connect</button>
 *   ...
 *   <div class="cellpy-modal" id="connect" hidden>
 *     <div class="cellpy-modal-panel" role="dialog" aria-modal="true" aria-label="Connect">
 *       <button type="button" class="cellpy-modal-close" data-modal-close aria-label="Close">&times;</button>
 *       ...any block content, including CSS-only tabs...
 *     </div>
 *   </div>
 *   - data-modal-open="<id>"  : trigger; opens the .cellpy-modal with that id
 *   - the container MUST ship `hidden` and have class "cellpy-modal"
 *   - .cellpy-modal / .cellpy-modal-panel positioning comes from
 *     globals.css (host chrome); the block only styles content inside.
 *   - close: click the backdrop, click any [data-modal-close], or press Esc.
 */
( function () {
	if ( window.__cellpyModalInit ) return;
	window.__cellpyModalInit = true;

	var openModal = null;
	var lastTrigger = null;

	function open( modal, trigger ) {
		if ( openModal ) close();
		openModal = modal;
		lastTrigger = trigger || null;
		modal.hidden = false;
		document.documentElement.style.overflow = 'hidden';
		var panel = modal.querySelector( '.cellpy-modal-panel' );
		var focusTarget = modal.querySelector(
			'[autofocus], .cellpy-modal-close, button, [href], input, select, textarea'
		) || panel;
		if ( focusTarget && focusTarget.focus ) focusTarget.focus();
	}

	function close() {
		if ( ! openModal ) return;
		openModal.hidden = true;
		openModal = null;
		document.documentElement.style.overflow = '';
		if ( lastTrigger && lastTrigger.focus ) lastTrigger.focus();
		lastTrigger = null;
	}

	document.addEventListener( 'click', function ( event ) {
		var t = event.target;
		var trigger = t.closest ? t.closest( '[data-modal-open]' ) : null;
		if ( trigger ) {
			event.preventDefault();
			var id = trigger.getAttribute( 'data-modal-open' );
			var modal = id && document.getElementById( id );
			if ( modal && modal.classList.contains( 'cellpy-modal' ) ) open( modal, trigger );
			return;
		}
		if ( ! openModal ) return;
		if ( t.closest && t.closest( '[data-modal-close]' ) ) {
			event.preventDefault();
			close();
			return;
		}
		// backdrop click — the .cellpy-modal element itself, outside the panel
		if ( t === openModal ) close();
	} );

	document.addEventListener( 'keydown', function ( event ) {
		if ( event.key === 'Escape' && openModal ) close();
	} );
} )();
