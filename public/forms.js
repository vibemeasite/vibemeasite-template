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
	// Attachments upload straight to the CDN Worker (Cloudflare, not this
	// site's own Vercel function) so a single 10MB file never has to pass
	// through a serverless function's request-body ceiling — see
	// platform/workers/cdn/src/index.ts's handleFormUpload. The submit
	// request to ENDPOINT_BASE above then only carries the resulting R2
	// keys, not file bytes.
	var UPLOAD_ENDPOINT_BASE = 'https://cdn.cellpy.com/form-uploads/';
	var DEFAULT_SUCCESS_MESSAGE = "Thanks! We'll be in touch soon.";
	var GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
	var RATE_LIMIT_MESSAGE = 'Too many submissions. Please wait a moment and try again.';

	// Mirrors the CDN Worker's and app/api/forms/submit/[slug]/route.ts's own
	// limits exactly — validating here too just means a visitor sees the
	// "too large"/"wrong type" message immediately instead of after a round
	// trip, not a security boundary (the server re-checks everything).
	var ALLOWED_ATTACHMENT_EXTENSIONS = [ 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'pdf', 'doc', 'docx' ];
	var MAX_ATTACHMENTS = 4;
	var MAX_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024;
	var MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

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
			if ( ! name || 'submit' === el.type || 'button' === el.type || 'file' === el.type ) {
				return;
			}
			data[ name ] = 'checkbox' === el.type ? el.checked : el.value;
		} );
		return data;
	}

	// Uploads one file straight to the CDN Worker and resolves to the R2 key
	// it was stored under — never rejects, so callers can branch on the
	// resolved shape without a .catch of their own.
	function uploadFile( file, slug ) {
		var url = UPLOAD_ENDPOINT_BASE + encodeURIComponent( slug ) + '?filename=' + encodeURIComponent( file.name );
		return fetch( url, {
			method: 'POST',
			headers: { 'Content-Type': file.type || 'application/octet-stream' },
			body: file,
		} )
			.then( function ( res ) {
				return res.json().catch( function () {
					return {};
				} ).then( function ( json ) {
					if ( ! res.ok || ! json.key ) {
						return { ok: false, message: ( json && json.error ) || ( 'Could not upload "' + file.name + '".' ) };
					}
					return { ok: true, filename: file.name, contentType: file.type || 'application/octet-stream', key: json.key };
				} );
			} )
			.catch( function () {
				return { ok: false, message: 'Could not upload "' + file.name + '".' };
			} );
	}

	// Resolves to { ok: true, attachments } or { ok: false, message } — never
	// rejects, so callers can branch on .ok without a .catch of their own.
	function collectAttachments( form, slug ) {
		var files = [];
		form.querySelectorAll( 'input[type="file"]' ).forEach( function ( input ) {
			Array.prototype.forEach.call( input.files || [], function ( file ) {
				files.push( file );
			} );
		} );

		if ( 0 === files.length ) {
			return Promise.resolve( { ok: true, attachments: [] } );
		}

		if ( files.length > MAX_ATTACHMENTS ) {
			return Promise.resolve( { ok: false, message: 'You can attach up to ' + MAX_ATTACHMENTS + ' files.' } );
		}

		var totalBytes = 0;
		for ( var i = 0; i < files.length; i++ ) {
			var ext = ( files[ i ].name.split( '.' ).pop() || '' ).toLowerCase();
			if ( -1 === ALLOWED_ATTACHMENT_EXTENSIONS.indexOf( ext ) ) {
				return Promise.resolve( { ok: false, message: '"' + files[ i ].name + '" isn\'t an accepted file type — images, PDF, or Word docs only.' } );
			}
			if ( files[ i ].size > MAX_ATTACHMENT_FILE_BYTES ) {
				return Promise.resolve( {
					ok: false,
					message: '"' + files[ i ].name + '" is over the ' + Math.floor( MAX_ATTACHMENT_FILE_BYTES / ( 1024 * 1024 ) ) + 'MB per-file limit.',
				} );
			}
			totalBytes += files[ i ].size;
		}

		if ( totalBytes > MAX_TOTAL_ATTACHMENT_BYTES ) {
			return Promise.resolve( {
				ok: false,
				message: 'Attachments are too large (max ' + Math.floor( MAX_TOTAL_ATTACHMENT_BYTES / ( 1024 * 1024 ) ) + 'MB total) — try smaller files or fewer of them.',
			} );
		}

		return Promise.all( files.map( function ( file ) {
			return uploadFile( file, slug );
		} ) ).then( function ( results ) {
			var failed = results.filter( function ( r ) { return ! r.ok; } );
			if ( failed.length > 0 ) {
				return { ok: false, message: failed[ 0 ].message };
			}
			return { ok: true, attachments: results };
		} );
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

			collectAttachments( form, slug ).then( function ( attachmentResult ) {
				if ( ! attachmentResult.ok ) {
					setSubmitting( form, false );
					showError( form, attachmentResult.message );
					return;
				}

				var payload = collectFields( form );
				if ( attachmentResult.attachments.length > 0 ) {
					payload._attachments = attachmentResult.attachments.map( function ( a ) {
						return { filename: a.filename, contentType: a.contentType, key: a.key };
					} );
				}

				fetch( ENDPOINT_BASE + encodeURIComponent( slug ), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify( payload ),
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

						showError( form, ( result.json && result.json.message ) || GENERIC_ERROR_MESSAGE );
					} )
					.catch( function () {
						setSubmitting( form, false );
						showError( form, GENERIC_ERROR_MESSAGE );
					} );
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
