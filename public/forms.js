/**
 * Form-submission handling for Cellpy form blocks rendered by this template.
 * Ported near-verbatim from wp-cellpy/plugin/cellpy-blocks/assets/forms.js —
 * narrow, purpose-built script, not the full client-side runtime, matching
 * the documented contract (platform/docs/bsa-documentation.md, US-FORM-04).
 * Only included on pages that actually render a form block — see
 * app/[slug]/page.tsx.
 */
( function () {
	// Same-origin — the site's own app/api/forms/submit/[slug]/route.ts
	// handles delivery server-side (via the Site Owner's own Resend account
	// if connect_resend was set up, else forwarding server-to-server to
	// Cellpy's central relay). This is what actually removes the CORS
	// dependency for good: a same-origin POST from the browser never
	// preflights, and any downstream cross-origin call happens server-to-
	// server where CORS doesn't apply at all.
	var ENDPOINT_BASE = '/api/forms/submit/';
	var DEFAULT_SUCCESS_MESSAGE = "Thanks! We'll be in touch soon.";
	var GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
	var RATE_LIMIT_MESSAGE = 'Too many submissions. Please wait a moment and try again.';

	// The block's authored HTML doesn't include the honeypot field itself —
	// per the documented contract, rendering it is the client's job, done
	// once at init so bots that don't run JS never see it while humans do.
	function ensureHoneypot( form ) {
		if ( form.querySelector( 'input[name="_hp"]' ) ) {
			return;
		}
		var hp = document.createElement( 'input' );
		hp.type = 'text';
		hp.name = '_hp';
		hp.tabIndex = -1;
		hp.setAttribute( 'aria-hidden', 'true' );
		hp.setAttribute( 'autocomplete', 'off' );
		hp.style.position = 'absolute';
		hp.style.opacity = '0';
		hp.style.height = '0';
		hp.style.width = '0';
		form.appendChild( hp );
	}

	function collectFields( form ) {
		var data = {};
		form.querySelectorAll( '[name]' ).forEach( function ( el ) {
			var name = el.getAttribute( 'name' );
			if ( ! name || 'submit' === el.type || 'button' === el.type ) {
				return;
			}
			data[ name ] = 'checkbox' === el.type ? el.checked : el.value;
		} );
		return data;
	}

	function setSubmitting( form, submitting ) {
		var button = form.querySelector( 'button[type="submit"], input[type="submit"]' );
		if ( ! button ) {
			return;
		}
		button.disabled = submitting;
		var isInput = 'value' in button && 'submit' === button.type;

		if ( submitting ) {
			if ( ! button.dataset.cellpyOriginalLabel ) {
				button.dataset.cellpyOriginalLabel = isInput ? button.value : button.textContent;
			}
			if ( isInput ) {
				button.value = 'Sending…';
			} else {
				button.textContent = 'Sending…';
			}
		} else if ( button.dataset.cellpyOriginalLabel ) {
			if ( isInput ) {
				button.value = button.dataset.cellpyOriginalLabel;
			} else {
				button.textContent = button.dataset.cellpyOriginalLabel;
			}
		}
	}

	function showError( form, message ) {
		var existing = form.querySelector( '.cellpy-form-error' );
		if ( existing ) {
			existing.textContent = message;
			return;
		}
		var el = document.createElement( 'p' );
		el.className = 'cellpy-form-error';
		el.textContent = message;
		form.appendChild( el );
	}

	function showSuccess( form, config ) {
		var successEl = document.createElement( 'p' );
		successEl.className = 'cellpy-form-success';
		successEl.textContent = config.successMessage || DEFAULT_SUCCESS_MESSAGE;
		form.replaceWith( successEl );

		if ( config.successRedirectUrl ) {
			setTimeout( function () {
				window.location.href = config.successRedirectUrl;
			}, 2000 );
		}
	}

	function handleSubmit( form, slug, config ) {
		return function ( e ) {
			e.preventDefault();

			var existingError = form.querySelector( '.cellpy-form-error' );
			if ( existingError ) {
				existingError.remove();
			}

			setSubmitting( form, true );

			fetch( ENDPOINT_BASE + encodeURIComponent( slug ), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( collectFields( form ) ),
			} )
				.then( function ( res ) {
					return res
						.json()
						.catch( function () {
							return {};
						} )
						.then( function ( json ) {
							return { status: res.status, json: json };
						} );
				} )
				.then( function ( result ) {
					setSubmitting( form, false );

					if ( 429 === result.status ) {
						showError( form, RATE_LIMIT_MESSAGE );
						return;
					}

					if ( result.json && true === result.json.ok ) {
						showSuccess( form, config );
						return;
					}

					showError( form, GENERIC_ERROR_MESSAGE );
				} )
				.catch( function () {
					setSubmitting( form, false );
					showError( form, GENERIC_ERROR_MESSAGE );
				} );
		};
	}

	function init() {
		document.querySelectorAll( '[data-cellpy-form-slug]' ).forEach( function ( wrapper ) {
			var form = wrapper.querySelector( 'form' );
			if ( ! form ) {
				return;
			}

			var slug = wrapper.getAttribute( 'data-cellpy-form-slug' );
			var config = {};
			try {
				config = JSON.parse( wrapper.getAttribute( 'data-cellpy-form-config' ) || '{}' );
			} catch ( err ) {
				config = {};
			}

			ensureHoneypot( form );
			form.addEventListener( 'submit', handleSubmit( form, slug, config ) );
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
