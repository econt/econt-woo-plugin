<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Delivery_With_Econt_Helper
{

    /**
	 * The single instance of the class.
	 *
	 * @var DWEH
	 * @since 1.0
	 */
    protected static $_instance = null;
    
    /**
	 * Main Instance.
	 *
	 * Ensures only one instance is loaded or can be loaded.
	 *
	 * @since 1.0
	 * @static
	 * @see WC()
	 * @return Main instance.
	 */
	public static function instance() {
		if ( is_null( self::$_instance ) ) {
			self::$_instance = new self();
		}
		return self::$_instance;
	}

    /**
     * If there is an order in Econt system, it will be updated.
     * If not - will be created.
     * 
     * @param int $local_order If there is a order in our system, the order_id will be used.
     * @param array $items If array of item ids is passed to the function, will loop trought them.
     * Other way $order->get_items() will be used.
     * @param bool $get_new_price If this is set to true, will send another request to Econt service
     * in order to fetch the order price. This is used in admin dashboard to recalculate shipping
     * 
     * @return string - the new price
     * @return bool - false - to finish the execution
     */
	public function sync_order( $local_order = null, $items = [], $get_new_price = false, $payment_token = "" ) {
		error_log('sync_order');
		error_log($local_order);
		error_log(111);
		if ( ! $local_order ) {
			error_log("[Econt Sync] No local order provided");
			return false;
		}

		$order = ( $local_order instanceof WC_Order ) ? $local_order : wc_get_order($local_order);
		if ( ! $order || ! $order instanceof WC_Order ) {
			error_log("[Econt Sync] Invalid order object");
			return false;
		}

		// Skip if order contains only virtual products
		if ($this->order_contains_only_virtual_products($order)) {
			error_log("[Econt Sync] Order contains only virtual products, skipping sync");
			return false;
		}

		// Ensure shipping method is correct
		if ( ! $order->has_shipping_method( Delivery_With_Econt_Options::get_plugin_name() ) ) {
			error_log("[Econt Sync] Order does not use Econt shipping method");
			return false;
		}

		$order_id = $order->get_id();
		$cod = false;

		if ( isset($_POST['_payment_method']) ) {
			$cod = in_array( sanitize_text_field($_POST['_payment_method']), ['cod', 'econt_payment'], true );
		} else {
			$cod = in_array( $order->get_payment_method(), ['cod', 'econt_payment'], true );
		}

		$id = '';
		if ( isset($_COOKIE['econt_customer_info_id']) ) {
			$id = sanitize_text_field($_COOKIE['econt_customer_info_id']);
			update_post_meta( $order_id, '_customer_info_id', $id );
			setcookie("econt_customer_info_id", '', time() - 3600);
			setcookie("econt_shippment_price", '', time() - 3600);
		} else {
			$id = $order->get_meta('_customer_info_id');
		}

		$data = [
			'id' => '',
			'orderNumber' => $order_id,
			'status' => $order->get_status(),
			'orderTime' => '',
			'cod' => $cod,
			'partialDelivery' => '',
			'currency' => get_woocommerce_currency(),
			'shipmentDescription' => '',
			'shipmentNumber' => '',
			'clientSoftware' => 'DeliveryWooCommerce_v1',
			'customerInfo' => [
				'id' => $id,
				'name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
				'face' => '',
				'phone' => $order->get_billing_phone(), // <- добавен телефон
				'email' => $order->get_billing_email(),
				'countryCode' => $order->get_billing_country(),
				'cityName' => $order->get_billing_city(),
				'postCode' => $order->get_billing_postcode(),
				'officeCode' => '',
				'zipCode' => '',
				'address' => $order->get_billing_address_1(),
				'priorityFrom' => '',
				'priorityTo' => ''
			],
			'items' => [],
			'paymentToken' => $payment_token
		];

		$items_to_process = count($items) ? $items['order_item_id'] : $order->get_items('line_item');

		$iteration = 1;
		foreach ($items_to_process as $_item) {
			if ( count($items) ) {
				$item = new WC_Order_Item_Product(intval($_item));
				$total_count = count($items['order_item_id']);
			} else {
				$item = $_item;
				$total_count = count($items_to_process);
			}

			$product = $item->get_product();
			if ( ! $product ) continue;

			$price = $item->get_total() + $item->get_total_tax();
			$quantity = intval($item->get_quantity());
			$weight = floatval($product->get_weight());
			$product_name = $product->get_name();

			$data['items'][] = [
				'name' => $product_name,
				'SKU' => $product->get_sku(),
				'URL' => '',
				'count' => $quantity,
				'hideCount' => '',
				'totalPrice' => $price,
				'totalWeight' => $weight * $quantity
			];

			$data['shipmentDescription'] .= $product_name;
			if ( $iteration < $total_count ) {
				$data['shipmentDescription'] .= ', ';
			}

			$iteration++;
		}

		if ( $data['cod'] && !empty($data['items']) ) {
			$data['partialDelivery'] = true;
		}

		$curl = curl_init();
		curl_setopt($curl, CURLOPT_URL, $this->get_service_url() . 'services/OrdersService.updateOrder.json');
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
		curl_setopt($curl, CURLOPT_HTTPHEADER, [
			'Content-Type: application/json',
			'Authorization: ' . $this->get_private_key()
		]);
		curl_setopt($curl, CURLOPT_POST, true);
		curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
		curl_setopt($curl, CURLOPT_TIMEOUT, 10);

		$response = curl_exec($curl);
		$curl_error = curl_error($curl);
		curl_close($curl);

		if ( $curl_error ) {
			error_log("[Econt Sync] CURL Error: $curl_error");
			return false;
		}

		$parsed_response = json_decode($response, true);

		if ( isset($parsed_response['type']) && $parsed_response['type'] !== '' ) {
			$message = [
				'text' => $parsed_response['message'] ?? 'Unknown error',
				'type' => 'error'
			];
			update_post_meta( $order_id, '_sync_error', sanitize_text_field( $message['text'] ) );
			error_log("[Econt Sync] API Error: " . $message['text']);
		}

		if ( $get_new_price ) {
			$curl = curl_init();
			curl_setopt($curl, CURLOPT_URL, $this->get_service_url() . 'services/OrdersService.getPrice.json');
			curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
			curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
			curl_setopt($curl, CURLOPT_HTTPHEADER, [
				'Content-Type: application/json',
				'Authorization: ' . $this->get_private_key()
			]);
			$price_response = curl_exec($curl);
			curl_close($curl);

			return json_decode($price_response, true)['receiverDueAmount'] ?? false;
		}

		return true;
	}

    /**
     * Check if we using Demo service
     * 
     * @return bool
     */
    public function is_demo()
    {
        $options = get_option( 'delivery_with_econt_settings' );

        return isset($options['demo_service']);
    }

    /**
     * Based on the demo setting returns the appropiate url
     * 
     * @return string URL
     */
    public function get_service_url( $demo = false )
    {
        $options = get_option( 'delivery_with_econt_settings' );
        $url = '';
        
        if ( $demo || isset( $options['demo_service'] ) ) {
            $url = Delivery_With_Econt_Options::get_demo_service_url();
        } else {
            $url = Delivery_With_Econt_Options::get_service_url();
        }

        // return ( is_ssl() ? 'https:' : 'http:' ) . $url;
        return $url;
    }

    /**
     * Retrieve the stored in database setting
     * 
     * @param bool $encrypt Encrypt the string or not
     * 
     * @return string
     */
    public function get_private_key( $encrypt = false )
    {
        $options = get_option( 'delivery_with_econt_settings' );
        
        return $encrypt ? base64_encode( $options['private_key'] ) : $options['private_key'];
    }

    /**
     * The tracking url
     * 
     * @return string
     */
    public function get_tracking_url( $code )
    {
        return Delivery_With_Econt_Options::get_track_url() . $code;
    }

    /**
     * check stored configuration
     *
     * Check stored shop_id, private_key and demo_service options with Econt via curl request
     *
     * @param array $new_settings The settings entered by the user
     * @return array 
     **/
    public function check_econt_configuration( $new_settings = array() )
    {
        $endpoint = $this->get_service_url( array_key_exists( 'demo_service', $new_settings ) );
        $secret = $new_settings['private_key'];

        $curl = curl_init();
        curl_setopt( $curl, CURLOPT_URL, $endpoint . "services/OrdersService.getTrace.json" );
        curl_setopt( $curl, CURLOPT_RETURNTRANSFER, true );
        curl_setopt( $curl, CURLOPT_SSL_VERIFYPEER, false );
        curl_setopt( $curl, CURLOPT_SSL_VERIFYHOST, false );
        curl_setopt( $curl, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: " . $secret
        ] );
        curl_setopt( $curl, CURLOPT_POST, true );
        curl_setopt( $curl, CURLOPT_POSTFIELDS, json_encode( array(
            'orderNumber' => 4812384
        ) ) );
        curl_setopt( $curl, CURLOPT_TIMEOUT, 6 );
        $res = curl_exec( $curl );
        $response = json_decode( $res, true );

        curl_close( $curl );

        if( is_array( $response ) && $response['type'] == 'ExAccessDenied' ) {
            return $response;
  
        } 

        return;
    }

    public function econt_calculate_cart_price( $cart )
    {
        $price = 0;
        foreach ($cart as $key => $item) {
            $price += $item['line_total'];
            $price += $item['line_tax'];
        }

        return $price;
    }

    /**
	 * Get order details.
	 */
	public function econt_get_order_details() {
		check_admin_referer( 'woocommerce-preview-order', 'security' );

		if ( ! current_user_can( 'edit_shop_orders' ) || ! isset( $_GET['order_id'] ) ) {
			wp_die( -1 );
		}

		$order = wc_get_order( absint( $_GET['order_id'] ) ); // WPCS: sanitization ok.

		if ( $order ) {

			// Get formatted addresses
			$billing_address = $order->get_formatted_billing_address();
			$shipping_address = $order->get_formatted_shipping_address();

			// Get payment method
			$payment_method = $order->get_payment_method();
			$payment_method_title = $order->get_payment_method_title();
			$payment_via = $payment_method_title ? $payment_method_title : $payment_method;

			wp_send_json_success( 
                array(
                    'data'                       => $order->get_data(),
                    'order_number'               => $order->get_order_number(),
                    'ship_to_billing'            => wc_ship_to_billing_address_only(),
                    'needs_shipping'             => $order->needs_shipping_address(),
                    'formatted_billing_address'  => $billing_address ? $billing_address : __( 'N/A', 'woocommerce' ),
                    'formatted_shipping_address' => $shipping_address ? $shipping_address : __( 'N/A', 'woocommerce' ),
                    'shipping_address_map_url'   => $order->get_shipping_address_map_url(),
                    'payment_via'                => $payment_via,
                    'shipping_via'               => $order->get_shipping_method(),
                    'status'                     => $order->get_status(),
                    'status_name'                => wc_get_order_status_name( $order->get_status() ),
                )
             );
		}
		wp_die();
	}

    /**
     * @param $data
     * @param string $endpoint
     * @return mixed
     * @throws Exception
     */
    public function curl_request($data, $endpoint = "") {
        if(empty($endpoint)) throw new Exception(__('Empty endpoint'), 'delivery-with-econt');

        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, $endpoint);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($curl, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: ' . DWEH()->get_private_key()
        ]);
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($curl, CURLOPT_TIMEOUT, 10);
        // Изпращане на заявката
        $response = curl_exec($curl);

        return $response;
    }

    public static function sendLog($action, $value, $serviceURL = null, $privateKey = null) {
        $instance = self::instance();
        if (empty($serviceURL)) $serviceURL = $instance->get_service_url();
        if (empty($privateKey)) $privateKey = $instance->get_private_key();
        if (empty($serviceURL) || empty($privateKey)) return;

        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, "{$serviceURL}services/PluginsService.logEvent.json");
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($curl, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            "Authorization: {$privateKey}"
        ]);
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode([[
            'plugin_type' => 'woocommerce',
            'action' => $action,
            'value' => $value
        ]]));
        curl_setopt($curl, CURLOPT_TIMEOUT, 6);
        curl_exec($curl);
        curl_close($curl);
    }

	/**
	 * Check if order contains only virtual products
	 *
	 * @param WC_Order $order
	 * @return bool
	 */
	public function order_contains_only_virtual_products($order) {
		if (!$order) {
			return false;
		}

		foreach ($order->get_items() as $item) {
			$product = $item->get_product();
			if ($product && !$product->is_virtual()) {
				return false;
			}
		}

		return true;
	}
}
