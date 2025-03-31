<?php

/**
 * The plugin bootstrap file
 *
 * This file is read by WordPress to generate the plugin information in the plugin
 * admin area. This file also includes all the dependencies used by the plugin,
 * registers the activation and deactivation functions, and defines a function
 * that starts the plugin.
 *
 * @wordpress-plugin
 * Plugin Name:       Econt Delivery
 * Plugin URI:        https://econt.com/developers/
 * Description:       Econt Shipping Module
 * Version:           2.5.6
 * Author:            Econt Express LTD.
 * Author URI:        https://econt.com/developers/
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       deliver-with-econt
 * Domain Path:       /languages
 * Requires at least: 4.7
 * Tested up to:      6.6
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

if ( ! function_exists( 'dd' ) ) {
	function dd( $data ) {
		ini_set( 'highlight.comment', '#969896; font-style: italic' );
		ini_set( 'highlight.default', '#FFFFFF' );
		ini_set( 'highlight.html', '#D16568' );
		ini_set( 'highlight.keyword', '#7FA3BC; font-weight: bold' );
		ini_set( 'highlight.string', '#F2C47E' );
		$output = highlight_string( "<?php\n\n" . var_export( $data, true ), true );
		echo "<div style=\"background-color: #1C1E21; padding: 1rem\">{$output}</div>";
		die();
	}
}

// Bootstrap the plugin
if ( ! isset( $delivery_with_econt_spl_autoloader ) || $delivery_with_econt_spl_autoloader === false ) {
	include_once 'bootstrap.php';
}

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'econt_add_plugin_page_settings_link' );
function econt_add_plugin_page_settings_link( $links ) {
	$links[] = '<a href="' .
		admin_url( 'options-general.php?page=delivery-with-econt-settings' ) .
		'">' . __( 'Settings' ) . '</a>';
	return $links;
}

register_activation_hook( __FILE__, 'activate_delivery_with_econt' );



// Define plugin constants
define( 'ECONT_PLUGIN_FILE', __FILE__ );
define( 'ECONT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ECONT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'ECONT_VERSION', '2.5.6' );

function is_using_block_checkout() {
	// Only try to get the current ID if we're on a page
	if ( ! is_page() ) {
		return false;
	}

	$current_page_id  = get_the_ID();
	$checkout_page_id = wc_get_page_id( 'checkout' );

	// If we're not on the checkout page, return false
	if ( $current_page_id != $checkout_page_id ) {
		return false;
	}

	$checkout_post = get_post( $current_page_id );

	if ( ! $checkout_post ) {
		return false;
	}

	// Check if the checkout page content contains the checkout block
	$has_checkout_block     = has_block( 'woocommerce/checkout', $checkout_post->post_content );
	$contains_block_pattern = ( strpos( $checkout_post->post_content, '<!-- wp:woocommerce/checkout' ) !== false );

	return $has_checkout_block || $contains_block_pattern;
}

// Move initialization to a later hook that runs when the page is being rendered
if ( ! function_exists( 'econt_init_blocks' ) ) {
	function econt_init_blocks() {

		// Only load blocks if we're on the checkout page and using block checkout
		if ( is_checkout() && is_using_block_checkout() ) {
			require_once ECONT_PLUGIN_DIR . 'includes/class-econt-blocks.php';
		}
	}

	// Use wp hook instead of plugins_loaded
	add_action( 'wp', 'econt_init_blocks', 20 );
}


/**
 * Init the plugin updater library.
 */
require 'src/plugin-update-checker/plugin-update-checker.php';
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

// The plugin-update-checker library is already loaded.
$myUpdateChecker = PucFactory::buildUpdateChecker(
	'https://github.com/econt/econt-woo-plugin', // Official Econt repository
	__FILE__,
	'deliver-with-econt'
);

// Set the branch that contains the stable release.
$myUpdateChecker->setBranch( 'main' );
