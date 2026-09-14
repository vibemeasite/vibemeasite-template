/**
 * Shop widget interactivity for the Cellpy shop-widget block rendered by
 * this template (BSA Phase 20). Host-page script, not sandboxed block
 * content — same architecture as booking.js: the block's own HTML
 * (vibemeasite-mcp's lib/shop-widget-template.ts) is just a fixed,
 * mostly-empty mount point; all the actual UI here is built with plain DOM
 * APIs, styled by whatever CSS the Site Owner's block carries, targeting
 * the class-name contract documented alongside that fixed skeleton.
 *
 * Also owns the Phase 19 OTP login modal — a shopper only ever needs to
 * log in mid-checkout on this platform, so there's no separate
 * conditionally-loaded shopper-auth script the way booking.js is separate
 * from, say, forms.js.
 *
 * English only for v1 — booking.js's UI_STRINGS multi-language pattern is
 * the established precedent for adding more languages here later; not
 * done yet, deliberately, to keep this session's scope to one working
 * demo flow first (see BSA Phase 20's Deferred notes).
 */
( function () {
	if ( window.__cellpyShopInit ) return;
	window.__cellpyShopInit = true;

	var PRODUCTS_ENDPOINT = '/api/commerce/products';
	var CART_ENDPOINT = '/api/commerce/cart';
	var CART_ADD_ENDPOINT = '/api/commerce/cart-add';
	var CART_UPDATE_ENDPOINT = '/api/commerce/cart-update';
	var CHECKOUT_ENDPOINT = '/api/commerce/checkout';
	var SESSION_ENDPOINT = '/api/shopper-auth/session';
	var REQUEST_CODE_ENDPOINT = '/api/shopper-auth/request-code';
	var VERIFY_CODE_ENDPOINT = '/api/shopper-auth/verify-code';

	var GENERIC_ERROR = 'Something went wrong. Please try again.';

	function el( tag, className, text ) {
		var node = document.createElement( tag );
		if ( className ) node.className = className;
		if ( text !== undefined && text !== null ) node.textContent = text;
		return node;
	}

	function formatCents( cents ) {
		return '$' + ( cents / 100 ).toFixed( 2 );
	}

	function postJson( url, body ) {
		return fetch( url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( body || {} ),
		} ).then( function ( res ) {
			return res.json().then( function ( json ) {
				return { status: res.status, json: json };
			} );
		} );
	}

	function getJson( url ) {
		return fetch( url ).then( function ( res ) {
			return res.json().then( function ( json ) {
				return { status: res.status, json: json };
			} );
		} );
	}

	function setupWidget( wrapper ) {
		var shopId = wrapper.getAttribute( 'data-cellpy-shop-widget' );
		var mount = wrapper.querySelector( '[data-vms-shop-mount]' );
		if ( ! shopId || ! mount ) return;

		mount.innerHTML = '';

		var grid = el( 'div', 'vms-shop-widget__grid' );
		var cartToggle = el( 'button', 'vms-shop-widget__cart-toggle', 'Cart (0)' );
		var cartPanel = el( 'div', 'vms-shop-widget__cart-panel' );
		cartPanel.style.display = 'none';
		var message = el( 'p', 'vms-shop-widget__message' );

		mount.appendChild( cartToggle );
		mount.appendChild( grid );
		mount.appendChild( cartPanel );
		mount.appendChild( message );

		function showMessage( text, isError ) {
			message.textContent = text || '';
			message.style.color = isError ? '#b91c1c' : '';
		}

		function renderCart( cart ) {
			cartPanel.innerHTML = '';
			cartToggle.textContent = 'Cart (' + ( cart.items ? cart.items.length : 0 ) + ')';

			if ( ! cart.items || cart.items.length === 0 ) {
				cartPanel.appendChild( el( 'p', null, 'Your cart is empty.' ) );
				return;
			}

			cart.items.forEach( function ( item ) {
				var row = el( 'div', 'vms-shop-widget__cart-item' );
				row.appendChild( el( 'span', null, item.name + ' × ' + item.quantity + ' — ' + formatCents( item.unitPriceCents * item.quantity ) ) );

				var minus = el( 'button', null, '−' );
				minus.addEventListener( 'click', function () {
					updateQuantity( item.id, item.quantity - 1 );
				} );
				var plus = el( 'button', null, '+' );
				plus.addEventListener( 'click', function () {
					updateQuantity( item.id, item.quantity + 1 );
				} );
				row.appendChild( minus );
				row.appendChild( plus );
				cartPanel.appendChild( row );
			} );

			var totalRow = el( 'p', null, 'Total: ' + formatCents( cart.totalCents ) );
			cartPanel.appendChild( totalRow );

			var checkoutBtn = el( 'button', 'vms-shop-widget__checkout-button', 'Checkout' );
			checkoutBtn.addEventListener( 'click', startCheckout );
			cartPanel.appendChild( checkoutBtn );
		}

		function refreshCart() {
			return getJson( CART_ENDPOINT + '?shop=' + encodeURIComponent( shopId ) ).then( function ( r ) {
				if ( r.json && r.json.ok ) renderCart( r.json );
				return r;
			} );
		}

		function updateQuantity( cartItemId, quantity ) {
			postJson( CART_UPDATE_ENDPOINT, { shop: shopId, cartItemId: cartItemId, quantity: quantity } ).then( function ( r ) {
				if ( r.json && r.json.ok ) renderCart( r.json );
			} );
		}

		cartToggle.addEventListener( 'click', function () {
			cartPanel.style.display = cartPanel.style.display === 'none' ? '' : 'none';
		} );

		function renderProducts( products ) {
			grid.innerHTML = '';
			products.forEach( function ( product ) {
				var card = el( 'div', 'vms-shop-widget__card' );
				if ( ! product.inStock ) card.className += ' vms-shop-widget__card--out-of-stock';

				if ( product.images && product.images[ 0 ] ) {
					var img = document.createElement( 'img' );
					img.className = 'vms-shop-widget__card-image';
					img.src = product.images[ 0 ];
					img.alt = product.name;
					card.appendChild( img );
				}
				card.appendChild( el( 'p', 'vms-shop-widget__card-name', product.name ) );
				card.appendChild( el( 'p', 'vms-shop-widget__card-price', formatCents( product.priceCents ) ) );

				var addBtn = el( 'button', 'vms-shop-widget__add-button', product.inStock ? 'Add to cart' : 'Out of stock' );
				addBtn.disabled = ! product.inStock;
				addBtn.addEventListener( 'click', function () {
					postJson( CART_ADD_ENDPOINT, { shop: shopId, productId: product.id, quantity: 1 } ).then( function ( r ) {
						if ( r.json && r.json.ok ) {
							renderCart( r.json );
							showMessage( '' );
						} else {
							showMessage( ( r.json && r.json.message ) || GENERIC_ERROR, true );
						}
					} );
				} );
				card.appendChild( addBtn );

				grid.appendChild( card );
			} );
		}

		// ── OTP login modal (BSA Phase 19) ──────────────────────────────────
		function openLoginModal( onSuccess ) {
			var overlay = el( 'div', 'vms-shop-widget__login-modal' );
			var emailStep = el( 'div' );
			var emailInput = document.createElement( 'input' );
			emailInput.type = 'email';
			emailInput.placeholder = 'Your email';
			var emailSubmit = el( 'button', null, 'Send code' );
			var status = el( 'p', 'vms-shop-widget__message' );

			emailStep.appendChild( el( 'p', null, 'Sign in to check out' ) );
			emailStep.appendChild( emailInput );
			emailStep.appendChild( emailSubmit );
			emailStep.appendChild( status );
			overlay.appendChild( emailStep );
			document.body.appendChild( overlay );

			function showCodeStep( email ) {
				emailStep.innerHTML = '';
				emailStep.appendChild( el( 'p', null, 'Enter the 6-digit code sent to ' + email ) );

				var boxes = [];
				var boxRow = el( 'div' );
				for ( var i = 0; i < 6; i++ ) {
					var box = document.createElement( 'input' );
					box.type = 'text';
					box.maxLength = 1;
					box.className = 'vms-shop-widget__login-code-input';
					boxRow.appendChild( box );
					boxes.push( box );
				}
				emailStep.appendChild( boxRow );
				var codeStatus = el( 'p', 'vms-shop-widget__message' );
				emailStep.appendChild( codeStatus );

				function submitCode() {
					var code = boxes.map( function ( b ) { return b.value; } ).join( '' );
					if ( code.length !== 6 ) return;
					postJson( VERIFY_CODE_ENDPOINT, { shopAuthPublicId: shopId, email: email, code: code } ).then( function ( r ) {
						if ( r.json && r.json.ok ) {
							document.body.removeChild( overlay );
							onSuccess();
						} else {
							codeStatus.textContent = ( r.json && r.json.message ) || GENERIC_ERROR;
							codeStatus.style.color = '#b91c1c';
						}
					} );
				}

				boxes.forEach( function ( box, idx ) {
					box.addEventListener( 'input', function () {
						if ( box.value && idx < boxes.length - 1 ) boxes[ idx + 1 ].focus();
						if ( boxes.every( function ( b ) { return b.value; } ) ) submitCode();
					} );
				} );
				boxes[ 0 ].focus();
			}

			emailSubmit.addEventListener( 'click', function () {
				var email = emailInput.value.trim();
				if ( ! email ) return;
				status.textContent = 'Sending…';
				status.style.color = '';
				postJson( REQUEST_CODE_ENDPOINT, { shopAuthPublicId: shopId, email: email } ).then( function ( r ) {
					if ( r.json && r.json.ok ) {
						showCodeStep( email );
					} else {
						status.textContent = ( r.json && r.json.message ) || GENERIC_ERROR;
						status.style.color = '#b91c1c';
					}
				} );
			} );
		}

		// ── Checkout ─────────────────────────────────────────────────────────
		function startCheckout() {
			getJson( SESSION_ENDPOINT ).then( function ( r ) {
				if ( r.json && r.json.loggedIn ) {
					doCheckout();
				} else {
					openLoginModal( function () {
						refreshCart().then( doCheckout );
					} );
				}
			} );
		}

		function doCheckout() {
			showMessage( 'Starting checkout…' );
			postJson( CHECKOUT_ENDPOINT, {} ).then( function ( r ) {
				if ( r.json && r.json.ok && r.json.checkoutUrl ) {
					window.location.href = r.json.checkoutUrl;
				} else if ( r.json && r.json.requiresLogin ) {
					openLoginModal( function () {
						refreshCart().then( doCheckout );
					} );
				} else {
					showMessage( ( r.json && r.json.message ) || GENERIC_ERROR, true );
				}
			} );
		}

		getJson( PRODUCTS_ENDPOINT + '?shop=' + encodeURIComponent( shopId ) ).then( function ( r ) {
			if ( r.json && r.json.ok ) {
				renderProducts( r.json.products );
			} else {
				showMessage( ( r.json && r.json.message ) || GENERIC_ERROR, true );
			}
		} );
		refreshCart();
	}

	function init() {
		document.querySelectorAll( '[data-cellpy-shop-widget]' ).forEach( setupWidget );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
