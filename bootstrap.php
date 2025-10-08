<?php

// If this file is called directly, abort.
if ( !defined( 'WPINC' ) ) {
    die;
}

$delivery_with_econt_spl_autoloader = true;

spl_autoload_register( function( $class ) {
    $classes = array(
        // includes root
        'Delivery_With_Econt' => 'includes/class-delivery-with-econt.php',
        'Delivery_With_Econt_Options' => 'includes/class-delivery-with-econt-options.php',
        'Delivery_With_Econt_Shipping' => 'includes/class-delivery-with-econt-shipping.php',
        'Delivery_With_Econt_Activator' => 'includes/class-delivery-with-econt-activator.php',
        'Delivery_With_Econt_Payment' => 'includes/class-delivery-with-econt-payment.php',

        // includes admin/
        'Delivery_With_Econt_Admin' => 'includes/admin/class-delivery-with-econt-admin.php',   

        // Helper functions
        'Delivery_With_Econt_Helper' => 'helpers.php',
        
    );

    // if the file exists, require it
    $path = plugin_dir_path( __FILE__ );
    if ( array_key_exists( $class, $classes ) && file_exists( $path.$classes[$class] ) ) {
        require $path.$classes[$class];
    }
});

/**
 * Returns the main instance of DWEH.
 *
 * @since  1.0
 * @return Delivery_With_Econt_Helper
 */
function DWEH() { // phpcs:ignore WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid
	return Delivery_With_Econt_Helper::instance();
}

function add_econt_service_url_and_key_meta_tag() {
    $service_url ='<meta name="econt-service-url" content="' . DWEH()->get_service_url() . '" >';
    echo $service_url;

    $secret_key ='<meta name="econt-private-key" content="' . DWEH()->get_private_key( true ) . '" >';
    echo $secret_key;
}
add_action( 'admin_head', 'add_econt_service_url_and_key_meta_tag' );

function add_econt_service_url_meta_tag() {
    $service_url ='<meta name="econt-service-url" content="' . DWEH()->get_service_url() . '" >';
    echo $service_url;
}
add_action( 'wp_head', 'add_econt_service_url_meta_tag' );

add_action('update_option_delivery_with_econt_settings', function( $old_value, $new_value, $option_name ) {
    $status = DWEH()->check_econt_configuration( $new_value );

    if( is_array( $status ) ) {
        $error_message = $status['message'] . "\r\n Are you using demo service?";
        add_settings_error( 'econt_settings_error', 'error', $error_message );
    }
}, 10, 3);

// Woocommerce stuff

/**
 * Add Econt as delivery method
 * 
 * @param array $methods All shipping methods
 * 
 * @return array $methods All shipping methods including Econt
 */
function add_econt_shipping_method( $methods )
{
    $methods['delivery_with_econt'] = Delivery_With_Econt_Shipping::class;
    
    return $methods;
}

add_filter( 'woocommerce_shipping_methods', 'add_econt_shipping_method' );

/**
 * Initialize the shipping method
 * 
 * @return object Delivery_With_Econt_Shipping
 */
function econt_shipping_method_init()
{
    return new Delivery_With_Econt_Shipping();
}

add_action( 'woocommerce_shipping_init', 'econt_shipping_method_init' );

/**
 * Adds Econt as payment method
 * @param $gateways
 * @return array
 */
function add_econt_payment_gateway($gateways) {
    if ((
            defined('WP_ADMIN') && WP_ADMIN)
        ||  (!WC()->session || @WC()->session->get('chosen_shipping_methods')[0] == 'delivery_with_econt') && get_woocommerce_currency() === "BGN"
    ) {
        $gateways['econt_payment'] = Delivery_With_Econt_Payment::class;
    }

    return $gateways;
}

add_filter('woocommerce_payment_gateways', 'add_econt_payment_gateway');

/**
 * Force woocommerce to recalculate the shipping
 * 
 */
function update_order_review( $array )
{        
    $packages = WC()->cart->get_shipping_packages();

    foreach ($packages as $key => $value) {
        $shipping_session = "shipping_for_package_$key";
        unset(WC()->session->$shipping_session);
    }

    WC()->cart->calculate_shipping();
    return;
}

add_action( 'woocommerce_checkout_update_order_review', 'update_order_review', 1, 2 );

// Ajax

