<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Delivery_With_Econt_Payment extends WC_Payment_Gateway {

	public function __construct() {
        $this->id = 'econt_payment';
        $this->has_fields = false;
        $this->method_title = __("EcontPay", 'delivery-with-econt');
        $this->method_description = __("Redirects to Econt online payment form", 'delivery-with-econt');

        $this->supports = array(
            'products'
        );

        $this->init_form_fields();
        $this->init_settings();

        $this->title = "EcontPay";
        $pluginPublicImagesDir = dirname(plugin_dir_url(__FILE__)) . '/public/images';
	    $this->icon = "{$pluginPublicImagesDir}/Econt_pay.svg";//econtpay
        $this->enabled = $this->get_option('enabled');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
    }

    public function init_form_fields() {

        $this->form_fields = array(
            'enabled' => array(
                'title' => __('Enable/Disable', 'delivery-with-econt'),
                'label' => __('Enable EcontPay', 'delivery-with-econt'),
                'type' => 'checkbox',
                'description' => '',
                'default' => 'no'
            )
        );
    }
    public function admin_options() {
	    parent::admin_options();

	    ob_start() ;?>
	    <style>
            #<?php echo $this->plugin_id . $this->id . '_icon_image'; ?> {
                display: block;
            }
            #<?php echo $this->plugin_id . $this->id . '_icon_image'; ?>.hide {
                display: none;
            }
	    </style>
	    <script>
			document.addEventListener('DOMContentLoaded', function() {
                function iconFieldChange() {
                    if (!icon) {
                        icon = document.createElement('img');
                        icon.setAttribute('id', '<?php echo $this->plugin_id . $this->id . '_icon_image'; ?>')
                        iconField.parentNode.insertBefore(icon, iconField.nextSibling);
                    }

                    let selectedIndexValue = iconField.options[iconField.selectedIndex].value;
                    if (selectedIndexValue === '') icon.classList.add('hide');
                    else {
                        icon.setAttribute('src', selectedIndexValue);
                        icon.classList.remove('hide');
                    }
                }
			    let icon;
                let iconField = document.querySelector('#<?php echo $this->plugin_id . $this->id . '_icon'; ?>')
                iconField.addEventListener('change', iconFieldChange);
                iconFieldChange();
            });
	    </script>
	    <?php $outputOther = ob_get_contents();
	    ob_end_clean();



	    echo $outputOther;
    }

	public function process_payment($order_id) {
        $order = wc_get_order($order_id);

        $data = [
            'order' => ['orderNumber' => $order->get_id()]
        ];

        $settings = get_option( 'delivery_with_econt_settings' );
        DWEH()->check_econt_configuration($settings);

        $response = DWEH()->curl_request($data, DWEH()->get_service_url() . 'services/PaymentsService.createPayment.json');
        $response = json_decode($response, true);

        if($response['type'] != '') {
            $message = [];
            $message['text'] = $response['message'];
            $message['type'] = "error";

            // if we receive error message from econt, we save it in the database for display it later
            update_post_meta($order->get_id(), '_process_payment_error', sanitize_text_field( $message['text'] ));

            throw new Exception($message['text']);
        }

        $args = [
            'successUrl' => esc_url_raw(add_query_arg(['utm_nooverride' => '1', 'id_transaction' => $response['paymentIdentifier']], $this->get_return_url( $order ))),
            'failUrl' => esc_url_raw($order->get_cancel_order_url_raw()),
            'eMail' => $order->get_billing_email(),
        ];

        return [
            'result' => 'success',
            'redirect' => $response['paymentURI'] . '&' . http_build_query($args, '', '&')
        ];
    }

    /**
     * @param $id_order
     * @throws Exception
     */
    public function confirm_payment($id_order) {
        $order = wc_get_order($id_order);

        $data = [
            'paymentIdentifier' => $_GET['id_transaction']
        ];

        $response = DWEH()->curl_request($data, DWEH()->get_service_url() . 'services/PaymentsService.confirmPayment.json');
        $response = json_decode($response, true);

        if($response['type'] != '') {
            $message = [];
            $message['text'] = $response['message'];
            $message['type'] = "error";

            // if we receive error message from econt, we save it in the database for display it later
            update_post_meta($order->get_id(), '_confirm_payment_error', sanitize_text_field( $message['text'] ));

            throw new Exception($message['text']);
        }

        $order->payment_complete($_GET['id_transaction']);
        DWEH()->sync_order($order, [], false, $response['paymentToken']);
    }

}