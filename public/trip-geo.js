/**
 * BSA Phase 27 (slice 4) — live location on a trip page. Loaded by
 * components/TripPage.tsx in the participant version only.
 *
 * During the trip (start − 1 h … end), or after the hidden test word
 * "vmsgps" (public/trip.js), it offers "Turn on location" — or starts by
 * itself when the permission was already granted — and then:
 *   - draws a "you are here" dot on the route map, snapped to the nearest
 *     trail leg (the map is a storybook schematic, not to scale, so a raw
 *     projection would be meaningless);
 *   - rings the nearest reachable stop (see below);
 *   - on arrival (within the stop's reveal radius, plus up to 100 m of GPS
 *     error) reveals the stop and opens its panel ONCE per device, with a
 *     vibration and a toast. Never autoplays audio, and never opens a panel
 *     over an audio guide that is playing.
 * The position never leaves the phone: nothing is sent to the server.
 *
 * A stop sharing its place with an earlier stop (a round trip back to the
 * start) only counts — for arrival and for "nearest" — once it is the next stop — otherwise standing at the
 * start would unlock the whole trip.
 */
( function () {
	if ( window.__vmsTripGeoInit ) return;
	window.__vmsTripGeoInit = true;

	var MAX_ACCURACY = 500; // m — worse fixes are ignored
	var ACC_SLACK = 100; // m — most GPS error added to a stop's radius
	var THROTTLE = 5000; // ms between processed fixes
	var BEFORE_START = 3600000; // ms — location is offered from 1 h before start

	var root, api, T, box, stops = [], arrivedKey = '', watchId = null, lastFix = 0, lastPos = null, pending = null, pendingTimer = null;

	function load( key ) {
		try { return window.localStorage.getItem( key ); } catch ( e ) { return null; }
	}
	function save( key, value ) {
		try { window.localStorage.setItem( key, value ); } catch ( e ) { /* private mode */ }
	}
	function arrived() {
		var out = {};
		( load( arrivedKey ) || '' ).split( ',' ).forEach( function ( p ) { if ( p ) out[ p ] = true; } );
		return out;
	}
	function markArrived( pos ) {
		var a = arrived();
		// Arriving at stop N also settles every earlier stop (no late pop-ups).
		stops.forEach( function ( s ) { if ( s.pos <= pos ) a[ s.pos ] = true; } );
		save( arrivedKey, Object.keys( a ).join( ',' ) );
	}

	// ── Geometry ────────────────────────────────────────────────────────────
	var R = 6371000;
	function rad( d ) { return d * Math.PI / 180; }
	function haversine( lat1, lng1, lat2, lng2 ) {
		var dLat = rad( lat2 - lat1 ), dLng = rad( lng2 - lng1 );
		var h = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) + Math.cos( rad( lat1 ) ) * Math.cos( rad( lat2 ) ) * Math.sin( dLng / 2 ) * Math.sin( dLng / 2 );
		return 2 * R * Math.asin( Math.min( 1, Math.sqrt( h ) ) );
	}
	// Local metres around `ref` (equirectangular — fine at city scale).
	function local( ref, lat, lng ) {
		return { x: rad( lng - ref.lng ) * R * Math.cos( rad( ref.lat ) ), y: rad( lat - ref.lat ) * R };
	}
	// Closest leg (stop i → i+1) to the user: { leg, t (0..1), d (m) }.
	function nearestLeg( me ) {
		var best = null;
		for ( var i = 0; i + 1 < stops.length; i++ ) {
			var a = local( me, stops[ i ].lat, stops[ i ].lng );
			var b = local( me, stops[ i + 1 ].lat, stops[ i + 1 ].lng );
			var dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
			var t = len2 ? Math.max( 0, Math.min( 1, ( -a.x * dx - a.y * dy ) / len2 ) ) : 0;
			var px = a.x + t * dx, py = a.y + t * dy;
			var d = Math.sqrt( px * px + py * py );
			if ( ! best || d < best.d - 0.5 ) best = { leg: i, t: t, d: d };
		}
		return best;
	}

	// ── Map ─────────────────────────────────────────────────────────────────
	var SVG_NS = 'http://www.w3.org/2000/svg';
	function pinsFor( pos ) {
		return Array.prototype.filter.call( root.querySelectorAll( '.vms-route__stop' ), function ( pin ) {
			return ( ',' + ( pin.getAttribute( 'data-stops' ) || pin.getAttribute( 'data-stop' ) ) + ',' ).indexOf( ',' + pos + ',' ) >= 0;
		} );
	}
	function pinCenter( svg, pos ) {
		var pin = pinsFor( pos ).filter( function ( p ) { return p.ownerSVGElement === svg; } )[ 0 ];
		if ( ! pin ) return null;
		try {
			var b = pin.getBBox();
			return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
		} catch ( e ) { return null; }
	}
	function dotFor( svg ) {
		var dot = svg.querySelector( '.vms-route__me' );
		if ( dot ) return dot;
		dot = document.createElementNS( SVG_NS, 'g' );
		dot.setAttribute( 'class', 'vms-route__me' );
		dot.setAttribute( 'aria-hidden', 'true' );
		dot.innerHTML = '<circle r="26" class="vms-route__me-pulse"/><circle r="11" class="vms-route__me-halo"/><circle r="7" class="vms-route__me-dot"/>';
		svg.appendChild( dot ); // last child: drawn above pins and labels
		return dot;
	}
	function placeDot( me ) {
		var near = stops.length > 1 ? nearestLeg( me ) : { leg: 0, t: 0, d: haversine( me.lat, me.lng, stops[ 0 ].lat, stops[ 0 ].lng ) };
		root.querySelectorAll( '.vms-route__svg' ).forEach( function ( svg ) {
			var pt = null;
			var path = svg.querySelector( '[data-leg="' + near.leg + '"]' );
			if ( path ) {
				try { pt = path.getPointAtLength( near.t * path.getTotalLength() ); } catch ( e ) { pt = null; }
			}
			if ( ! pt ) pt = pinCenter( svg, stops[ near.t > 0.5 && stops[ near.leg + 1 ] ? near.leg + 1 : near.leg ].pos );
			if ( ! pt ) return;
			var dot = dotFor( svg );
			dot.setAttribute( 'transform', 'translate(' + Math.round( pt.x ) + ' ' + Math.round( pt.y ) + ')' );
			// Far from the route (> 2 km): a hollow dot — "you are somewhere off the map".
			dot.classList.toggle( 'is-far', near.d > 2000 );
		} );
	}
	function ringNearest( pos ) {
		root.querySelectorAll( '.vms-route__stop.is-near' ).forEach( function ( p ) { p.classList.remove( 'is-near' ); } );
		if ( pos !== null ) pinsFor( pos ).forEach( function ( p ) { p.classList.add( 'is-near' ); } );
	}

	// ── Status panel ────────────────────────────────────────────────────────
	function esc( s ) {
		return String( s ).replace( /[&<>"]/g, function ( c ) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ c ]; } );
	}
	function fmtDist( m ) {
		var lang = document.documentElement.lang || 'en';
		try {
			return m < 1000
				? new Intl.NumberFormat( lang, { style: 'unit', unit: 'meter', maximumFractionDigits: 0 } ).format( Math.round( m / 10 ) * 10 )
				: new Intl.NumberFormat( lang, { style: 'unit', unit: 'kilometer', maximumFractionDigits: 1 } ).format( m / 1000 );
		} catch ( e ) {
			return m < 1000 ? Math.round( m ) + ' m' : ( m / 1000 ).toFixed( 1 ) + ' km';
		}
	}
	function showButton() {
		box.hidden = false;
		box.className = 'vms-geo';
		box.innerHTML = '<button type="button" class="vms-geo__on">📍 ' + esc( T.geoOn || 'Turn on location' ) + '</button>'
			+ '<p class="vms-geo__hint">' + esc( T.geoHint || '' ) + '</p>';
		box.querySelector( '.vms-geo__on' ).addEventListener( 'click', start );
	}
	function status( text, cls ) {
		box.hidden = false;
		box.className = 'vms-geo vms-geo--' + cls;
		box.innerHTML = '<p class="vms-geo__status"><span class="vms-geo__icon" aria-hidden="true">📍</span> ' + text + '</p>';
	}

	// ── Location ────────────────────────────────────────────────────────────
	function onFix( p, force ) {
		var now = Date.now();
		// Throttled, but never dropped: a phone standing still sends no new fix,
		// so the latest one is processed when the interval is up.
		if ( ! force && now - lastFix < THROTTLE ) {
			pending = p;
			if ( ! pendingTimer ) pendingTimer = setTimeout( function () { pendingTimer = null; if ( pending ) onFix( pending, true ); }, THROTTLE - ( now - lastFix ) );
			return;
		}
		pending = null;
		var c = p.coords;
		if ( ! c || c.accuracy > MAX_ACCURACY ) {
			if ( ! lastPos ) status( esc( T.geoFinding || 'Finding your location…' ), 'finding' );
			return;
		}
		lastFix = now;
		var me = { lat: c.latitude, lng: c.longitude, acc: c.accuracy };
		lastPos = me;
		var upTo = api.upTo();
		var done = arrived();
		var nearest = null, nearestD = Infinity, arrival = null;
		stops.forEach( function ( s ) {
			var d = haversine( me.lat, me.lng, s.lat, s.lng );
			s.d = d;
			var reachable = s.pos <= upTo + 1 || ! s.dupOfEarlier;
			if ( reachable && d < nearestD ) { nearest = s; nearestD = d; }
			if ( reachable && ! done[ s.pos ] && d <= s.radius + Math.min( me.acc, ACC_SLACK ) ) {
				if ( ! arrival || s.pos < arrival.pos ) arrival = s;
			}
		} );
		placeDot( me );
		ringNearest( nearest ? nearest.pos : null );
		status( nearest
			? esc( T.geoNearest || 'Nearest stop:' ) + ' <strong>' + esc( nearest.title ) + '</strong> · ' + esc( fmtDist( nearestD ) )
			: esc( T.geoFinding || 'Finding your location…' ), 'on' );
		if ( arrival ) arrive( arrival );
	}
	function arrive( s ) {
		markArrived( s.pos );
		var playing = Array.prototype.some.call( document.querySelectorAll( 'audio' ), function ( a ) { return ! a.paused; } );
		api.reveal( s.pos, ! playing );
		try { if ( navigator.vibrate ) navigator.vibrate( [ 180, 90, 180 ] ); } catch ( e ) { /* not allowed */ }
		api.toast( ( T.geoArrived || "You've arrived:" ) + ' ' + s.title );
	}
	function onError( err ) {
		if ( err && err.code === 1 ) {
			stopWatch();
			status( esc( T.geoDenied || 'Location is blocked.' ), 'denied' );
		} else if ( ! lastPos ) {
			status( esc( T.geoUnavailable || "Can't get your location right now." ), 'finding' );
		}
	}
	var OPTS = { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 };
	function start() {
		if ( watchId !== null || ! navigator.geolocation ) return;
		status( esc( T.geoFinding || 'Finding your location…' ), 'finding' );
		watchId = navigator.geolocation.watchPosition( function ( p ) { onFix( p, false ); }, onError, OPTS );
		save( 'vms-trip-geo:' + location.host, '1' );
	}
	function stopWatch() {
		if ( watchId !== null && navigator.geolocation ) navigator.geolocation.clearWatch( watchId );
		watchId = null;
	}
	// Phones pause watchPosition in the background: ask for a fresh fix on return.
	document.addEventListener( 'visibilitychange', function () {
		if ( document.visibilityState !== 'visible' || watchId === null ) return;
		navigator.geolocation.getCurrentPosition( function ( p ) { onFix( p, true ); }, function () {}, OPTS );
	} );

	function inTrip() {
		var s = Date.parse( root.getAttribute( 'data-start-at' ) || '' );
		var e = Date.parse( root.getAttribute( 'data-end-at' ) || '' );
		var now = Date.now();
		return ! isNaN( s ) && ! isNaN( e ) && now >= s - BEFORE_START && now <= e;
	}

	function offer() {
		if ( ! navigator.geolocation ) return;
		var auto = function () { start(); };
		// Already granted (or turned on here before) → start without a tap.
		if ( navigator.permissions && navigator.permissions.query ) {
			navigator.permissions.query( { name: 'geolocation' } ).then( function ( r ) {
				if ( r.state === 'granted' ) auto();
				else if ( r.state === 'denied' ) status( esc( T.geoDenied || 'Location is blocked.' ), 'denied' );
				else showButton();
			}, showButton );
		} else if ( load( 'vms-trip-geo:' + location.host ) === '1' ) auto();
		else showButton();
	}

	function init() {
		root = document.querySelector( '.vms-trip[data-mode="participant"]' );
		api = window.__vmsTrip;
		if ( ! root || ! api ) return;
		T = api.T || {};
		box = root.querySelector( '.vms-geo' );
		if ( ! box ) return;
		arrivedKey = 'vms-trip-arrived:' + location.host + ':' + ( root.getAttribute( 'data-trip' ) || '' );
		root.querySelectorAll( '.vms-stop' ).forEach( function ( el ) {
			var lat = parseFloat( el.getAttribute( 'data-lat' ) ), lng = parseFloat( el.getAttribute( 'data-lng' ) );
			if ( isNaN( lat ) || isNaN( lng ) ) return;
			stops.push( {
				pos: parseInt( el.getAttribute( 'data-stop' ), 10 ),
				lat: lat,
				lng: lng,
				radius: parseFloat( el.getAttribute( 'data-radius' ) ) || 300,
				title: el.getAttribute( 'data-title' ) || '',
			} );
		} );
		stops.sort( function ( a, b ) { return a.pos - b.pos; } );
		stops.forEach( function ( s, i ) {
			s.dupOfEarlier = stops.slice( 0, i ).some( function ( e ) {
				return haversine( s.lat, s.lng, e.lat, e.lng ) <= Math.max( s.radius, e.radius );
			} );
		} );
		if ( ! stops.length ) return;
		document.addEventListener( 'vms-trip-gps-test', function () {
			api.toast( T.testGps || 'Test: location on' );
			start();
		} );
		if ( inTrip() ) offer();
	}

	if ( window.__vmsTrip ) init();
	else document.addEventListener( 'vms-trip-ready', init, { once: true } );
} )();