/**
 * Generate order iframe frontend checkout
 */
function delivery_with_econt_get_order_info() {    
    if ( ! check_ajax_referer( 'delivery-with-econt-security-nonce', 'security' ) ) {
        wp_send_json_error( 'Invalid security token sent.' );
        wp_die();
    }    
    Delivery_With_Econt_Shipping::get_order_info();    
}

add_action( 'wp_ajax_woocommerce_delivery_with_econt_get_orderinfo', 'delivery_with_econt_get_order_info', 10 );
add_action( 'wp_ajax_nopriv_woocommerce_delivery_with_econt_get_orderinfo', 'delivery_with_econt_get_order_info', 10 );

// end

/**
 * Delivery with Econt checkout form button renderer
 */
add_action( 'woocommerce_after_shipping_rate', 'delivery_with_econt_render_form_button' );

function delivery_with_econt_render_form_button( $checkout )
{    
    Delivery_With_Econt_Shipping::render_form_button( $checkout );
}

/**
 * Delivery with Econt checkout form modal renderer
 */
add_action( 'woocommerce_after_checkout_form', 'delivery_with_econt_render_form_modal' );

function delivery_with_econt_render_form_modal( $checkout )
{    
    Delivery_With_Econt_Shipping::render_form_modal( $checkout );
}

add_action('woocommerce_before_checkout_form', 'delivery_with_econt_enque_scripts_and_styles');

function delivery_with_econt_enque_scripts_and_styles()
{
    wp_enqueue_style( 'delivery_with_econt_calculate_shipping', plugin_dir_url(__FILE__) . 'public/css/delivery-with-econt-checkout.css', [], false );
	wp_enqueue_script( 'delivery_with_econt_calculate_shipping', plugin_dir_url(__FILE__) . 'public/js/delivery-with-econt-checkout.js', ['jquery'],
        filemtime( plugin_dir_path(__FILE__) . 'public/js/delivery-with-econt-checkout.js' ), true );
    wp_localize_script( 'delivery_with_econt_calculate_shipping', 'delivery_with_econt_calculate_shipping_object', array('delivery_url' => Delivery_With_Econt_Shipping::get_delivery_url(), 'ajax_url' => admin_url('admin-ajax.php'), 'security'  => wp_create_nonce( 'delivery-with-econt-security-nonce' )));
}

// End Woocommerce stuff

// displays the page content for the Settings submenu
function dwe_settings_page() {
    $ops = new Delivery_With_Econt_Options();
    
    $ops->create_admin_page();
}

// Hook for adding admin menus
add_action( 'admin_menu', 'delivery_with_econt_add_pages' );

function delivery_with_econt_add_pages() {
    // Add a new submenu under Settings:
    add_options_page(
        __( 'Econt Delivery','deliver-with-econt' ), 
        __( 'Econt Delivery','deliver-with-econt' ), 
        'manage_options', 
        'delivery-with-econt-settings', 
        'dwe_settings_page'
    );
}

add_action( 'admin_init', function() {
    $ops = new Delivery_With_Econt_Options();
    $ops->page_init();
} );

/**
 * @return bool
 */
function delivery_with_econt_check_woocommerce_plugin_status()
{
    // if you are using a custom folder name other than woocommerce just define the constant to TRUE
    if ( defined( "RUNNING_CUSTOM_WOOCOMMERCE" ) && RUNNING_CUSTOM_WOOCOMMERCE === true ) {
        return true;
    }
    // it the plugin is active, we're good.
    if ( in_array( 'woocommerce/woocommerce.php', apply_filters( 'active_plugins', get_option( 'active_plugins' ) ) ) ) {
        return true;
    }
    if ( ! is_multisite() ) return false;
    $plugins = get_site_option( 'active_sitewide_plugins' );
    return isset( $plugins['woocommerce/woocommerce.php'] );
}

/**
 * The code that runs during plugin activation.
 * This action is documented in includes/class-mailchimp-woocommerce-activator.php
 */
function activate_delivery_with_econt() {
    // if we don't have woocommerce we need to display a horrible error message before the plugin is installed.
    if ( ! delivery_with_econt_check_woocommerce_plugin_status() ) {
        // Deactivate the plugin
        deactivate_plugins( __FILE__ );
        $error_message = __( 'The Delivery with Econt plugin requires the <a href="http://wordpress.org/extend/plugins/woocommerce/">WooCommerce</a> plugin to be active!', 'woocommerce' );
        wp_die( $error_message );
    }
    Delivery_With_Econt_Activator::activate();
}

