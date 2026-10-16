/**
 * GA4 booking-funnel tracking (template v56) — the shared helper every
 * booking_* event goes through, plus the two pieces of the funnel that live
 * outside the booking widget itself: CTA clicks that lead to it, and the
 * post-payment conversion on /booking-confirmed. booking.js does the rest
 * (view → service → staff → date → slot → form → submit → success/error)
 * through window.vmsBookingAnalytics.track.
 *
 * Only included when app/layout.tsx actually rendered GTM and/or GA4 for
 * this request — i.e. never on an unclaimed staging preview, and never
 * before the visitor accepted the cookie banner when that banner is on.
 * That server-side gate is the consent model (there's no Consent Mode),
 * so no consent check is repeated here: if this script runs, analytics is
 * allowed. layout.tsx sets window.__vmsAnalytics = { gtm, ga } just before
 * it, saying which of the two is present.
 *
 * Delivery: GTM configured → dataLayer.push({ event, ...params }) only
 * (the Site Owner's GTM container forwards it to GA4, see the booking
 * funnel guide); GA4 only → gtag('event', ...) only. Never both, so a site
 * with both IDs set doesn't count every event twice. Never throws.
 *
 * No PII, ever: params pass through a fixed allowlist (visitor name,
 * email, phone and custom field answers have no key to travel under), and
 * any string value containing "@" is dropped as a last line of defence.
 */
