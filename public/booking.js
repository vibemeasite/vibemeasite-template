/**
 * Booking widget interactivity for the Cellpy booking-widget block rendered
 * by this template. Host-page script, not sandboxed block content — same
 * architecture as forms.js/lightbox.js: the block's own HTML
 * (vibemeasite-mcp's lib/booking-widget-template.ts) is just a fixed,
 * mostly-empty mount point; all the actual UI here is built with plain DOM
 * APIs and styled entirely by whatever CSS the Site Owner's block carries,
 * targeting the class-name contract documented alongside that fixed
 * skeleton. Only included on pages that render a booking widget block —
 * see components/SitePage.tsx.
 */
( function () {
	// Same-origin relays to vibemeasite-mcp's public booking API — same
	// CORS-avoidance reasoning as forms.js's own endpoint choice (see that
	// file's comment): a same-origin fetch never preflights, and the
	// server-to-server hop from these relay routes to mcp.vibemeasite.com
	// isn't subject to CORS at all.
	var CONFIG_ENDPOINT = '/api/booking/widget-config';
	var AVAILABILITY_ENDPOINT = '/api/booking/availability';
	var REQUEST_ENDPOINT = '/api/booking/request';
	var CONFIRM_ENDPOINT = '/api/booking/confirm';
	var DAYS_AHEAD = 14;
	var GENERIC_ERROR = 'Something went wrong. Please try again.';

	function el( tag, className, text ) {
		var node = document.createElement( tag );
		if ( className ) {
			node.className = className;
		}
		if ( undefined !== text ) {
			node.textContent = text;
		}
		return node;
	}

	function fetchJson( url, options ) {
		return fetch( url, options ).then( function ( res ) {
			return res
				.json()
				.catch( function () {
					return {};
				} )
				.then( function ( json ) {
					return { status: res.status, json: json };
				} );
		} );
	}

	function pad2( n ) {
		return n < 10 ? '0' + n : String( n );
	}

	// Local calendar date in the VISITOR's own browser, YYYY-MM-DD — a
	// reasonable default for which days to list even though the widget's
	// own timezone (used for the actual availability math) can differ;
	// a visitor naturally thinks in their own calendar days.
	function dateStr( date ) {
		return date.getFullYear() + '-' + pad2( date.getMonth() + 1 ) + '-' + pad2( date.getDate() );
	}

	function formatDayLabel( date ) {
		return date.toLocaleDateString( undefined, { weekday: 'short', month: 'short', day: 'numeric' } );
	}

	function formatTimeLabel( iso, timezone ) {
		return new Date( iso ).toLocaleString( undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' } );
	}

	function renderMessage( container, text ) {
		container.innerHTML = '';
		container.appendChild( el( 'p', 'vms-booking-widget__message', text ) );
	}

	function showFormError( form, message ) {
		var existing = form.querySelector( '.vms-booking-widget__message' );
		if ( existing ) {
			existing.textContent = message;
			return;
		}
		form.appendChild( el( 'p', 'vms-booking-widget__message', message ) );
	}

	function setupWidget( wrapper ) {
		var widgetId = wrapper.getAttribute( 'data-cellpy-booking-widget' );
		var mount = wrapper.querySelector( '[data-vms-booking-mount]' );
		if ( ! widgetId || ! mount ) {
			return;
		}

		var state = {
			services: [],
			timezone: 'UTC',
			selectedService: null,
			selectedDate: null,
			selectedSlot: null,
			requestId: null,
			// Populated by renderPicker, read by the render* functions below —
			// kept on state rather than re-queried via the DOM each time, so
			// rendering order in renderPicker isn't a fragile implicit contract.
			slotsContainer: null,
			formContainer: null,
		};

		fetchJson( CONFIG_ENDPOINT + '?widget=' + encodeURIComponent( widgetId ) )
			.then( function ( result ) {
				if ( 200 !== result.status || ! result.json.ok ) {
					renderMessage( mount, ( result.json && result.json.message ) || 'Booking isn\'t available right now.' );
					return;
				}
				state.services = result.json.services || [];
				state.timezone = result.json.timezone || 'UTC';
				if ( 0 === state.services.length ) {
					renderMessage( mount, 'Booking isn\'t available right now.' );
					return;
				}
				state.selectedService = state.services[ 0 ].name;
				renderPicker( mount, widgetId, state );
			} )
			.catch( function () {
				renderMessage( mount, GENERIC_ERROR );
			} );
	}

	function renderPicker( mount, widgetId, state ) {
		mount.innerHTML = '';

		if ( state.services.length > 1 ) {
			var select = document.createElement( 'select' );
			select.className = 'vms-booking-widget__services';
			state.services.forEach( function ( s ) {
				var opt = document.createElement( 'option' );
				opt.value = s.name;
				opt.textContent = s.name;
				select.appendChild( opt );
			} );
			select.value = state.selectedService;
			select.addEventListener( 'change', function () {
				state.selectedService = select.value;
				state.selectedSlot = null;
				renderSlotsForSelectedDate( widgetId, state );
			} );
			mount.appendChild( select );
		}

		var calendar = el( 'div', 'vms-booking-widget__calendar' );
		var today = new Date();
		for ( var i = 0; i < DAYS_AHEAD; i++ ) {
			( function ( dayDate ) {
				var ds = dateStr( dayDate );
				var dayBtn = el( 'button', 'vms-booking-widget__calendar-day', formatDayLabel( dayDate ) );
				dayBtn.type = 'button';
				dayBtn.setAttribute( 'data-date', ds );
				dayBtn.addEventListener( 'click', function () {
					state.selectedDate = ds;
					state.selectedSlot = null;
					Array.prototype.forEach.call( calendar.querySelectorAll( '.vms-booking-widget__calendar-day' ), function ( b ) {
						b.classList.remove( 'vms-booking-widget__calendar-day--selected' );
					} );
					dayBtn.classList.add( 'vms-booking-widget__calendar-day--selected' );
					renderSlotsForSelectedDate( widgetId, state );
				} );
				calendar.appendChild( dayBtn );
			} )( new Date( today.getTime() + i * 24 * 60 * 60 * 1000 ) );
		}
		mount.appendChild( calendar );

		state.slotsContainer = el( 'div', 'vms-booking-widget__slots' );
		mount.appendChild( state.slotsContainer );

		state.formContainer = document.createElement( 'div' );
		mount.appendChild( state.formContainer );

		var firstDayBtn = calendar.querySelector( '.vms-booking-widget__calendar-day' );
		if ( firstDayBtn ) {
			firstDayBtn.click();
		}
	}

	function renderSlotsForSelectedDate( widgetId, state ) {
		var slotsContainer = state.slotsContainer;
		state.formContainer.innerHTML = '';
		if ( ! state.selectedDate || ! state.selectedService ) {
			slotsContainer.innerHTML = '';
			return;
		}

		renderMessage( slotsContainer, 'Loading times…' );

		var url = AVAILABILITY_ENDPOINT +
			'?widget=' + encodeURIComponent( widgetId ) +
			'&service=' + encodeURIComponent( state.selectedService ) +
			'&date=' + encodeURIComponent( state.selectedDate );

		fetchJson( url )
			.then( function ( result ) {
				slotsContainer.innerHTML = '';
				if ( 200 !== result.status || ! result.json.ok ) {
					renderMessage( slotsContainer, ( result.json && result.json.message ) || GENERIC_ERROR );
					return;
				}

				var slots = result.json.slots || [];
				if ( 0 === slots.length ) {
					renderMessage( slotsContainer, 'No available times this day.' );
					return;
				}

				slots.forEach( function ( slot ) {
					var btn = el( 'button', 'vms-booking-widget__slot', formatTimeLabel( slot.startIso, state.timezone ) );
					btn.type = 'button';
					btn.addEventListener( 'click', function () {
						Array.prototype.forEach.call( slotsContainer.querySelectorAll( '.vms-booking-widget__slot' ), function ( b ) {
							b.classList.remove( 'vms-booking-widget__slot--selected' );
						} );
						btn.classList.add( 'vms-booking-widget__slot--selected' );
						state.selectedSlot = slot;
						renderRequestForm( widgetId, state );
					} );
					slotsContainer.appendChild( btn );
				} );
			} )
			.catch( function () {
				renderMessage( slotsContainer, GENERIC_ERROR );
			} );
	}

	function renderRequestForm( widgetId, state ) {
		var formContainer = state.formContainer;
		formContainer.innerHTML = '';

		var form = document.createElement( 'form' );
		form.className = 'vms-booking-widget__form';

		var nameInput = document.createElement( 'input' );
		nameInput.type = 'text';
		nameInput.name = 'name';
		nameInput.placeholder = 'Your name';
		nameInput.required = true;
		form.appendChild( nameInput );

		var emailInput = document.createElement( 'input' );
		emailInput.type = 'email';
		emailInput.name = 'email';
		emailInput.placeholder = 'Your email';
		emailInput.required = true;
		form.appendChild( emailInput );

		var submitBtn = el( 'button', 'vms-booking-widget__submit', 'Request this time' );
		submitBtn.type = 'submit';
		form.appendChild( submitBtn );

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			submitBtn.disabled = true;

			fetchJson( REQUEST_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( {
					widget_public_id: widgetId,
					service: state.selectedService,
					start_iso: state.selectedSlot.startIso,
					visitor_name: nameInput.value,
					visitor_email: emailInput.value,
				} ),
			} )
				.then( function ( result ) {
					submitBtn.disabled = false;
					if ( 200 !== result.status || ! result.json.ok ) {
						showFormError( form, ( result.json && result.json.message ) || GENERIC_ERROR );
						return;
					}
					state.requestId = result.json.request_id;
					renderCodeForm( state );
				} )
				.catch( function () {
					submitBtn.disabled = false;
					showFormError( form, GENERIC_ERROR );
				} );
		} );

		formContainer.appendChild( form );
	}

	function renderCodeForm( state ) {
		var formContainer = state.formContainer;
		formContainer.innerHTML = '';

		var form = document.createElement( 'form' );
		form.className = 'vms-booking-widget__code-form';
		form.appendChild(
			el( 'p', 'vms-booking-widget__message', 'Check your email for a 6-digit code and enter it below to confirm.' )
		);

		var codeInput = document.createElement( 'input' );
		codeInput.type = 'text';
		codeInput.name = 'code';
		codeInput.setAttribute( 'inputmode', 'numeric' );
		codeInput.placeholder = '6-digit code';
		codeInput.required = true;
		form.appendChild( codeInput );

		var submitBtn = el( 'button', 'vms-booking-widget__submit', 'Confirm' );
		submitBtn.type = 'submit';
		form.appendChild( submitBtn );

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			submitBtn.disabled = true;

			fetchJson( CONFIRM_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( { request_id: state.requestId, code: codeInput.value } ),
			} )
				.then( function ( result ) {
					submitBtn.disabled = false;
					if ( 200 !== result.status || ! result.json.ok ) {
						showFormError( form, ( result.json && result.json.message ) || GENERIC_ERROR );
						return;
					}
					renderMessage( formContainer, 'Your appointment is confirmed! Check your email for details.' );
				} )
				.catch( function () {
					submitBtn.disabled = false;
					showFormError( form, GENERIC_ERROR );
				} );
		} );

		formContainer.appendChild( form );
	}

	function init() {
		document.querySelectorAll( '[data-cellpy-booking-widget]' ).forEach( setupWidget );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
