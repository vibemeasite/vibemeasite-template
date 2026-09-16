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
 *
 * Calendar View + multi-select item picker — two independent upgrades:
 *  1. A visitor-facing Strip/Calendar view toggle for picking a date (Strip
 *     stays the default — today's flat day-button row; Calendar is a real
 *     month grid with real per-day availability dots).
 *  2. item_selector_style (from widget-config) controls how a service is
 *     picked — dropdown/radio/segmented/accordion are single-select,
 *     checkbox/tiles-multi allow combining several services (capped at
 *     max_services) into one back-to-back appointment, tiles-single is the
 *     single-select tile look.
 */
( function () {
	// See forms.js's own comment — Floating Widgets can independently decide
	// a popup target needs this script at the same time a page's own content
	// does, so this can now run twice on the same request without a guard.
	if ( window.__cellpyBookingInit ) return;
	window.__cellpyBookingInit = true;

	// Same-origin relays to vibemeasite-mcp's public booking API — same
	// CORS-avoidance reasoning as forms.js's own endpoint choice (see that
	// file's comment): a same-origin fetch never preflights, and the
	// server-to-server hop from these relay routes to mcp.vibemeasite.com
	// isn't subject to CORS at all.
	var CONFIG_ENDPOINT = '/api/booking/widget-config';
	var AVAILABILITY_ENDPOINT = '/api/booking/availability';
	var AVAILABILITY_SUMMARY_ENDPOINT = '/api/booking/availability-summary';
	var REQUEST_ENDPOINT = '/api/booking/request';
	var CONFIRM_ENDPOINT = '/api/booking/confirm';
	var DAYS_AHEAD = 14;
	var VIEW_STORAGE_PREFIX = 'vms_booking_view_';

	// Booking widget translation follow-up — same cellpy_lang cookie
	// middleware.ts already sets for ordinary block content (non-httpOnly,
	// readable here). No cookie means the site's default language, same
	// fallback every other translated surface uses. This only affects
	// widget-config's response (service/custom-field display text) and this
	// script's own UI copy below — matching/availability/request always key
	// off service.id, never the (possibly-translated) name, so language
	// never affects which slots are actually available.
	function currentLang() {
		var match = document.cookie.match( /(?:^|; )cellpy_lang=([^;]+)/ );
		return match ? decodeURIComponent( match[ 1 ] ) : '';
	}

	// This script is shared by every site (not Site-Owner-authored), so its
	// own UI copy is translated here directly rather than fetched — add a
	// language by adding a key. Falls back to 'en' for anything missing.
	var UI_STRINGS = {
		en: {
			yourName: 'Your name',
			yourEmail: 'Your email',
			loadingTimes: 'Loading times…',
			noAvailableTimes: 'No available times this day.',
			requestThisTime: 'Request this time',
			checkEmailForCode: 'Check your email for a 6-digit code and enter it below to confirm.',
			sixDigitCode: '6-digit code',
			confirm: 'Confirm',
			appointmentConfirmed: 'Your appointment is confirmed! Check your email for details.',
			genericError: 'Something went wrong. Please try again.',
			bookingUnavailable: 'Booking isn\'t available right now.',
			viewDays: 'Days',
			viewCalendar: 'Calendar',
			loadingCalendar: 'Loading calendar…',
			selectUpToN: 'Select up to {n} services.',
			summaryTotal: '{list} — {total} min total',
		},
		uk: {
			yourName: 'Ваше ім\'я',
			yourEmail: 'Ваша електронна пошта',
			loadingTimes: 'Завантаження часу…',
			noAvailableTimes: 'На цей день немає вільного часу.',
			requestThisTime: 'Запросити цей час',
			checkEmailForCode: 'Перевірте свою електронну пошту на наявність 6-значного коду та введіть його нижче для підтвердження.',
			sixDigitCode: '6-значний код',
			confirm: 'Підтвердити',
			appointmentConfirmed: 'Вашу зустріч підтверджено! Перевірте електронну пошту для деталей.',
			genericError: 'Щось пішло не так. Спробуйте ще раз.',
			bookingUnavailable: 'Бронювання зараз недоступне.',
			viewDays: 'Дні',
			viewCalendar: 'Календар',
			loadingCalendar: 'Завантаження календаря…',
			selectUpToN: 'Виберіть до {n} послуг.',
			summaryTotal: '{list} — {total} хв всього',
		},
	};
	var T = UI_STRINGS[ currentLang() ] || UI_STRINGS.en;
	var GENERIC_ERROR = T.genericError;

	// Single-select item_selector_style values keep state.selectedServiceIds
	// at exactly one entry; the other two allow combining several.
	var MULTI_SELECT_STYLES = { checkbox: true, 'tiles-multi': true };

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

	function safeLocalStorageGet( key ) {
		try {
			return window.localStorage.getItem( key );
		} catch ( e ) {
			return null;
		}
	}

	function safeLocalStorageSet( key, value ) {
		try {
			window.localStorage.setItem( key, value );
		} catch ( e ) {
			/* private mode / blocked storage — the widget still works, it just won't remember the choice */
		}
	}

	function getService( state, id ) {
		for ( var i = 0; i < state.services.length; i++ ) {
			if ( state.services[ i ].id === id ) return state.services[ i ];
		}
		return null;
	}

	function joinIds( ids ) {
		return ids.join( ',' );
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
			customFields: [],
			itemSelectorStyle: 'dropdown',
			maxServices: 1,
			// Booking widget translation follow-up — id, not name: the display
			// name varies by visitor language, id doesn't. Used for every
			// availability/request call; the name is only ever shown, never
			// matched on.
			selectedServiceIds: [],
			selectedDate: null,
			selectedSlot: null,
			requestId: null,
			view: safeLocalStorageGet( VIEW_STORAGE_PREFIX + widgetId ) || 'strip',
			calendarYear: null,
			calendarMonth: null, // 1-12
			// Populated by renderPicker, read by the render* functions below —
			// kept on state rather than re-queried via the DOM each time, so
			// rendering order in renderPicker isn't a fragile implicit contract.
			dateAreaContainer: null,
			slotsContainer: null,
			formContainer: null,
		};

		var langParam = currentLang() ? '&lang=' + encodeURIComponent( currentLang() ) : '';

		fetchJson( CONFIG_ENDPOINT + '?widget=' + encodeURIComponent( widgetId ) + langParam )
			.then( function ( result ) {
				if ( 200 !== result.status || ! result.json.ok ) {
					renderMessage( mount, ( result.json && result.json.message ) || T.bookingUnavailable );
					return;
				}
				state.services = result.json.services || [];
				state.timezone = result.json.timezone || 'UTC';
				state.customFields = result.json.custom_fields || [];
				state.itemSelectorStyle = result.json.item_selector_style || 'dropdown';
				state.maxServices = result.json.max_services || 1;
				if ( 0 === state.services.length ) {
					renderMessage( mount, T.bookingUnavailable );
					return;
				}
				state.selectedServiceIds = [ state.services[ 0 ].id ];
				renderPicker( mount, widgetId, state );
			} )
			.catch( function () {
				renderMessage( mount, GENERIC_ERROR );
			} );
	}

	function renderPicker( mount, widgetId, state ) {
		mount.innerHTML = '';

		renderServicePicker( mount, widgetId, state );
		renderViewToggle( mount, widgetId, state );

		state.dateAreaContainer = el( 'div' );
		mount.appendChild( state.dateAreaContainer );

		state.slotsContainer = el( 'div', 'vms-booking-widget__slots' );
		mount.appendChild( state.slotsContainer );

		state.formContainer = document.createElement( 'div' );
		mount.appendChild( state.formContainer );

		renderDateArea( widgetId, state );
	}

	// ─── Service picker (item_selector_style) ──────────────────────────────

	function isMultiSelectStyle( style ) {
		return !! MULTI_SELECT_STYLES[ style ];
	}

	function formatSummary( state ) {
		if ( state.selectedServiceIds.length < 2 ) return '';
		var parts = [];
		var total = 0;
		state.selectedServiceIds.forEach( function ( id ) {
			var s = getService( state, id );
			if ( ! s ) return;
			parts.push( s.name + ' (' + s.duration_minutes + ' min)' );
			total += s.duration_minutes;
		} );
		return T.summaryTotal.replace( '{list}', parts.join( ' + ' ) ).replace( '{total}', String( total ) );
	}

	function renderServicePicker( mount, widgetId, state ) {
		if ( state.services.length <= 1 ) return;

		var style = state.itemSelectorStyle;
		var multi = isMultiSelectStyle( style );
		var container = 'dropdown' === style ? null : el( 'div', 'vms-booking-widget__services--' + style );

		var summaryEl = el( 'p', 'vms-booking-widget__summary' );
		summaryEl.hidden = true;

		function refreshSelectedVisuals() {
			var options = container.querySelectorAll( '[data-vms-service-id]' );
			Array.prototype.forEach.call( options, function ( optionEl ) {
				var id = optionEl.getAttribute( 'data-vms-service-id' );
				var selected = state.selectedServiceIds.indexOf( id ) !== -1;
				optionEl.classList.toggle( 'vms-booking-widget__service-option--selected', selected );
				var input = optionEl.querySelector( 'input' );
				if ( input ) input.checked = selected;
				if ( multi ) {
					var atCap = state.selectedServiceIds.length >= state.maxServices;
					var disable = atCap && ! selected;
					optionEl.classList.toggle( 'vms-booking-widget__service-option--disabled', disable );
					if ( input ) input.disabled = disable;
					else optionEl.disabled = disable;
				}
			} );
			var summary = formatSummary( state );
			summaryEl.textContent = summary;
			summaryEl.hidden = ! summary;
		}

		function handleSelect( id ) {
			if ( multi ) {
				var idx = state.selectedServiceIds.indexOf( id );
				if ( idx !== -1 ) {
					// Never allow deselecting down to zero — one service must
					// always be selected, same invariant single-select styles get
					// for free from radio/select semantics.
					if ( state.selectedServiceIds.length > 1 ) state.selectedServiceIds.splice( idx, 1 );
				} else if ( state.selectedServiceIds.length < state.maxServices ) {
					state.selectedServiceIds.push( id );
				}
			} else {
				state.selectedServiceIds = [ id ];
			}
			refreshSelectedVisuals();
			onServiceSelectionChanged( widgetId, state );
		}

		if ( 'dropdown' === style ) {
			var select = document.createElement( 'select' );
			select.className = 'vms-booking-widget__services';
			state.services.forEach( function ( s ) {
				var opt = document.createElement( 'option' );
				opt.value = s.id;
				opt.textContent = s.name;
				select.appendChild( opt );
			} );
			select.value = state.selectedServiceIds[ 0 ];
			select.addEventListener( 'change', function () {
				handleSelect( select.value );
			} );
			mount.appendChild( select );
			mount.appendChild( summaryEl );
			return;
		}

		if ( 'radio' === style || 'checkbox' === style ) {
			state.services.forEach( function ( s ) {
				var label = el( 'label', 'vms-booking-widget__service-option' );
				label.setAttribute( 'data-vms-service-id', s.id );
				var input = document.createElement( 'input' );
				input.type = 'radio' === style ? 'radio' : 'checkbox';
				input.name = 'vms-service-' + widgetId;
				input.value = s.id;
				input.addEventListener( 'change', function () {
					handleSelect( s.id );
				} );
				label.appendChild( input );
				label.appendChild( document.createTextNode( ' ' + s.name + ' (' + s.duration_minutes + ' min)' ) );
				container.appendChild( label );
			} );
		} else if ( 'tiles-single' === style || 'tiles-multi' === style ) {
			state.services.forEach( function ( s ) {
				var tile = el( 'button', 'vms-booking-widget__service-option' );
				tile.type = 'button';
				tile.setAttribute( 'data-vms-service-id', s.id );
				tile.appendChild( el( 'span', null, s.name ) );
				tile.appendChild( el( 'span', null, s.duration_minutes + ' min' ) );
				tile.addEventListener( 'click', function () {
					if ( tile.disabled ) return;
					handleSelect( s.id );
				} );
				container.appendChild( tile );
			} );
		} else if ( 'segmented' === style ) {
			state.services.forEach( function ( s ) {
				var seg = el( 'button', 'vms-booking-widget__service-option', s.name );
				seg.type = 'button';
				seg.setAttribute( 'data-vms-service-id', s.id );
				seg.addEventListener( 'click', function () {
					handleSelect( s.id );
				} );
				container.appendChild( seg );
			} );
		} else if ( 'accordion' === style ) {
			state.services.forEach( function ( s ) {
				var item = el( 'div', 'vms-booking-widget__service-option' );
				item.setAttribute( 'data-vms-service-id', s.id );
				var header = el( 'button', null, s.name + ' — ' + s.duration_minutes + ' min' );
				header.type = 'button';
				header.setAttribute( 'aria-expanded', 'false' );
				header.addEventListener( 'click', function () {
					handleSelect( s.id );
				} );
				item.appendChild( header );
				container.appendChild( item );
			} );
		}

		mount.appendChild( container );
		mount.appendChild( summaryEl );
		refreshSelectedVisuals();
	}

	function onServiceSelectionChanged( widgetId, state ) {
		state.selectedSlot = null;
		state.formContainer.innerHTML = '';
		if ( 'calendar' === state.view ) {
			renderCalendarPicker( widgetId, state );
		} else if ( state.selectedDate ) {
			renderSlotsForSelectedDate( widgetId, state );
		} else {
			state.slotsContainer.innerHTML = '';
		}
	}

	// ─── Strip/Calendar view toggle ─────────────────────────────────────────

	function renderViewToggle( mount, widgetId, state ) {
		var container = el( 'div', 'vms-booking-widget__view-toggle' );

		function makeButton( view, label ) {
			var btn = el( 'button', 'vms-booking-widget__view-toggle-btn', label );
			btn.type = 'button';
			btn.setAttribute( 'aria-pressed', String( state.view === view ) );
			if ( state.view === view ) btn.classList.add( 'vms-booking-widget__view-toggle-btn--active' );
			btn.addEventListener( 'click', function () {
				if ( state.view === view ) return;
				state.view = view;
				safeLocalStorageSet( VIEW_STORAGE_PREFIX + widgetId, view );
				Array.prototype.forEach.call( container.querySelectorAll( '.vms-booking-widget__view-toggle-btn' ), function ( b ) {
					b.classList.remove( 'vms-booking-widget__view-toggle-btn--active' );
					b.setAttribute( 'aria-pressed', 'false' );
				} );
				btn.classList.add( 'vms-booking-widget__view-toggle-btn--active' );
				btn.setAttribute( 'aria-pressed', 'true' );
				renderDateArea( widgetId, state );
			} );
			return btn;
		}

		container.appendChild( makeButton( 'strip', T.viewDays ) );
		container.appendChild( makeButton( 'calendar', T.viewCalendar ) );
		mount.appendChild( container );
	}

	function renderDateArea( widgetId, state ) {
		state.dateAreaContainer.innerHTML = '';
		state.selectedDate = null;
		state.selectedSlot = null;
		state.slotsContainer.innerHTML = '';
		state.formContainer.innerHTML = '';
		if ( 'calendar' === state.view ) {
			renderCalendarPicker( widgetId, state );
		} else {
			renderStripPicker( widgetId, state );
		}
	}

	// ─── Strip view (today's flat day-button row) ──────────────────────────

	function renderStripPicker( widgetId, state ) {
		var strip = el( 'div', 'vms-booking-widget__calendar' );
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
					Array.prototype.forEach.call( strip.querySelectorAll( '.vms-booking-widget__calendar-day' ), function ( b ) {
						b.classList.remove( 'vms-booking-widget__calendar-day--selected' );
					} );
					dayBtn.classList.add( 'vms-booking-widget__calendar-day--selected' );
					renderSlotsForSelectedDate( widgetId, state );
				} );
				strip.appendChild( dayBtn );
			} )( new Date( today.getTime() + i * 24 * 60 * 60 * 1000 ) );
		}
		state.dateAreaContainer.appendChild( strip );

		var firstDayBtn = strip.querySelector( '.vms-booking-widget__calendar-day' );
		if ( firstDayBtn ) {
			firstDayBtn.click();
		}
	}

	// ─── Calendar view (month grid with real per-day availability) ─────────

	function weekdayHeaderLabels() {
		// 2023-01-01 was a Sunday — used only as a stable reference to name
		// the 7 weekdays in the visitor's own locale/short form, matching the
		// dayOfWeek convention (0 = Sunday) used everywhere else.
		var labels = [];
		for ( var i = 0; i < 7; i++ ) {
			labels.push( new Date( Date.UTC( 2023, 0, 1 + i ) ).toLocaleDateString( undefined, { weekday: 'short', timeZone: 'UTC' } ) );
		}
		return labels;
	}

	function renderCalendarPicker( widgetId, state ) {
		var today = new Date();
		if ( null === state.calendarYear ) {
			state.calendarYear = today.getFullYear();
			state.calendarMonth = today.getMonth() + 1;
		}

		var wrap = el( 'div', 'vms-booking-widget__calendar-grid' );
		var nav = el( 'div', 'vms-booking-widget__calendar-nav' );
		var prevBtn = el( 'button', 'vms-booking-widget__calendar-nav-btn', '‹' );
		prevBtn.type = 'button';
		var isCurrentMonth = state.calendarYear === today.getFullYear() && state.calendarMonth === today.getMonth() + 1;
		prevBtn.disabled = isCurrentMonth;
		var monthLabel = el( 'span', 'vms-booking-widget__calendar-month-label',
			new Date( state.calendarYear, state.calendarMonth - 1, 1 ).toLocaleDateString( undefined, { month: 'long', year: 'numeric' } ) );
		var nextBtn = el( 'button', 'vms-booking-widget__calendar-nav-btn', '›' );
		nextBtn.type = 'button';

		prevBtn.addEventListener( 'click', function () {
			if ( prevBtn.disabled ) return;
			state.calendarMonth -= 1;
			if ( state.calendarMonth < 1 ) { state.calendarMonth = 12; state.calendarYear -= 1; }
			state.selectedDate = null;
			state.selectedSlot = null;
			state.slotsContainer.innerHTML = '';
			state.formContainer.innerHTML = '';
			renderCalendarPicker( widgetId, state );
		} );
		nextBtn.addEventListener( 'click', function () {
			state.calendarMonth += 1;
			if ( state.calendarMonth > 12 ) { state.calendarMonth = 1; state.calendarYear += 1; }
			state.selectedDate = null;
			state.selectedSlot = null;
			state.slotsContainer.innerHTML = '';
			state.formContainer.innerHTML = '';
			renderCalendarPicker( widgetId, state );
		} );

		nav.appendChild( prevBtn );
		nav.appendChild( monthLabel );
		nav.appendChild( nextBtn );
		wrap.appendChild( nav );

		weekdayHeaderLabels().forEach( function ( label ) {
			wrap.appendChild( el( 'div', 'vms-booking-widget__calendar-grid-weekday', label ) );
		} );

		var monthStr = state.calendarYear + '-' + pad2( state.calendarMonth );
		var firstOfMonth = new Date( Date.UTC( state.calendarYear, state.calendarMonth - 1, 1 ) );
		var leadingBlanks = firstOfMonth.getUTCDay();
		var daysInMonth = new Date( Date.UTC( state.calendarYear, state.calendarMonth, 0 ) ).getUTCDate();

		for ( var b = 0; b < leadingBlanks; b++ ) {
			wrap.appendChild( el( 'div', 'vms-booking-widget__calendar-grid-day vms-booking-widget__calendar-grid-day--other-month' ) );
		}

		var dayCells = {};
		var loading = el( 'p', 'vms-booking-widget__message', T.loadingCalendar );
		state.dateAreaContainer.innerHTML = '';
		state.dateAreaContainer.appendChild( wrap );
		state.dateAreaContainer.appendChild( loading );

		for ( var d = 1; d <= daysInMonth; d++ ) {
			( function ( dayNum ) {
				var ds = monthStr + '-' + pad2( dayNum );
				var cell = el( 'button', 'vms-booking-widget__calendar-grid-day', String( dayNum ) );
				cell.type = 'button';
				cell.disabled = true; // enabled once the summary fetch resolves this day as available
				cell.setAttribute( 'data-date', ds );
				cell.addEventListener( 'click', function () {
					if ( cell.disabled ) return;
					state.selectedDate = ds;
					state.selectedSlot = null;
					Array.prototype.forEach.call( wrap.querySelectorAll( '.vms-booking-widget__calendar-grid-day' ), function ( c ) {
						c.classList.remove( 'vms-booking-widget__calendar-grid-day--selected' );
					} );
					cell.classList.add( 'vms-booking-widget__calendar-grid-day--selected' );
					renderSlotsForSelectedDate( widgetId, state );
				} );
				dayCells[ ds ] = cell;
				wrap.appendChild( cell );
			} )( d );
		}

		var url = AVAILABILITY_SUMMARY_ENDPOINT +
			'?widget=' + encodeURIComponent( widgetId ) +
			'&service=' + encodeURIComponent( joinIds( state.selectedServiceIds ) ) +
			'&month=' + encodeURIComponent( monthStr );

		fetchJson( url )
			.then( function ( result ) {
				loading.remove();
				if ( 200 !== result.status || ! result.json.ok ) {
					renderMessage( state.dateAreaContainer, ( result.json && result.json.message ) || GENERIC_ERROR );
					return;
				}
				var days = result.json.days || {};
				Object.keys( dayCells ).forEach( function ( ds ) {
					var cell = dayCells[ ds ];
					var available = !! days[ ds ];
					cell.disabled = ! available;
					cell.classList.toggle( 'vms-booking-widget__calendar-grid-day--available', available );
					cell.classList.toggle( 'vms-booking-widget__calendar-grid-day--unavailable', ! available );
				} );
			} )
			.catch( function () {
				loading.remove();
				renderMessage( state.dateAreaContainer, GENERIC_ERROR );
			} );
	}

	// ─── Time slots + request/confirm forms ─────────────────────────────────

	function renderSlotsForSelectedDate( widgetId, state ) {
		var slotsContainer = state.slotsContainer;
		state.formContainer.innerHTML = '';
		if ( ! state.selectedDate || 0 === state.selectedServiceIds.length ) {
			slotsContainer.innerHTML = '';
			return;
		}

		renderMessage( slotsContainer, T.loadingTimes );

		var url = AVAILABILITY_ENDPOINT +
			'?widget=' + encodeURIComponent( widgetId ) +
			'&service=' + encodeURIComponent( joinIds( state.selectedServiceIds ) ) +
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
					renderMessage( slotsContainer, T.noAvailableTimes );
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
		nameInput.placeholder = T.yourName;
		nameInput.required = true;
		form.appendChild( nameInput );

		var emailInput = document.createElement( 'input' );
		emailInput.type = 'email';
		emailInput.name = 'email';
		emailInput.placeholder = T.yourEmail;
		emailInput.required = true;
		form.appendChild( emailInput );

		// Site-Owner-defined fields beyond name/email (e.g. phone, notes) —
		// see CUSTOM_FIELDS_SCHEMA in vibemeasite-mcp's api/_server.ts. Each
		// field's `type` maps directly to an <input type="..."> except
		// 'textarea', which needs its own element.
		var customFieldInputs = {};
		state.customFields.forEach( function ( field ) {
			var input = 'textarea' === field.type
				? document.createElement( 'textarea' )
				: document.createElement( 'input' );
			if ( 'textarea' !== field.type ) {
				input.type = field.type;
			}
			input.name = field.name;
			input.placeholder = field.label;
			input.required = !! field.required;
			form.appendChild( input );
			customFieldInputs[ field.name ] = input;
		} );

		var submitBtn = el( 'button', 'vms-booking-widget__submit', T.requestThisTime );
		submitBtn.type = 'submit';
		form.appendChild( submitBtn );

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			submitBtn.disabled = true;

			var customFieldValues = {};
			Object.keys( customFieldInputs ).forEach( function ( name ) {
				customFieldValues[ name ] = customFieldInputs[ name ].value;
			} );

			fetchJson( REQUEST_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( {
					widget_public_id: widgetId,
					service_ids: state.selectedServiceIds,
					start_iso: state.selectedSlot.startIso,
					visitor_name: nameInput.value,
					visitor_email: emailInput.value,
					custom_field_values: customFieldValues,
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
			el( 'p', 'vms-booking-widget__message', T.checkEmailForCode )
		);

		var codeInput = document.createElement( 'input' );
		codeInput.type = 'text';
		codeInput.name = 'code';
		codeInput.setAttribute( 'inputmode', 'numeric' );
		codeInput.placeholder = T.sixDigitCode;
		codeInput.required = true;
		form.appendChild( codeInput );

		var submitBtn = el( 'button', 'vms-booking-widget__submit', T.confirm );
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
					renderMessage( formContainer, T.appointmentConfirmed );
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
