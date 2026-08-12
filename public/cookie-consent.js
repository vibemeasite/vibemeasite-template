/**
 * Cookie consent banner interactivity for the Cellpy cookie-banner block
 * rendered by this template (Phase 12). Host-page script, not sandboxed
 * block content — same architecture as booking.js/forms.js: the block's
 * own HTML (vibemeasite-mcp's lib/cookie-banner-template.ts) is a fixed
 * skeleton whose two top-level pieces both ship `hidden`; this script
 * decides which one to reveal and wires up the buttons. Styled entirely by
 * whatever CSS the Site Owner's block carries, targeting the class-name
 * contract documented alongside that fixed skeleton. Only included when
 * site_settings.cookie_banner_enabled is true — see app/layout.tsx.
 *
 * The actual GA/GTM/Meta Pixel consent gate lives server-side in
 * app/layout.tsx (reads the same cellpy_consent cookie this script
 * writes) — this script only ever controls what the visitor SEES, never
 * what scripts load. A reload after Accept/Reject is what makes a new
 * decision actually take effect, same trade-off booking.js/lang-switcher.js
 * already make for their own state changes rather than duplicating
 * layout.tsx's server-side logic here.
 */
( function () {
	var CONSENT_COOKIE = 'cellpy_consent';
	var CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, matches cellpy_lang

	// GA4 (_ga, _ga_<property>), Universal Analytics/GTM (_gat, _gat_gtag_<id>),
	// Meta Pixel (_fbp, _fbc), and Google's cross-domain linker (_gcl_au) — a
	// prefix match since the property/container ID is baked into several of
	// these, so there's no fixed list of exact names to match against.
	var TRACKING_COOKIE_PREFIXES = [ '_ga', '_gid', '_gat', '_fbp', '_fbc', '_gcl_au' ];

	function purgeTrackingCookies() {
		document.cookie.split( '; ' ).forEach( function ( pair ) {
			var name = pair.split( '=' )[ 0 ];
			if ( ! name ) return;
			var isTracking = TRACKING_COOKIE_PREFIXES.some( function ( prefix ) { return name.indexOf( prefix ) === 0; } );
			if ( ! isTracking ) return;
			// Host-only cookies clear with just a path match; GA/Meta more
			// often set theirs on the registrable domain, so also try the
			// explicit leading-dot domain form — an unmatched domain
			// attribute is simply ignored by the browser, harmless when it
			// doesn't apply.
			document.cookie = name + '=; Max-Age=0; path=/';
			document.cookie = name + '=; Max-Age=0; path=/; domain=.' + location.hostname;
		} );
	}

	function readConsent() {
		var match = document.cookie.match( /(?:^|; )cellpy_consent=([^;]+)/ );
		return match ? decodeURIComponent( match[ 1 ] ) : null;
	}

	function decide( choice ) {
		if ( choice === 'rejected' ) purgeTrackingCookies();
		document.cookie = CONSENT_COOKIE + '=' + choice + '; path=/; max-age=' + CONSENT_MAX_AGE + '; SameSite=Lax';
		window.location.reload();
	}

	// One cookie banner per site (fixed slug, sitewide) — no need for the
	// multi-instance forEach pattern lang-switcher.js uses for its own
	// (potentially repeated) widget. `reopen` is optional — set_cookie_banner's
	// reopen_enabled: false omits it from the skeleton entirely (not just
	// hides it), so a missing reopen must not stop the banner itself from
	// working — only bail out if the banner itself isn't there.
	var banner = document.querySelector( '[data-cellpy-cookie-banner]' );
	if ( ! banner ) return;
	var reopen = document.querySelector( '.cookie-settings-reopen' );

	if ( readConsent() ) {
		if ( reopen ) reopen.hidden = false;
	} else {
		banner.hidden = false;
	}

	var acceptBtn = banner.querySelector( '.cookie-banner-accept' );
	var rejectBtn = banner.querySelector( '.cookie-banner-reject' );
	if ( acceptBtn ) acceptBtn.addEventListener( 'click', function () { decide( 'accepted' ); } );
	if ( rejectBtn ) rejectBtn.addEventListener( 'click', function () { decide( 'rejected' ); } );

	// Reopening doesn't touch the stored decision — only Accept/Reject do.
	if ( reopen ) {
		reopen.addEventListener( 'click', function () {
			reopen.hidden = true;
			banner.hidden = false;
		} );
	}
} )();
