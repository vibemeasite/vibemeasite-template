/**
 * Form-submission handling for Cellpy form blocks rendered by this template.
 * Ported near-verbatim from wp-cellpy/plugin/cellpy-blocks/assets/forms.js —
 * narrow, purpose-built script, not the full client-side runtime, matching
 * the documented contract (platform/docs/bsa-documentation.md, US-FORM-04).
 * Only included on pages that actually render a form block — see
 * app/[slug]/page.tsx.
 */
( function () {
	// Floating Widgets can independently decide a popup target needs this
	// script (components/FloatingWidgets.tsx) at the same time a page's own
	// content does (components/SitePage.tsx) — both <script> tags then run
	// on the same request. Without this guard, a second execution rebinds
	// every submit handler a second time, so one visitor click submits the
	// form twice.
	if ( window.__cellpyFormsInit ) return;
	window.__cellpyFormsInit = true;

	// Read synchronously, before any async work — document.currentScript is
	// only reliable during a classic script's initial synchronous execution
	// (it goes null afterward, and is always null for type="module", which
	// this file deliberately isn't). Set by connect_recaptcha (vibemeasite-mcp)
	// via data-* attrs on this same <script> tag (components/SitePage.tsx) —
	// both unset (the default) means reCAPTCHA is off, everything below is a
	// no-op.
	var __scriptEl = document.currentScript;
	var RECAPTCHA_TYPE = __scriptEl && __scriptEl.getAttribute( 'data-recaptcha-type' );
	var RECAPTCHA_SITE_KEY = __scriptEl && __scriptEl.getAttribute( 'data-recaptcha-site-key' );
	var recaptchaEnabled = !! ( RECAPTCHA_TYPE && RECAPTCHA_SITE_KEY );

	// Cloudflare Turnstile — set by connect_turnstile (vibemeasite-mcp) via a
	// data-* attr on this same <script> tag (components/SitePage.tsx's
	// recaptchaScriptAttrs). Independent of reCAPTCHA; if both are somehow
	// configured, Turnstile's token is what the server verifies (its
	// verifyTurnstile runs first and fails closed). Unset -> everything below
	// is a no-op.
	var TURNSTILE_SITE_KEY = __scriptEl && __scriptEl.getAttribute( 'data-turnstile-site-key' );
	var turnstileEnabled = !! TURNSTILE_SITE_KEY;
	var turnstileWidgetIds = new WeakMap();
	var turnstileApiLoadingPromise = null;

	function loadTurnstileApi() {
		if ( turnstileApiLoadingPromise ) return turnstileApiLoadingPromise;
		turnstileApiLoadingPromise = new Promise( function ( resolve, reject ) {
			var s = document.createElement( 'script' );
			s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
			s.async = true;
			s.onload = function () { resolve(); };
			s.onerror = function () { reject( new Error( 'turnstile failed to load' ) ); };
			document.head.appendChild( s );
		} );
		return turnstileApiLoadingPromise;
	}

	// Renders one Turnstile widget per form, just before the submit button —
	// same placement + dedup-by-querySelector guard as ensureRecaptchaWidget.
	function ensureTurnstileWidget( form ) {
		if ( ! turnstileEnabled ) return;
		if ( form.querySelector( '.cellpy-form-turnstile' ) ) return;
		var container = document.createElement( 'div' );
		container.className = 'cellpy-form-turnstile';
		var button = form.querySelector( 'button[type="submit"], input[type="submit"]' );
		if ( button && button.parentNode ) {
			button.parentNode.insertBefore( container, button );
		} else {
			form.appendChild( container );
		}
		loadTurnstileApi().then( function () {
			if ( ! document.body.contains( container ) || 'undefined' === typeof window.turnstile ) return;
			turnstileWidgetIds.set( form, window.turnstile.render( container, { sitekey: TURNSTILE_SITE_KEY } ) );
		} ).catch( function () {
			// leave unset — getTurnstileToken()'s empty-token check surfaces a
			// clear "please complete the verification" error.
		} );
	}

	// '' when unavailable/failed, null when Turnstile isn't configured at all.
	function getTurnstileToken( form ) {
		if ( ! turnstileEnabled ) return null;
		var widgetId = turnstileWidgetIds.get( form );
		if ( undefined === widgetId || 'undefined' === typeof window.turnstile ) return '';
		return window.turnstile.getResponse( widgetId ) || '';
	}

	function resetTurnstileIfNeeded( form ) {
		if ( ! turnstileEnabled ) return;
		var widgetId = turnstileWidgetIds.get( form );
		if ( undefined !== widgetId && window.turnstile ) window.turnstile.reset( widgetId );
	}

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
	var IMAGE_ATTACHMENT_EXTENSIONS = [ 'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif' ];
	var MAX_ATTACHMENTS = 4;
	var MAX_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024;
	var MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

	// Selected files accumulate across multiple "Choose Files" picks — a bare
	// <input type="file"> replaces its FileList on every change, which reads
	// as "my first file vanished" to a visitor. Keyed by the <input> they
	// belong to.
	var attachmentFiles = new WeakMap();

	// Object URLs created for image thumbnails, keyed by the <input> they
	// belong to, so re-rendering revokes the previous batch instead of
	// leaking blob URLs for the life of the page.
	var attachmentPreviewUrls = new WeakMap();

	// v2 widget id per form, so multiple forms on one page (or the same form
	// re-rendered after a failed submit) each get their own independent
	// checkbox instance. v3 needs no per-form state — execute() is stateless.
	var recaptchaWidgetIds = new WeakMap();
	var recaptchaApiLoadingPromise = null;

	// Lazily injects Google's reCAPTCHA loader once. v2 uses render=explicit
	// so grecaptcha.render() (below) controls exactly where/when each widget
	// appears, instead of auto-rendering every stray .g-recaptcha div on the
	// page. v3 has no visible widget, so it renders itself via the render=
	// param and is driven entirely through grecaptcha.execute() at submit time.
	function loadRecaptchaApi() {
		if ( recaptchaApiLoadingPromise ) {
			return recaptchaApiLoadingPromise;
		}
		recaptchaApiLoadingPromise = new Promise( function ( resolve, reject ) {
			var s = document.createElement( 'script' );
			s.src = 'https://www.google.com/recaptcha/api.js' + ( 'v3' === RECAPTCHA_TYPE
				? '?render=' + encodeURIComponent( RECAPTCHA_SITE_KEY )
				: '?render=explicit' );
			s.async = true;
			s.onload = function () { resolve(); };
			s.onerror = function () { reject( new Error( 'recaptcha failed to load' ) ); };
			document.head.appendChild( s );
		} );
		return recaptchaApiLoadingPromise;
	}

	// v2 only — v3 has no visible widget. Mirrors ensureHoneypot's own
	// dedup-by-querySelector guard, which is what makes this safe if init()
	// somehow ran twice (see the ScrollPage comment in components/SitePage.tsx
	// about exactly that risk for forms.js in general).
	function ensureRecaptchaWidget( form ) {
		if ( ! recaptchaEnabled || 'v2' !== RECAPTCHA_TYPE ) {
			return;
		}
		if ( form.querySelector( '.g-recaptcha' ) ) {
			return;
		}
		var container = document.createElement( 'div' );
		container.className = 'g-recaptcha cellpy-form-recaptcha';
		var button = form.querySelector( 'button[type="submit"], input[type="submit"]' );
		if ( button && button.parentNode ) {
			button.parentNode.insertBefore( container, button );
		} else {
			form.appendChild( container );
		}
		loadRecaptchaApi().then( function () {
			grecaptcha.ready( function () {
				if ( ! document.body.contains( container ) ) {
					return;
				}
				recaptchaWidgetIds.set( form, grecaptcha.render( container, { sitekey: RECAPTCHA_SITE_KEY } ) );
			} );
		} ).catch( function () {
			// Leave the widget id unset — getRecaptchaToken()'s empty-token
			// check below surfaces a clear "please complete the verification"
			// error instead of silently letting the submission through.
		} );
	}

	// Resolves to a token string ('' if unavailable/failed), or null when
	// reCAPTCHA isn't configured for this site at all — handleSubmit branches
	// on that to skip the whole flow with zero overhead on every other site.
	function getRecaptchaToken( form ) {
		if ( ! recaptchaEnabled ) {
			return Promise.resolve( null );
		}
		if ( 'v2' === RECAPTCHA_TYPE ) {
			var widgetId = recaptchaWidgetIds.get( form );
			if ( undefined === widgetId || 'undefined' === typeof window.grecaptcha ) {
				return Promise.resolve( '' );
			}
			return Promise.resolve( grecaptcha.getResponse( widgetId ) || '' );
		}
		// v3 — tokens are short-lived and single-use, so a fresh one has to be
		// fetched at submit time rather than once at page load. Timeboxed so a
		// blocked/ad-blocked script can't leave the submit button stuck on
		// "Sending…" forever.
		return loadRecaptchaApi().then( function () {
			return new Promise( function ( resolve ) {
				var settled = false;
				var timeout = setTimeout( function () {
					if ( ! settled ) {
						settled = true;
						resolve( '' );
					}
				}, 5000 );
				grecaptcha.ready( function () {
					grecaptcha.execute( RECAPTCHA_SITE_KEY, { action: 'submit' } ).then( function ( token ) {
						if ( ! settled ) {
							settled = true;
							clearTimeout( timeout );
							resolve( token );
						}
					} ).catch( function () {
						if ( ! settled ) {
							settled = true;
							clearTimeout( timeout );
							resolve( '' );
						}
					} );
				} );
			} );
		} ).catch( function () {
			return '';
		} );
	}

	// v2 tokens are single-use — after any failed submission, the widget has
	// to be reset so a real visitor can retry without reloading the page.
	function resetRecaptchaIfNeeded( form ) {
		if ( ! recaptchaEnabled || 'v2' !== RECAPTCHA_TYPE ) {
			return;
		}
		var widgetId = recaptchaWidgetIds.get( form );
		if ( undefined !== widgetId && window.grecaptcha ) {
			grecaptcha.reset( widgetId );
		}
	}

	function isSameFile( a, b ) {
		return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
	}

	// Rewrites the input's own FileList to match our accumulated selection,
	// via the DataTransfer trick — the standard way to set input.files
	// programmatically — so collectAttachments() (which reads input.files at
	// submit time) needs no changes to see the merged/pruned set.
	function syncInputFiles( input, files ) {
		var dt = new DataTransfer();
		files.forEach( function ( file ) {
			dt.items.add( file );
		} );
		input.files = dt.files;
	}

	function addAttachmentFiles( input, newFiles ) {
		var existing = attachmentFiles.get( input ) || [];
		var merged = existing.concat( newFiles.filter( function ( nf ) {
			return ! existing.some( function ( ef ) { return isSameFile( ef, nf ); } );
		} ) );

		if ( merged.length > MAX_ATTACHMENTS ) {
			merged = merged.slice( 0, MAX_ATTACHMENTS );
			if ( input.form ) {
				showError( input.form, 'You can attach up to ' + MAX_ATTACHMENTS + ' files.' );
			}
		}

		attachmentFiles.set( input, merged );
		syncInputFiles( input, merged );
		renderAttachmentPreviews( input );
	}

	function removeAttachmentFile( input, file ) {
		var remaining = ( attachmentFiles.get( input ) || [] ).filter( function ( f ) {
			return ! isSameFile( f, file );
		} );
		attachmentFiles.set( input, remaining );
		syncInputFiles( input, remaining );
		renderAttachmentPreviews( input );
	}

	function renderAttachmentPreviews( input ) {
		var container = input.nextElementSibling;
		if ( ! container || ! container.classList.contains( 'cellpy-form-attachment-previews' ) ) {
			container = document.createElement( 'div' );
			container.className = 'cellpy-form-attachment-previews';
			input.insertAdjacentElement( 'afterend', container );
		}
		container.innerHTML = '';

		( attachmentPreviewUrls.get( input ) || [] ).forEach( function ( url ) {
			URL.revokeObjectURL( url );
		} );

		var files = attachmentFiles.get( input ) || [];
		var urls = [];

		files.forEach( function ( file ) {
			var ext = ( file.name.split( '.' ).pop() || '' ).toLowerCase();
			var item = document.createElement( 'div' );
			item.className = 'cellpy-form-attachment';
			item.title = file.name;

			var remove = document.createElement( 'button' );
			remove.type = 'button';
			remove.className = 'cellpy-form-attachment-remove';
			remove.setAttribute( 'aria-label', 'Remove ' + file.name );
			remove.textContent = '×';
			remove.addEventListener( 'click', function () {
				removeAttachmentFile( input, file );
			} );
			item.appendChild( remove );

			if ( -1 !== IMAGE_ATTACHMENT_EXTENSIONS.indexOf( ext ) ) {
				var url = URL.createObjectURL( file );
				urls.push( url );
				var img = document.createElement( 'img' );
				img.className = 'cellpy-form-attachment-thumb';
				img.src = url;
				img.alt = file.name;
				item.appendChild( img );
			} else {
				var isPdf = 'pdf' === ext;
				var icon = document.createElement( 'div' );
				icon.className = 'cellpy-form-attachment-icon ' + ( isPdf ? 'cellpy-form-attachment-icon--pdf' : 'cellpy-form-attachment-icon--doc' );
				icon.textContent = isPdf ? 'PDF' : 'DOC';
				item.appendChild( icon );
			}

			var name = document.createElement( 'span' );
			name.className = 'cellpy-form-attachment-name';
			name.textContent = file.name;
			item.appendChild( name );

			container.appendChild( item );
		} );

		attachmentPreviewUrls.set( input, urls );
	}

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

			getRecaptchaToken( form ).then( function ( recaptchaToken ) {
				if ( recaptchaEnabled && ! recaptchaToken ) {
					setSubmitting( form, false );
					showError( form, 'v2' === RECAPTCHA_TYPE ? 'Please complete the verification.' : 'Verification failed — please try again.' );
					resetRecaptchaIfNeeded( form );
					resetTurnstileIfNeeded( form );
					return;
				}

				var turnstileToken = getTurnstileToken( form );
				if ( turnstileEnabled && ! turnstileToken ) {
					setSubmitting( form, false );
					showError( form, 'Please complete the verification.' );
					resetTurnstileIfNeeded( form );
					return;
				}

				collectAttachments( form, slug ).then( function ( attachmentResult ) {
					if ( ! attachmentResult.ok ) {
						setSubmitting( form, false );
						showError( form, attachmentResult.message );
						resetRecaptchaIfNeeded( form );
						resetTurnstileIfNeeded( form );
						return;
					}

					var payload = collectFields( form );
					// The submitting page's own resolved language (set correctly on
					// <html lang> per-locale — see app/layout.tsx). Most receivers
					// (a plain lead-capture inbox) just ignore this extra field; the
					// event-signup receiver reads it to send its confirmation email
					// in the same language the visitor was looking at — see
					// vibemeasite-mcp's lib/event-signup.ts / lib/email.ts.
					payload._lang = document.documentElement.lang || '';
					if ( attachmentResult.attachments.length > 0 ) {
						payload._attachments = attachmentResult.attachments.map( function ( a ) {
							return { filename: a.filename, contentType: a.contentType, key: a.key };
						} );
					}
					if ( recaptchaEnabled ) {
						payload._recaptcha = recaptchaToken;
					}
					if ( turnstileEnabled ) {
						payload._turnstile = turnstileToken;
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
								resetRecaptchaIfNeeded( form );
								resetTurnstileIfNeeded( form );
								return;
							}

							if ( result.json && true === result.json.ok ) {
								showSuccess( form, config );
								return;
							}

							showError( form, ( result.json && result.json.message ) || GENERIC_ERROR_MESSAGE );
							resetRecaptchaIfNeeded( form );
							resetTurnstileIfNeeded( form );
						} )
						.catch( function () {
							setSubmitting( form, false );
							showError( form, GENERIC_ERROR_MESSAGE );
							resetRecaptchaIfNeeded( form );
							resetTurnstileIfNeeded( form );
						} );
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
			ensureRecaptchaWidget( form );
			ensureTurnstileWidget( form );
			form.querySelectorAll( 'input[type="file"]' ).forEach( function ( input ) {
				input.addEventListener( 'change', function () {
					addAttachmentFiles( input, Array.prototype.slice.call( input.files || [] ) );
				} );
			} );
			form.addEventListener( 'submit', handleSubmit( form, slug, config ) );
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
