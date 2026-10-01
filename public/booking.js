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
 *
 * Staff picker — when widget-config carries `staff`, specialist cards
 * (photo, name, short description) render inside the request form, under
 * the custom fields, filtered to the people who perform every selected
 * service. A person's optional `rules` tie eligibility to the visitor's
 * answers (e.g. gender = "Femme" → these services), so the picker
 * re-filters live as those fields change. The chosen
 * id is sent as staff_id with the request (null when nothing is picked —
 * the server then rejects it if someone was eligible). Availability is the
 * same shared calendar either way; picking a person never changes slots.
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
			yourFirstName: 'First name',
			yourLastName: 'Last name',
			yourEmail: 'Your email',
			loadingTimes: 'Loading times…',
			noAvailableTimes: 'No available times this day.',
			requestThisTime: 'Request this time',
			checkEmailForCode: 'Check your email for a 6-digit code and enter it below to confirm.',
			sixDigitCode: '6-digit code',
			confirm: 'Confirm',
			appointmentConfirmed: 'Your appointment is confirmed! Check your email for details.',
			redirectingToPayment: 'Redirecting you to pay your deposit…',
			paymentRequiredNotice: 'Payment of {amount} is required to confirm this booking.',
			prepaymentNotice: 'A pre-payment of {deposit} is required to confirm your booking. The full price is {price} — the remaining {balance} is paid at your visit.',
			payAtVisitNotice: 'The full price of {price} is paid at your visit.',
			genericError: 'Something went wrong. Please try again.',
			bookingUnavailable: 'Booking isn\'t available right now.',
			viewDays: 'Days',
			viewCalendar: 'Calendar',
			loadingCalendar: 'Loading calendar…',
			selectUpToN: 'Select up to {n} services.',
			summaryTotal: '{list} — {total} min total',
			chooseStaff: 'Choose your specialist',
			chooseStaffError: 'Please choose a specialist.',
			staffNeedsField: 'Answer «{field}» above to see the available specialists.',
		},
		uk: {
			yourName: 'Ваше ім\'я',
			yourFirstName: 'Ім\'я',
			yourLastName: 'Прізвище',
			yourEmail: 'Ваша електронна пошта',
			loadingTimes: 'Завантаження часу…',
			noAvailableTimes: 'На цей день немає вільного часу.',
			requestThisTime: 'Запросити цей час',
			checkEmailForCode: 'Перевірте свою електронну пошту на наявність 6-значного коду та введіть його нижче для підтвердження.',
			sixDigitCode: '6-значний код',
			confirm: 'Підтвердити',
			appointmentConfirmed: 'Вашу зустріч підтверджено! Перевірте електронну пошту для деталей.',
			redirectingToPayment: 'Перенаправляємо вас для оплати депозиту…',
			paymentRequiredNotice: 'Для підтвердження бронювання потрібна оплата {amount}.',
			prepaymentNotice: 'Для підтвердження бронювання потрібна передоплата {deposit}. Повна вартість — {price}; решту, {balance}, ви сплачуєте під час візиту.',
			payAtVisitNotice: 'Повна вартість {price} сплачується під час візиту.',
			genericError: 'Щось пішло не так. Спробуйте ще раз.',
			bookingUnavailable: 'Бронювання зараз недоступне.',
			viewDays: 'Дні',
			viewCalendar: 'Календар',
			loadingCalendar: 'Завантаження календаря…',
			selectUpToN: 'Виберіть до {n} послуг.',
			summaryTotal: '{list} — {total} хв всього',
			chooseStaff: 'Оберіть спеціаліста',
			chooseStaffError: 'Будь ласка, оберіть спеціаліста.',
			staffNeedsField: 'Заповніть поле «{field}» вище, щоб побачити доступних спеціалістів.',
		},
		fr: {
			yourName: 'Votre nom',
			yourFirstName: 'Prénom',
			yourLastName: 'Nom',
			yourEmail: 'Votre courriel',
			loadingTimes: 'Chargement des horaires…',
			noAvailableTimes: 'Aucun horaire disponible ce jour-là.',
			requestThisTime: 'Réserver ce créneau',
			checkEmailForCode: 'Consultez vos courriels : entrez ci-dessous le code à 6 chiffres reçu pour confirmer.',
			sixDigitCode: 'Code à 6 chiffres',
			confirm: 'Confirmer',
			appointmentConfirmed: 'Votre rendez-vous est confirmé ! Consultez vos courriels pour les détails.',
			redirectingToPayment: 'Redirection vers le paiement de votre acompte…',
			paymentRequiredNotice: 'Un paiement de {amount} est requis pour confirmer cette réservation.',
			prepaymentNotice: 'Un acompte de {deposit} est requis pour confirmer votre réservation. Le prix total est de {price} — le solde de {balance} se règle lors de votre visite.',
			payAtVisitNotice: 'Le prix total de {price} se règle lors de votre visite.',
			genericError: 'Une erreur est survenue. Veuillez réessayer.',
			bookingUnavailable: 'La réservation n\'est pas disponible pour le moment.',
			viewDays: 'Jours',
			viewCalendar: 'Calendrier',
			loadingCalendar: 'Chargement du calendrier…',
			selectUpToN: 'Sélectionnez jusqu\'à {n} soins.',
			summaryTotal: '{list} — {total} min au total',
			chooseStaff: 'Choisissez votre spécialiste',
			chooseStaffError: 'Veuillez choisir un spécialiste.',
			staffNeedsField: 'Remplissez le champ « {field} » ci-dessus pour voir les spécialistes disponibles.',
		},
		ru: {
			yourName: 'Ваше имя',
			yourFirstName: 'Имя',
			yourLastName: 'Фамилия',
			yourEmail: 'Ваш e-mail',
			loadingTimes: 'Загрузка времени…',
			noAvailableTimes: 'На этот день нет свободного времени.',
			requestThisTime: 'Записаться на это время',
			checkEmailForCode: 'Проверьте почту: введите ниже 6-значный код для подтверждения.',
			sixDigitCode: '6-значный код',
			confirm: 'Подтвердить',
			appointmentConfirmed: 'Ваша запись подтверждена! Подробности отправлены на e-mail.',
			redirectingToPayment: 'Переходим к оплате предоплаты…',
			paymentRequiredNotice: 'Для подтверждения записи требуется оплата {amount}.',
			prepaymentNotice: 'Для подтверждения записи требуется предоплата {deposit}. Полная стоимость — {price}; оставшиеся {balance} оплачиваются во время визита.',
			payAtVisitNotice: 'Полная стоимость {price} оплачивается во время визита.',
			genericError: 'Что-то пошло не так. Попробуйте ещё раз.',
			bookingUnavailable: 'Запись сейчас недоступна.',
			viewDays: 'Дни',
			viewCalendar: 'Календарь',
			loadingCalendar: 'Загрузка календаря…',
			selectUpToN: 'Выберите до {n} услуг.',
			summaryTotal: '{list} — всего {total} мин',
			chooseStaff: 'Выберите специалиста',
			chooseStaffError: 'Пожалуйста, выберите специалиста.',
			staffNeedsField: 'Заполните поле «{field}» выше, чтобы увидеть доступных специалистов.',
		},
	};
	// No cellpy_lang cookie means the site's default language — the page's
	// own <html lang> then says which one that is, rather than assuming 'en'.
	function uiLang() {
		return currentLang() || ( document.documentElement.lang || '' ).slice( 0, 2 ).toLowerCase();
	}
	var T = UI_STRINGS[ uiLang() ] || UI_STRINGS.en;
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
			// Flexible name/contact fields follow-up — 'full' (default) keeps a
			// single Name input, matching every widget's behavior before this;
			// 'first_last' splits it into two. formNotice is a Site-Owner
			// authored line shown in the request form, e.g. a note that
			// inaccurate contact info may lead to a booking being refused.
			nameFields: 'full',
			formNotice: '',
			currency: 'usd', // BSA Phase 23 — only meaningful for services that carry deposit_cents
			staff: [],
			selectedStaffId: null,
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
			staffContainer: null,
			// Returns the request form's current custom field values — set by
			// renderRequestForm, read by the staff picker's rule evaluation.
			readFieldValues: function () {
				return {};
			},
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
				state.currency = result.json.currency || 'usd';
				state.nameFields = result.json.name_fields || 'full';
				state.formNotice = result.json.form_notice || '';
				state.staff = result.json.staff || [];
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

	// BSA Phase 23 — deposit_cents is only present on a service that actually
	// requires payment (see api/public-booking.ts's handleWidgetConfig); a
	// free service simply never has this field, so every existing site's
	// booking widget renders identically to before this phase.
	function formatPrice( cents, currency ) {
		try {
			return new Intl.NumberFormat( undefined, { style: 'currency', currency: ( currency || 'usd' ).toUpperCase() } ).format( cents / 100 );
		} catch ( e ) {
			// Intl.NumberFormat throws on a currency code it doesn't recognize —
			// fall back to a plain number rather than breaking the whole widget
			// over a formatting nicety.
			return ( cents / 100 ).toFixed( 2 ) + ' ' + ( currency || '' ).toUpperCase();
		}
	}

	// price_cents is the display-only full price; deposit_cents is what's
	// actually charged online. A service with only deposit_cents (every
	// widget before price_cents existed) is paid in full online, so its
	// deposit IS its price.
	function servicePriceCents( s ) {
		return s.price_cents || s.deposit_cents || 0;
	}

	function serviceLabel( s, state ) {
		var label = s.name + ' (' + s.duration_minutes + ' min)';
		var price = servicePriceCents( s );
		if ( price ) label += ' — ' + formatPrice( price, state.currency );
		return label;
	}

	// Totals for the CURRENT selection — `deposit` is charged online,
	// `price` is the full price shown to the visitor. Used both by
	// formatSummary (multi-select) and by the payment notice above the
	// request form (any selector style).
	function selectionTotals( state ) {
		var totals = { deposit: 0, price: 0 };
		state.selectedServiceIds.forEach( function ( id ) {
			var s = getService( state, id );
			if ( ! s ) return;
			totals.deposit += s.deposit_cents || 0;
			totals.price += servicePriceCents( s );
		} );
		return totals;
	}

	// One line under the request form explaining what's paid when: all
	// online, a pre-payment now + the rest at the visit, or everything at
	// the visit. Empty for free services.
	function paymentNoticeText( state ) {
		var totals = selectionTotals( state );
		if ( totals.deposit && totals.price > totals.deposit ) {
			return T.prepaymentNotice
				.replace( '{deposit}', formatPrice( totals.deposit, state.currency ) )
				.replace( '{price}', formatPrice( totals.price, state.currency ) )
				.replace( '{balance}', formatPrice( totals.price - totals.deposit, state.currency ) );
		}
		if ( totals.deposit ) {
			return T.paymentRequiredNotice.replace( '{amount}', formatPrice( totals.deposit, state.currency ) );
		}
		if ( totals.price ) {
			return T.payAtVisitNotice.replace( '{price}', formatPrice( totals.price, state.currency ) );
		}
		return '';
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
		var summary = T.summaryTotal.replace( '{list}', parts.join( ' + ' ) ).replace( '{total}', String( total ) );
		var priceCents = selectionTotals( state ).price;
		if ( priceCents ) summary += ' — ' + formatPrice( priceCents, state.currency );
		return summary;
	}

	function renderServicePicker( mount, widgetId, state ) {
		if ( state.services.length <= 1 ) return;

		var style = state.itemSelectorStyle;
		var multi = isMultiSelectStyle( style );
		var container = 'dropdown' === style ? null : el( 'div', 'vms-booking-widget__services--' + style );

		var summaryEl = el( 'p', 'vms-booking-widget__summary' );
		summaryEl.hidden = true;

		function refreshSelectedVisuals() {
			// container is null for 'dropdown' (a native <select> has no
			// per-option elements to toggle classes on) — skip straight to the
			// summary line in that case. Guarding this was missing entirely
			// before, so selecting a different service in a dropdown-style
			// widget threw here and never reached onServiceSelectionChanged
			// below, leaving the old slot/date and the old service's payment
			// notice stuck on screen even though a different service (and
			// price) was now selected.
			if ( container ) {
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
			}
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
				opt.textContent = serviceLabel( s, state );
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
				label.appendChild( document.createTextNode( ' ' + serviceLabel( s, state ) ) );
				container.appendChild( label );
			} );
		} else if ( 'tiles-single' === style || 'tiles-multi' === style ) {
			state.services.forEach( function ( s ) {
				var tile = el( 'button', 'vms-booking-widget__service-option' );
				tile.type = 'button';
				tile.setAttribute( 'data-vms-service-id', s.id );
				tile.appendChild( el( 'span', null, s.name ) );
				tile.appendChild( el( 'span', null, s.duration_minutes + ' min' + ( servicePriceCents( s ) ? ' — ' + formatPrice( servicePriceCents( s ), state.currency ) : '' ) ) );
				tile.addEventListener( 'click', function () {
					if ( tile.disabled ) return;
					handleSelect( s.id );
				} );
				container.appendChild( tile );
			} );
		} else if ( 'segmented' === style ) {
			state.services.forEach( function ( s ) {
				var seg = el( 'button', 'vms-booking-widget__service-option', serviceLabel( s, state ) );
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
				var header = el( 'button', null, serviceLabel( s, state ) );
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

	// ─── Staff picker ───────────────────────────────────────────────────────

	function coversServices( allowed, state ) {
		if ( ! allowed ) return true;
		return state.selectedServiceIds.every( function ( id ) {
			return allowed.indexOf( id ) !== -1;
		} );
	}

	// The people who perform EVERY selected service — no service_ids means
	// someone performs everything. With `rules`, a person qualifies when any
	// rule matches the visitor's current answers (an unanswered field never
	// matches) and covers the services — mirrors eligibleStaffFor in
	// vibemeasite-mcp's lib/booking-service.ts, which re-checks server-side.
	function eligibleStaff( state ) {
		var values = state.readFieldValues();
		return state.staff.filter( function ( p ) {
			if ( ! p.rules || ! p.rules.length ) return coversServices( p.service_ids, state );
			return p.rules.some( function ( r ) {
				if ( r.field && ( r.values || [] ).indexOf( values[ r.field ] || '' ) === -1 ) return false;
				return coversServices( r.service_ids, state );
			} );
		} );
	}

	// Custom field names any rule depends on — the picker re-filters when
	// one of these changes, and hints at the first unanswered one.
	function staffRuleFields( state ) {
		var names = [];
		state.staff.forEach( function ( p ) {
			( p.rules || [] ).forEach( function ( r ) {
				if ( r.field && names.indexOf( r.field ) === -1 ) names.push( r.field );
			} );
		} );
		return names;
	}

	function fieldLabel( state, name ) {
		for ( var i = 0; i < state.customFields.length; i++ ) {
			if ( state.customFields[ i ].name === name ) return state.customFields[ i ].label;
		}
		return name;
	}

	// Baseline look so the picker is usable on a site whose own widget CSS
	// predates it. :where() keeps specificity at zero, so any rule the Site
	// Owner's block CSS has for these classes wins without !important.
	function injectStaffBaseStyles() {
		if ( document.getElementById( 'vms-booking-staff-base' ) ) return;
		var style = document.createElement( 'style' );
		style.id = 'vms-booking-staff-base';
		style.textContent = [
			':where(.vms-booking-widget__staff){display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:16px 0;}',
			':where(.vms-booking-widget__staff[hidden]){display:none;}',
			':where(.vms-booking-widget__staff-heading){grid-column:1/-1;margin:0;font-weight:600;}',
			':where(.vms-booking-widget__staff-option){display:grid;grid-template-columns:56px 1fr;column-gap:12px;align-items:start;text-align:left;padding:10px;border:1px solid rgba(0,0,0,.15);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer;}',
			':where(.vms-booking-widget__staff-option--selected){border-color:currentColor;box-shadow:0 0 0 1px currentColor;}',
			':where(.vms-booking-widget__staff-photo){grid-row:1/3;width:56px;height:56px;border-radius:50%;object-fit:cover;object-position:center 20%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.08);font-weight:600;}',
			':where(.vms-booking-widget__staff-name){font-weight:600;}',
			':where(.vms-booking-widget__staff-description){font-size:.875em;line-height:1.4;opacity:.8;}',
			':where(.vms-booking-widget__staff-hint){grid-column:1/-1;margin:0;font-size:.875em;opacity:.8;}',
		].join( '' );
		document.head.appendChild( style );
	}

	function renderStaffPicker( state ) {
		var container = state.staffContainer;
		if ( ! container ) return;
		container.innerHTML = '';

		var eligible = eligibleStaff( state );
		var stillEligible = eligible.some( function ( p ) {
			return p.id === state.selectedStaffId;
		} );
		if ( ! stillEligible ) state.selectedStaffId = null;
		// Only one person can do it — nothing to choose, but still shown so
		// the visitor sees who they're booking with.
		if ( 1 === eligible.length ) state.selectedStaffId = eligible[ 0 ].id;

		if ( 0 === eligible.length ) {
			var values = state.readFieldValues();
			var unanswered = staffRuleFields( state ).filter( function ( name ) {
				return ! values[ name ];
			} )[ 0 ];
			container.hidden = ! unanswered;
			if ( unanswered ) {
				injectStaffBaseStyles();
				container.removeAttribute( 'role' );
				container.appendChild( el( 'p', 'vms-booking-widget__staff-heading', T.chooseStaff ) );
				container.appendChild( el( 'p', 'vms-booking-widget__staff-hint', T.staffNeedsField.replace( '{field}', fieldLabel( state, unanswered ) ) ) );
			}
			return;
		}
		container.hidden = false;

		injectStaffBaseStyles();
		container.setAttribute( 'role', 'radiogroup' );
		container.appendChild( el( 'p', 'vms-booking-widget__staff-heading', T.chooseStaff ) );

		eligible.forEach( function ( p ) {
			var btn = el( 'button', 'vms-booking-widget__staff-option' );
			btn.type = 'button';
			btn.setAttribute( 'role', 'radio' );
			btn.setAttribute( 'data-vms-staff-id', p.id );

			var photo;
			if ( p.photo_url ) {
				photo = el( 'img', 'vms-booking-widget__staff-photo' );
				photo.src = p.photo_url;
				photo.alt = '';
				photo.loading = 'lazy';
				photo.width = 56;
				photo.height = 56;
			} else {
				photo = el( 'span', 'vms-booking-widget__staff-photo', ( p.name || '?' ).charAt( 0 ).toUpperCase() );
				photo.setAttribute( 'aria-hidden', 'true' );
			}
			btn.appendChild( photo );
			btn.appendChild( el( 'span', 'vms-booking-widget__staff-name', p.name ) );
			if ( p.description ) {
				btn.appendChild( el( 'span', 'vms-booking-widget__staff-description', p.description ) );
			}

			btn.addEventListener( 'click', function () {
				state.selectedStaffId = p.id;
				refreshStaffSelection( container, state );
			} );
			container.appendChild( btn );
		} );
		refreshStaffSelection( container, state );
	}

	function refreshStaffSelection( container, state ) {
		Array.prototype.forEach.call( container.querySelectorAll( '[data-vms-staff-id]' ), function ( btn ) {
			var selected = btn.getAttribute( 'data-vms-staff-id' ) === state.selectedStaffId;
			btn.classList.toggle( 'vms-booking-widget__staff-option--selected', selected );
			btn.setAttribute( 'aria-checked', String( selected ) );
		} );
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

		var wrap = el( 'div' );
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

		var grid = el( 'div', 'vms-booking-widget__calendar-grid' );
		wrap.appendChild( grid );

		weekdayHeaderLabels().forEach( function ( label ) {
			grid.appendChild( el( 'div', 'vms-booking-widget__calendar-grid-weekday', label ) );
		} );

		var monthStr = state.calendarYear + '-' + pad2( state.calendarMonth );
		var firstOfMonth = new Date( Date.UTC( state.calendarYear, state.calendarMonth - 1, 1 ) );
		var leadingBlanks = firstOfMonth.getUTCDay();
		var daysInMonth = new Date( Date.UTC( state.calendarYear, state.calendarMonth, 0 ) ).getUTCDate();

		for ( var b = 0; b < leadingBlanks; b++ ) {
			grid.appendChild( el( 'div', 'vms-booking-widget__calendar-grid-day vms-booking-widget__calendar-grid-day--other-month' ) );
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
					Array.prototype.forEach.call( grid.querySelectorAll( '.vms-booking-widget__calendar-grid-day' ), function ( c ) {
						c.classList.remove( 'vms-booking-widget__calendar-grid-day--selected' );
					} );
					cell.classList.add( 'vms-booking-widget__calendar-grid-day--selected' );
					renderSlotsForSelectedDate( widgetId, state );
				} );
				dayCells[ ds ] = cell;
				grid.appendChild( cell );
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

		// Flexible name/contact fields follow-up — 'first_last' splits the
		// single Name input into two; either way visitorName() below joins
		// them back into the one string the request endpoint has always
		// expected, so nothing downstream of this form needs to know which
		// mode is active.
		var firstNameInput = null, lastNameInput = null, nameInput = null;
		if ( 'first_last' === state.nameFields ) {
			firstNameInput = document.createElement( 'input' );
			firstNameInput.type = 'text';
			firstNameInput.name = 'first_name';
			firstNameInput.placeholder = T.yourFirstName;
			firstNameInput.required = true;
			form.appendChild( firstNameInput );

			lastNameInput = document.createElement( 'input' );
			lastNameInput.type = 'text';
			lastNameInput.name = 'last_name';
			lastNameInput.placeholder = T.yourLastName;
			lastNameInput.required = true;
			form.appendChild( lastNameInput );
		} else {
			nameInput = document.createElement( 'input' );
			nameInput.type = 'text';
			nameInput.name = 'name';
			nameInput.placeholder = T.yourName;
			nameInput.required = true;
			form.appendChild( nameInput );
		}

		function visitorName() {
			return nameInput
				? nameInput.value
				: ( firstNameInput.value.trim() + ' ' + lastNameInput.value.trim() ).trim();
		}

		var emailInput = document.createElement( 'input' );
		emailInput.type = 'email';
		emailInput.name = 'email';
		emailInput.placeholder = T.yourEmail;
		emailInput.required = true;
		form.appendChild( emailInput );

		// Site-Owner-defined fields beyond name/email (e.g. phone, notes) —
		// see CUSTOM_FIELDS_SCHEMA in vibemeasite-mcp's api/_server.ts. Each
		// field's `type` maps directly to an <input type="..."> except
		// 'textarea', 'select' and 'radio', which need their own elements.
		// select/radio options arrive as { value, label }: `value` is always
		// the default-language option (what the owner sees in the booking),
		// `label` is translated for the page's language.
		// customFieldValueGetters: field name -> function returning its value.
		var customFieldValueGetters = {};
		state.customFields.forEach( function ( field ) {
			if ( 'select' === field.type ) {
				var select = document.createElement( 'select' );
				select.className = 'vms-booking-widget__field-select';
				select.name = field.name;
				select.required = !! field.required;
				select.setAttribute( 'aria-label', field.label );
				// Disabled+selected empty first option doubles as the label,
				// matching the placeholder-as-label style of the other inputs,
				// and makes `required` actually block an untouched dropdown.
				var placeholder = el( 'option', null, field.label );
				placeholder.value = '';
				placeholder.disabled = true;
				placeholder.selected = true;
				select.appendChild( placeholder );
				( field.options || [] ).forEach( function ( opt ) {
					var option = el( 'option', null, opt.label );
					option.value = opt.value;
					select.appendChild( option );
				} );
				form.appendChild( select );
				customFieldValueGetters[ field.name ] = function () {
					return select.value;
				};
				return;
			}

			if ( 'radio' === field.type ) {
				var fieldset = document.createElement( 'fieldset' );
				fieldset.className = 'vms-booking-widget__field-radio';
				fieldset.appendChild( el( 'legend', null, field.label ) );
				var radios = [];
				( field.options || [] ).forEach( function ( opt, i ) {
					var optionLabel = el( 'label', 'vms-booking-widget__field-radio-option' );
					var radio = document.createElement( 'input' );
					radio.type = 'radio';
					radio.name = field.name;
					radio.value = opt.value;
					// One required radio in a same-name group makes the
					// whole group required for native form validation.
					if ( 0 === i ) radio.required = !! field.required;
					optionLabel.appendChild( radio );
					optionLabel.appendChild( document.createTextNode( ' ' + opt.label ) );
					fieldset.appendChild( optionLabel );
					radios.push( radio );
				} );
				form.appendChild( fieldset );
				customFieldValueGetters[ field.name ] = function () {
					for ( var i = 0; i < radios.length; i++ ) {
						if ( radios[ i ].checked ) return radios[ i ].value;
					}
					return '';
				};
				return;
			}

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
			customFieldValueGetters[ field.name ] = function () {
				return input.value;
			};
		} );

		state.readFieldValues = function () {
			var values = {};
			Object.keys( customFieldValueGetters ).forEach( function ( name ) {
				values[ name ] = customFieldValueGetters[ name ]();
			} );
			return values;
		};
		state.staffContainer = el( 'div', 'vms-booking-widget__staff' );
		form.appendChild( state.staffContainer );
		renderStaffPicker( state );
		var ruleFields = staffRuleFields( state );
		if ( ruleFields.length ) {
			form.addEventListener( 'change', function ( e ) {
				if ( e.target && ruleFields.indexOf( e.target.name ) !== -1 ) renderStaffPicker( state );
			} );
		}

		if ( state.formNotice ) {
			form.appendChild( el( 'p', 'vms-booking-widget__notice', state.formNotice ) );
		}

		// BSA Phase 23 — shown once, computed from the service selection
		// already locked in by the time this form renders (changing
		// services means going back to pick a slot again, which re-renders
		// this form fresh) — no live-update wiring needed here.
		var paymentNotice = paymentNoticeText( state );
		if ( paymentNotice ) {
			form.appendChild( el( 'p', 'vms-booking-widget__payment-notice', paymentNotice ) );
		}

		var submitBtn = el( 'button', 'vms-booking-widget__submit', T.requestThisTime );
		submitBtn.type = 'submit';
		form.appendChild( submitBtn );

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();

			if ( eligibleStaff( state ).length && ! state.selectedStaffId ) {
				showFormError( form, T.chooseStaffError );
				if ( state.staffContainer && state.staffContainer.scrollIntoView ) {
					state.staffContainer.scrollIntoView( { behavior: 'smooth', block: 'center' } );
				}
				return;
			}
			submitBtn.disabled = true;

			var customFieldValues = {};
			Object.keys( customFieldValueGetters ).forEach( function ( name ) {
				customFieldValues[ name ] = customFieldValueGetters[ name ]();
			} );

			fetchJson( REQUEST_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( {
					widget_public_id: widgetId,
					service_ids: state.selectedServiceIds,
					start_iso: state.selectedSlot.startIso,
					visitor_name: visitorName(),
					visitor_email: emailInput.value,
					custom_field_values: customFieldValues,
					staff_id: state.selectedStaffId,
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
				// site_base_url (BSA Phase 23) — only actually used server-side
				// when the requested service(s) owe a deposit; harmless to always
				// send. window.location.origin is this tenant's own live domain,
				// same value the relay would otherwise have had to guess.
				body: JSON.stringify( { request_id: state.requestId, code: codeInput.value, site_base_url: window.location.origin } ),
			} )
				.then( function ( result ) {
					submitBtn.disabled = false;
					if ( 200 !== result.status || ! result.json.ok ) {
						showFormError( form, ( result.json && result.json.message ) || GENERIC_ERROR );
						return;
					}
					if ( result.json.requires_payment ) {
						renderMessage( formContainer, T.redirectingToPayment );
						window.location.href = result.json.checkout_url;
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