( function () {
	if ( window.__vmsAnalyticsInit ) return;
	window.__vmsAnalyticsInit = true;

	var cfg = window.__vmsAnalytics || {};
	var BOOKING_SELECTOR = '[data-cellpy-booking-widget]';
	var CTA_RECORD_KEY = 'vms_booking_cta_click';
	var CTA_MAX_AGE_MS = 60 * 1000;
	var PENDING_PREFIX = 'vms_booking_pending_';
	var DONE_PREFIX = 'vms_booking_done_';

	var ALLOWED_PARAMS = {
		widget_id: true,
		widget_placement: true,
		cta_location: true,
		page_path: true,
		service_name: true,
		service_count: true,
		staff_name: true,
		slot_date: true,
		slot_time: true,
		selection_method: true,
		value: true,
		currency: true,
		booking_id: true,
		error_type: true,
		step: true,
		link_location: true,
		form_id: true,
	};

	function sanitize( params ) {
		var out = {};
		if ( ! params || 'object' !== typeof params ) return out;
		Object.keys( params ).forEach( function ( key ) {
			if ( ! ALLOWED_PARAMS[ key ] ) return;
			var v = params[ key ];
			if ( 'number' === typeof v ) {
				if ( isFinite( v ) ) out[ key ] = v;
			} else if ( 'boolean' === typeof v ) {
				out[ key ] = v;
			} else if ( 'string' === typeof v ) {
				v = v.trim();
				if ( v && v.indexOf( '@' ) === -1 ) out[ key ] = v.slice( 0, 100 );
			}
		} );
		return out;
	}

	function track( name, params ) {
		try {
			if ( 'string' !== typeof name || ! /^[a-z][a-z0-9_]{0,39}$/.test( name ) ) return;
			var clean = sanitize( params );
			if ( cfg.gtm ) {
				window.dataLayer = window.dataLayer || [];
				var msg = { event: name };
				Object.keys( clean ).forEach( function ( k ) { msg[ k ] = clean[ k ]; } );
				window.dataLayer.push( msg );
			} else if ( cfg.ga && 'function' === typeof window.gtag ) {
				window.gtag( 'event', name, clean );
			}
		} catch ( e ) {
			// Analytics must never break the page or the booking flow.
		}
	}

	function storageGet( store, key ) {
		try { return window[ store ].getItem( key ); } catch ( e ) { return null; }
	}
	function storageSet( store, key, value ) {
		try { window[ store ].setItem( key, value ); return true; } catch ( e ) { return false; }
	}
	function storageRemove( store, key ) {
		try { window[ store ].removeItem( key ); } catch ( e ) { /* ignore */ }
	}

	// Called by booking.js right before it redirects to a deposit checkout —
	// /booking-confirmed (below) fires the conversion with these params once
	// the visitor comes back from paying. sessionStorage survives the
	// cross-origin round trip within the same tab.
	function stashPending( bookingId, params ) {
		if ( ! bookingId ) return;
		storageSet( 'sessionStorage', PENDING_PREFIX + bookingId, JSON.stringify( sanitize( params ) ) );
	}

	function conversion( params ) {
		track( 'booking_success', params );
		// GA4's recommended lead event — same value/currency, so Google Ads
		// conversion imports work without any extra mapping.
		var lead = {};
		if ( params.value !== undefined ) lead.value = params.value;
		if ( params.currency ) lead.currency = params.currency;
		if ( params.widget_id ) lead.widget_id = params.widget_id;
		if ( params.booking_id ) lead.booking_id = params.booking_id;
		track( 'generate_lead', lead );
	}

	window.vmsBookingAnalytics = { track: track, stashPending: stashPending, conversion: conversion };

	// ─── Site-wide lead events (template v59) ───────────────────────────────
	// phone_click: any tel: link (header, footer, floating call button, or a
	// number inside a section) — link_location says which, never the number.
	// form_submit + generate_lead: forms.js calls formSubmit() only after the
	// server confirmed the submission, with the form's container slug.

	function formSubmit( formId ) {
		var params = { form_id: formId, page_path: window.location.pathname };
		track( 'form_submit', params );
		track( 'generate_lead', params );
	}

	window.vmsAnalytics = { track: track, formSubmit: formSubmit };

	// ─── CTA clicks ─────────────────────────────────────────────────────────

	function normalizePath( p ) {
		p = ( p || '/' ).replace( /\/+$/, '' );
		return p || '/';
	}
	function stripLocale( p ) {
		return p.replace( /^\/[a-z]{2}(?:-[a-z]{2,4})?(?=\/|$)/i, '' ) || '/';
	}
	function samePage( a, b ) {
		a = normalizePath( a );
		b = normalizePath( b );
		return a === b || stripLocale( a ) === stripLocale( b );
	}

	function containsBooking( node ) {
		if ( ! node || 1 !== node.nodeType ) return false;
		return node.matches( BOOKING_SELECTOR ) || !! node.querySelector( BOOKING_SELECTOR ) || !! node.closest( BOOKING_SELECTOR );
	}
	function widgetIdIn( node ) {
		var w = node && 1 === node.nodeType
			? ( node.matches( BOOKING_SELECTOR ) ? node : node.querySelector( BOOKING_SELECTOR ) || node.closest( BOOKING_SELECTOR ) )
			: document.querySelector( BOOKING_SELECTOR );
		return w ? w.getAttribute( 'data-cellpy-booking-widget' ) : '';
	}

	function ctaLocation( el ) {
		var explicit = el.closest( '[data-vms-booking-cta]' );
		if ( explicit && explicit.getAttribute( 'data-vms-booking-cta' ) ) return explicit.getAttribute( 'data-vms-booking-cta' );
		if ( el.closest( '.fw-slot' ) ) return 'floating';
		if ( el.closest( '.fw-popup' ) ) return 'popup';
		if ( el.closest( '.nav-cta' ) ) return 'header_cta';
		if ( el.closest( '.nav-top, .nav-side' ) ) return 'header';
		if ( el.closest( '.vms-side-menu' ) ) return 'side_menu';
		if ( el.closest( '.cellpy-block-site-footer' ) ) return 'footer';
		return 'section';
	}

	// The element a click opens or scrolls to on THIS page, if any: a
	// data-modal-open target, a same-page #hash, or a popup floating
	// widget's panel.
	function sameDocumentTarget( el ) {
		var modalId = el.getAttribute( 'data-modal-open' );
		if ( modalId ) return document.getElementById( modalId );
		var slot = el.closest( '.fw-slot[data-fw-mode="popup"]' );
		if ( slot ) return document.getElementById( 'fw-popup-' + slot.getAttribute( 'data-fw-widget-id' ) );
		if ( 'A' === el.tagName && el.getAttribute( 'href' ) ) {
			var url;
			try { url = new URL( el.getAttribute( 'href' ), window.location.href ); } catch ( e ) { return null; }
			if ( url.origin === window.location.origin && samePage( url.pathname, window.location.pathname ) && url.hash.length > 1 ) {
				try { return document.getElementById( decodeURIComponent( url.hash.slice( 1 ) ) ); } catch ( e ) { return null; }
			}
		}
		return null;
	}

	function fireCta( location, fromPath, widgetId ) {
		track( 'booking_cta_click', { cta_location: location, page_path: fromPath, widget_id: widgetId } );
	}

	function onClick( e ) {
		try {
			var el = e.target && e.target.closest ? e.target.closest( 'a[href], button, [data-vms-booking-cta]' ) : null;
			if ( ! el ) return;
			if ( 'A' === el.tagName && /^\s*tel:/i.test( el.getAttribute( 'href' ) ) ) {
				track( 'phone_click', { link_location: ctaLocation( el ), page_path: window.location.pathname } );
				return;
			}
			if ( el.closest( BOOKING_SELECTOR ) ) return; // the widget's own buttons aren't CTAs
			var location = ctaLocation( el );
			var target = sameDocumentTarget( el );
			if ( target && containsBooking( target ) ) {
				fireCta( location, window.location.pathname, widgetIdIn( target ) );
				return;
			}
			if ( el.hasAttribute( 'data-vms-booking-cta' ) ) {
				fireCta( location, window.location.pathname, widgetIdIn( null ) );
				return;
			}
			// Any other internal link: we can't know from here whether the
			// destination page has a booking widget, so note the click and let
			// that page decide (consumeCtaRecord, below) — fired only if it
			// does, within a minute.
			if ( 'A' === el.tagName ) {
				var url = new URL( el.getAttribute( 'href' ), window.location.href );
				if ( url.origin !== window.location.origin || samePage( url.pathname, window.location.pathname ) ) return;
				storageSet( 'sessionStorage', CTA_RECORD_KEY, JSON.stringify( {
					path: url.pathname,
					location: location,
					from: window.location.pathname,
					t: Date.now(),
				} ) );
			}
		} catch ( err ) {
			// never block navigation
		}
	}

	function consumeCtaRecord() {
		var raw = storageGet( 'sessionStorage', CTA_RECORD_KEY );
		if ( ! raw ) return;
		storageRemove( 'sessionStorage', CTA_RECORD_KEY );
		if ( ! document.querySelector( BOOKING_SELECTOR ) ) return;
		var rec;
		try { rec = JSON.parse( raw ); } catch ( e ) { return; }
		if ( ! rec || ! rec.path || ! samePage( rec.path, window.location.pathname ) ) return;
		if ( ! ( Date.now() - rec.t >= 0 && Date.now() - rec.t < CTA_MAX_AGE_MS ) ) return;
		fireCta( rec.location, rec.from, widgetIdIn( null ) );
	}

	// ─── Post-payment conversion ────────────────────────────────────────────

	function handleBookingConfirmedPage() {
		if ( ! /(^|\/)booking-confirmed\/?$/.test( window.location.pathname ) ) return;
		var bookingId = new URLSearchParams( window.location.search ).get( 'request_id' );
		if ( ! bookingId ) return;
		// Fire at most once per booking, even across reloads/new tabs.
		if ( storageGet( 'localStorage', DONE_PREFIX + bookingId ) ) return;
		var raw = storageGet( 'sessionStorage', PENDING_PREFIX + bookingId );
		var params = {};
		if ( raw ) {
			try { params = JSON.parse( raw ) || {}; } catch ( e ) { params = {}; }
		} else if ( ! storageSet( 'localStorage', DONE_PREFIX + bookingId, '1' ) ) {
			// No stash and no way to remember we fired — a reload would count
			// the booking twice, so skip rather than over-count.
			return;
		}
		storageSet( 'localStorage', DONE_PREFIX + bookingId, '1' );
		storageRemove( 'sessionStorage', PENDING_PREFIX + bookingId );
		params.booking_id = bookingId;
		conversion( params );
	}

	function init() {
		document.addEventListener( 'click', onClick, true );
		consumeCtaRecord();
		handleBookingConfirmedPage();
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
