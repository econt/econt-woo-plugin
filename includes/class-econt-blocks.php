<?php

if (!defined('ABSPATH')) {
    exit;
}

class Econt_Blocks {
    public function __construct() {

        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));

    }

    public function enqueue_scripts() {
        if (!is_checkout()) {
            return;
        }

        // Register and enqueue the block script
        wp_register_script(
            'econt-delivery-block',
            plugins_url('../build/blocks/checkout.js', __FILE__),
            array(
				'jquery',
                'wp-plugins',
                'wp-element',
                'wp-components',
                'wp-i18n',
                'wp-data',
	            'wp-hooks',
                'wc-blocks-checkout',
                'wc-blocks-registry'
            ),
            filemtime(plugin_dir_path(__FILE__) . '../build/blocks/checkout.js'),
            true
        );

        // Get cart weight
	    $cart_weight = 0;
	    $pack_count = 0;

	    foreach (WC()->cart->get_cart() as $cart_item) {
		    $product = $cart_item['data'];
		    $weight = $product->get_weight();
		    $quantity = (int)$cart_item['quantity'];

		    // Check if weight is an empty string
		    if ($weight === '') {
			    // Handle empty weight case - could use a default weight or skip
			    // For example: $weight = 0; or continue;
			    $weight = 0; // Using zero as default
		    } else {
			    $weight = (float)$weight;
		    }

		    $cart_weight += $weight * $quantity;
		    $pack_count += $quantity;
	    }

        wp_localize_script('econt-delivery-block', 'econtData', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('delivery-with-econt-security-nonce'),
            'orderWeight' => $cart_weight,
            'packCount' => $pack_count,
            'shopId' => get_option('econt_shop_id', ''), // Make sure this option exists
        ));

        wp_enqueue_script('econt-delivery-block');

    }

}

new Econt_Blocks(); 