/**
 * After pressing the Place Order button
 *   
 * Sync the shop order with Econt
 */

function delivery_with_econt_generate_order_service($order_id = null) {
	// Skip if order contains only virtual products
	if (empty($order_id) && isset($_POST['order_id'])) {
		$order_id = intval($_POST['order_id']);
	}
	$order = wc_get_order($order_id);
error_log($order);
	if ($order && DWEH()->order_contains_only_virtual_products($order)) {
		return;
	}
error_log('test');
	DWEH()->sync_order($order_id);
}
add_action( 'woocommerce_checkout_order_processed', 'delivery_with_econt_generate_order_service',  1, 1  );
add_action( 'woocommerce_checkout_update_order_meta', 'delivery_with_econt_generate_order_service',  1, 1  );
add_action( 'woocommerce_store_api_checkout_order_processed', 'delivery_with_econt_generate_order_service', 10, 2 );


/**
 * Hook for adding column to the order list table
 */
// legacy – for CPT-based orders
add_filter( 'manage_edit-shop_order_columns', 'delivery_with_econt_add_waybill_column' );
// for HPOS-based orders
add_filter( 'manage_woocommerce_page_wc-orders_columns', 'delivery_with_econt_add_waybill_column' );

function delivery_with_econt_add_waybill_column( $columns ) {
	return Delivery_With_Econt_Admin::add_waybill_column($columns);
}

/**
 * Hook to fill the newly added column with data
 */
// legacy – for CPT-based orders
add_action( 'manage_shop_order_posts_custom_column', 'delivery_with_econt_add_waybill_column_content', 25, 2 );
// for HPOS-based orders
add_action( 'manage_woocommerce_page_wc-orders_custom_column', 'delivery_with_econt_add_waybill_column_content', 25, 2 );
function delivery_with_econt_add_waybill_column_content( $column_name, $order_or_order_id ) {
	return Delivery_With_Econt_Admin::add_waybill_column_content($column_name, $order_or_order_id);
}



/**
 * Add bulk action for syncing Econt waybills
 * Compatible with both traditional and HPOS systems
 */

// Add bulk actions to both systems
add_filter('bulk_actions-edit-shop_order', 'add_econt_sync_bulk_action');
add_filter('bulk_actions-woocommerce_page_wc-orders', 'add_econt_sync_bulk_action');

function add_econt_sync_bulk_action($actions) {
	// Create a new array to control the order
	$new_actions = array();

	// Add all existing actions except trash
	foreach ($actions as $key => $value) {
		if ($key !== 'trash') {
			$new_actions[$key] = $value;
		}
	}

	// Add our Econt sync action before trash
	$new_actions['econt_sync_waybill'] = __('Sync Econt Waybills', 'deliver-with-econt');

	// Add trash at the end if it exists
	if (isset($actions['trash'])) {
		$new_actions['trash'] = $actions['trash'];
	}

	return $new_actions;
}

// Handle bulk actions for both systems
add_filter('handle_bulk_actions-edit-shop_order', 'handle_econt_sync_bulk_action', 10, 3);
add_filter('handle_bulk_actions-woocommerce_page_wc-orders', 'handle_econt_sync_bulk_action', 10, 3);

function handle_econt_sync_bulk_action($redirect_to, $action, $post_ids) {
	if ($action !== 'econt_sync_waybill') {
		return $redirect_to;
	}

	// Verify nonce for security
	if (!wp_verify_nonce($_REQUEST['_wpnonce'], 'bulk-orders')) {
		return $redirect_to;
	}

	// Check user capabilities
	if (!current_user_can('edit_shop_orders')) {
		return $redirect_to;
	}

	$processed_count = 0;
	$error_count = 0;
	$errors = array();

	foreach ($post_ids as $order_id) {
		$order = wc_get_order($order_id);

		if (!$order) {
			$error_count++;
			continue;
		}

		// Skip if order contains only virtual products
		if (DWEH()->order_contains_only_virtual_products($order)) {
			continue;
		}

		// Skip if not using Econt shipping
		if (!$order->has_shipping_method(Delivery_With_Econt_Options::get_plugin_name())) {
			continue;
		}

		try {
			// Use your existing sync function
			$result = delivery_with_econt_generate_order_service($order_id);

			if ($result !== false) {
				$processed_count++;
				$order->add_order_note(__('Waybill synced via bulk action.', 'deliver-with-econt'));
			} else {
				$error_count++;
				$errors[] = sprintf(__('Failed to sync order #%d', 'deliver-with-econt'), $order_id);
			}
		} catch (Exception $e) {
			$error_count++;
			$errors[] = sprintf(__('Error syncing order #%d: %s', 'deliver-with-econt'), $order_id, $e->getMessage());
			error_log("[Econt Bulk Sync] Error for order $order_id: " . $e->getMessage());
		}
	}

	// Store results in transient for admin notice
	set_transient('econt_bulk_sync_results', array(
		'processed' => $processed_count,
		'errors' => $error_count,
		'error_messages' => $errors
	), 60);

	// Add query args for admin notice
	$redirect_to = add_query_arg(array(
		'bulk_action' => 'econt_sync_waybill',
		'processed_count' => $processed_count,
		'error_count' => $error_count
	), $redirect_to);

	return $redirect_to;
}

// Show admin notice after bulk action
add_action('admin_notices', 'econt_bulk_sync_admin_notice');

function econt_bulk_sync_admin_notice() {
	if (empty($_REQUEST['bulk_action']) || $_REQUEST['bulk_action'] !== 'econt_sync_waybill') {
		return;
	}

	$results = get_transient('econt_bulk_sync_results');
	if (!$results) {
		return;
	}

	$processed_count = intval($results['processed']);
	$error_count = intval($results['errors']);
	$errors = $results['error_messages'];

	// Delete the transient
	delete_transient('econt_bulk_sync_results');

	if ($processed_count > 0) {
		printf(
			'<div class="notice notice-success is-dismissible"><p>%s</p></div>',
			sprintf(
				_n(
					'Successfully synced %d Econt waybill.',
					'Successfully synced %d Econt waybills.',
					$processed_count,
					'deliver-with-econt'
				),
				$processed_count
			)
		);
	}

	if ($error_count > 0) {
		$error_message = sprintf(
			_n(
				'Failed to sync %d order.',
				'Failed to sync %d orders.',
				$error_count,
				'deliver-with-econt'
			),
			$error_count
		);

		// Show first few error messages
		if (!empty($errors)) {
			$error_message .= '<br><strong>' . __('Errors:', 'deliver-with-econt') . '</strong><br>';
			$error_message .= implode('<br>', array_slice($errors, 0, 5));

			if (count($errors) > 5) {
				$error_message .= '<br>' . sprintf(__('... and %d more errors.', 'deliver-with-econt'), count($errors) - 5);
			}
		}

		printf(
			'<div class="notice notice-error is-dismissible"><p>%s</p></div>',
			$error_message
		);
	}

	if ($processed_count === 0 && $error_count === 0) {
		printf(
			'<div class="notice notice-warning is-dismissible"><p>%s</p></div>',
			__('No orders were processed. Make sure selected orders use Econt delivery and contain physical products.', 'deliver-with-econt')
		);
	}
}


/**
 * Hook to update Econt service and recalculate the shipping
 */
function delivery_with_econt_update_order()
{
    check_ajax_referer( 'calc-totals', 'security' );

    if ( ! current_user_can( 'edit_shop_orders' ) || ! isset( $_POST['order_id'], $_POST['items'] ) ) {
      wp_die( -1 );
    }

    Delivery_With_Econt::update_order();
}

add_action( 'wp_ajax_woocommerce_calc_line_taxes', 'delivery_with_econt_update_order', 10 );

function delivery_with_econt_save_waybill_id()
{
    check_ajax_referer( 'woocommerce-preview-order', 'security' );

    if ( ! current_user_can( 'edit_shop_orders' ) ) {
      wp_die( -1 );
    }
    
    Delivery_With_Econt::save_waybill_id();
}
add_action( 'wp_ajax_delivery_with_econt_save_waybill_id', 'delivery_with_econt_save_waybill_id' );

function delivery_with_econt_update_status_processing() {
    check_ajax_referer('woocommerce-preview-order', 'security');

    if (!current_user_can('edit_shop_orders')) {
        wp_die(-1);
    }

    $id_order = absint($_POST['order_id']);

    if(!empty($id_order)) {
        $order = wc_get_order($id_order);
        if ($order->get_status() != 'processing') {
            $order->set_status('processing');
            $order->save();

            Delivery_With_Econt::update_order();
        }
    }
}
add_action( 'wp_ajax_delivery_with_econt_update_status_processing', 'delivery_with_econt_update_status_processing' );

function delivery_with_econt_get_order_details()
{
    DWEH()->econt_get_order_details();
}

add_action( 'wp_ajax_delivery_with_econt_get_order_details', 'delivery_with_econt_get_order_details' );

// Sync the Econt services with local values 
function delivery_with_econt_sync_order( $order_id ) 
{ 
    DWEH()->sync_order( $order_id );
}; 

add_action( 'woocommerce_process_shop_order_meta', 'delivery_with_econt_sync_order', 999);

function econt_sync_error() 
{
    $post_id = get_the_ID(); 
    $order = wc_get_order( $post_id );
    if ( ! $order ) return;
    $error = $order->get_meta( '_sync_error' );

    if ( $error != '' ) {        
        ?>
            <div class="notice notice-error is-dismissible">
                <p><?php echo $error; ?></p>
            </div>
        <?php
        delete_post_meta( $post_id, '_sync_error' );
    }
};

add_action( 'admin_notices', 'econt_sync_error' );

// Add section to display eather the button or the value of the waybill
add_action( 'woocommerce_after_order_itemmeta', 'delivery_with_econt_add_custom_html_to_order_details', 5, 1 );
 
function delivery_with_econt_add_custom_html_to_order_details( $product_id )
{
    Delivery_With_Econt_Admin::add_custom_html_to_order_details( $product_id );
}

function econt_delivery_load_plugin_textdomain() {
    load_plugin_textdomain( 'deliver-with-econt', FALSE, basename( dirname( __FILE__ ) ) . '/languages/' );
}
add_action( 'plugins_loaded', 'econt_delivery_load_plugin_textdomain' );

//server side shipping price validation SR-103462
function action_woocommerce_checkout_process($wccs_custom_checkout_field_pro_process)
{
	global $woocommerce;
	$chosen_methods = WC()->session->get('chosen_shipping_methods');

	// Make sure $chosen_methods is an array before using reset()
	if (!is_array($chosen_methods) || empty($chosen_methods)) {
		return;
	}

	$chosen_shipping = reset($chosen_methods);

	if ($chosen_shipping != Delivery_With_Econt_Options::get_plugin_name()) {
		return;
	}

	if(!isset($_COOKIE['econt_customer_info_id'])) {
		function my_woocommerce_add_error($error) {
			$error = __("You can't submit order, if shipping price is not calculated properly!", 'deliver-with-econt');
			return $error;
		}

		add_filter('woocommerce_add_error', 'my_woocommerce_add_error');

		throw new Exception(__("You can't submit order, if shipping price is not calculated properly!", 'deliver-with-econt'));
	}
};

add_action('woocommerce_checkout_process', 'action_woocommerce_checkout_process', 10, 1);

/**
 * @param $id_order
 */
function process_order_cancelled($id_order) {
    DWEH()->sync_order($id_order);
}

/**
 * @param $id_order
 * @throws Exception
 */
function process_successful_payment($id_order) {
    $order = wc_get_order($id_order);

    if('econt_payment' === $order->get_payment_method() && $_GET['id_transaction']) {
        $oEcontPayment = new Delivery_With_Econt_Payment();
        $oEcontPayment->confirm_payment($id_order);
    }
}

function econt_delivery_sanitized_fields($filter) {
    $payment = new Delivery_With_Econt_Payment();
    if ($payment->enabled != $filter['enabled']) Delivery_With_Econt_Helper::sendLog('payment_enabled', ($filter['enabled'] == 'yes' ? 1 : 0));

    return $filter;
}
add_action('woocommerce_cancelled_order', 'process_order_cancelled', 10, 1);
add_action('woocommerce_before_thankyou', 'process_successful_payment', 10, 1);
add_filter('woocommerce_settings_api_sanitized_fields_econt_payment', 'econt_delivery_sanitized_fields');
