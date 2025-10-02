jQuery(document).ready(function (dwe) {
  let global_shippment_price_cod
  let global_shippment_price_cod_e
  let global_shippment_price_no_cod
  let global_info_message
  let use_shipping = false
  var locale = document.documentElement.lang.split('-')[0];
  var buttonText
  var globalAlertMessage = false;

  if (locale === 'bg') {
    buttonText = 'Редактирай данни';
  } else {
    buttonText = 'Change';
  }

  // Helper function to get current shipping method
  function getSelectedShippingMethod() {
    // First try to get from radio buttons with name="shipping_method[0]"
    let radioInputs = dwe('input[name="shipping_method[0]"]:checked');
    if (radioInputs.length > 0) {
      return radioInputs.val();
    }

    // Try hidden input with same name
    let hiddenInput = dwe('input[name="shipping_method[0]"][type="hidden"]');
    if (hiddenInput.length > 0) {
      return hiddenInput.val();
    }

    // Fallback to any shipping_method input
    let input_type = dwe('input[name^="shipping_method"]')[0];
    if (!input_type) {
      return undefined;
    }

    if (input_type.type === 'radio') {
      let checked = dwe('input[name^="shipping_method"]:checked');
      return checked.length > 0 ? checked.val() : undefined;
    } else if (input_type.type === 'hidden') {
      return input_type.value;
    }

    return undefined;
  }

  function resetCookies() {
    document.cookie = "econt_shippment_price=0; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    document.cookie = "econt_customer_info_id=0; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";

    global_shippment_price_cod = undefined
    global_shippment_price_cod_e = undefined
    global_shippment_price_no_cod = undefined
    global_info_message = undefined
  }

  function checkIfShippingMethodIsEcont() {
    let sh = dwe('[value=delivery_with_econt]');
    if (sh.prop("type") === 'radio' && sh.prop('checked')) {
      return true;
    } else if (sh.prop("type") === 'hidden') {
      return true;
    }
    return false;
  }

  function validateShippingPrice(e) {
    if (checkIfShippingMethodIsEcont() &&
        (global_shippment_price_cod === undefined ||
            global_shippment_price_cod_e === undefined ||
            global_shippment_price_no_cod === undefined)) {
      e.preventDefault();
      e.stopPropagation();
      if (globalAlertMessage) {
        dwe('body').trigger('update_checkout');
        globalAlertMessage = false;
        return;
      }
      alert('Моля калкулирайте цена за доставка с Еконт!');
      dwe('body').trigger('update_checkout');
      globalAlertMessage = true;
      return false;
    }
  }

  /**
   * Disable Enter key on checkout form
   */
  dwe("form[name='checkout']").on('keypress', function (e) {
    var key = e.which || e.keyCode;
    if (key === 13) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  resetCookies();

  dwe("div.customer-info-form > form").submit(function(e) {
    validateShippingPrice(e);
  });

  /**
   * Updated checkout event handler
   */
  dwe(document.body).on('updated_checkout', function() {
    // Get current shipping method
    let selected_shipping_method = getSelectedShippingMethod();

    if (global_info_message !== undefined) {
      dwe("#calculate_shipping_button").text(buttonText);
    }

    // Setup payment method change listeners
    let payment_input = dwe('input[name^="payment_method"]');
    payment_input.each((key, field) => {
      dwe('#' + field.id).off('change').on('change', function() {
        // Get fresh shipping method value on each change
        let current_shipping_method = getSelectedShippingMethod();

        if (this.value == 'cod' && current_shipping_method === 'delivery_with_econt') {
          document.cookie = "econt_shippment_price=" + global_shippment_price_cod + "; path=/";
          dwe('#econt_detailed_shipping').css('display', 'block');
        } else if (this.value == 'econt_payment' && current_shipping_method === 'delivery_with_econt') {
          document.cookie = "econt_shippment_price=" + global_shippment_price_cod_e + "; path=/";
          dwe('#econt_detailed_shipping').css('display', 'block');
        } else if (current_shipping_method === 'delivery_with_econt') {
          document.cookie = "econt_shippment_price=" + global_shippment_price_no_cod + "; path=/";
          dwe('#econt_detailed_shipping').css('display', 'none');
        }
        dwe('body').trigger('update_checkout');
      });
    });

    // Show/hide Econt calculation button based on shipping method
    if (selected_shipping_method === 'delivery_with_econt') {
      dwe("#delivery_with_econt_calculate_shipping").css('display', 'grid');
    } else {
      dwe("#econt_delivery_calculate_buttons").css('display', 'none');
    }

    // Place order button handler
    dwe('#place_order').off('click').on('click', function(e) {
      validateShippingPrice(e);
    });

    // Coupon handlers
    dwe("button[name='apply_coupon']").off('click').on('click', resetCookies);
    dwe("a.woocommerce-remove-coupon").off('click').on('click', resetCookies);

    // Calculate shipping button handler
    dwe('#calculate_shipping_button').off('click').on('click', function(e) {
      if (dwe('#ship-to-different-address-checkbox:checkbox:checked')[0]) {
        use_shipping = true;
      } else {
        use_shipping = false;
      }
      getDataFromForm(use_shipping);
    });

    showPriceInfo(global_info_message);
  });

  /**
   * Event listener for iframe messages from Econt
   */
  window.addEventListener('message', function(message) {
    let econt_service_url = dwe('meta[name="econt-service-url"]')[0].content;

    if (econt_service_url.indexOf(message.origin) < 0) {
      return;
    }

    globalAlertMessage = false;

    let data = message['data'];
    let updateCart = false;

    if (data['shipment_error'] && data['shipment_error'] !== '') {
      dwe('#econt_display_error_message').empty();
      dwe('#econt_display_error_message').append(data['shipment_error']);

      dwe('.econt-alert').addClass('active');
      dwe('html,body').animate({scrollTop: dwe('#delivery_with_econt_calculate_shipping').offset().top - 50}, 750);
      setTimeout(function() {
        dwe('.econt-alert').removeClass('active');
      }, 3500);

      return false;
    }

    let codInput = document.getElementById('payment_method_cod');
    let econt_payment_input = document.getElementById('payment_method_econt_payment');

    let shipmentPrice;
    global_shippment_price_cod = data['shipping_price_cod'];
    global_shippment_price_cod_e = data['shipping_price_cod_e'];
    global_shippment_price_no_cod = data['shipping_price'];

    if (codInput && codInput.checked) {
      shipmentPrice = data['shipping_price_cod'];
    } else if (econt_payment_input && econt_payment_input.checked) {
      shipmentPrice = data['shipping_price_cod_e'];
    } else {
      shipmentPrice = data['shipping_price'];
    }

    global_info_message = data['shipping_price'] +
        ' ' +
        data['shipping_price_currency_sign'] +
        ' за доставка и ' +
        (Math.round((shipmentPrice - data['shipping_price']) * 100) / 100) +
        ' ' +
        data['shipping_price_currency_sign'] +
        ' наложен платеж.';

    document.cookie = "econt_shippment_price=" + shipmentPrice + "; path=/";

    updateCart = true;

    dweCloseModal();

    dwe("#calculate_shipping_button").text(buttonText);

    if (updateCart) {
      let full_name = [];
      let company = '';

      if (data['face'] != null) {
        full_name = data['face'].split(' ');
        company = data['name'];
      } else {
        full_name = data['name'].split(' ');
      }

      let prefix = use_shipping ? 'shipping' : 'billing';

      if (document.getElementById(prefix + '_first_name'))
        document.getElementById(prefix + '_first_name').value = full_name[0] ? full_name[0] : '';
      if (document.getElementById(prefix + '_last_name'))
        document.getElementById(prefix + '_last_name').value = full_name[1] ? full_name[1] : '';
      if (document.getElementById(prefix + '_company'))
        document.getElementById(prefix + '_company').value = company;
      if (document.getElementById(prefix + '_address_1'))
        document.getElementById(prefix + '_address_1').value = data['address'] != '' ? data['address'] : data['office_name'];
      if (document.getElementById(prefix + '_city'))
        document.getElementById(prefix + '_city').value = data['city_name'];
      if (document.getElementById(prefix + '_postcode'))
        document.getElementById(prefix + '_postcode').value = data['post_code'];
      if (document.getElementById('billing_phone'))
        document.getElementById('billing_phone').value = data['phone'];
      if (document.getElementById('billing_email'))
        document.getElementById('billing_email').value = data['email'];

      document.cookie = "econt_customer_info_id=" + data['id'] + "; path=/";

      dwe('body').trigger('update_checkout');
    }
  }, false);

  dwe(document.body).on('checkout_error', function(event) {
    resetCookies();
    dwe('body').trigger('update_checkout');
  });
});

// Utility functions
function checkForm(use_shipping) {
  let prefix = use_shipping ? 'shipping' : 'billing';
  let fields = [
    '#' + prefix + '_first_name',
    '#' + prefix + '_last_name',
    '#' + prefix + '_country',
    '#' + prefix + '_address_1',
    '#' + prefix + '_city',
    '#' + prefix + '_state',
    '#' + prefix + '_postcode',
    '#billing_phone',
    '#billing_email'
  ];

  let showModal = true;

  fields.forEach(function(field) {
    if (jQuery(field).val() === '') {
      showModal = false;
    }
  });

  return showModal;
}

function showIframe(data) {
  let iframe;
  let iframeContainer;
  let url;
  url = data.split('"').join('').replace(/\\\//g, "/");

  iframeContainer = jQuery('#place_iframe_here');
  jQuery('html').css({"overflow-y": "hidden"});
  jQuery('#myModal').css({"display": "block"});
  iframe = '<iframe src="' + url + '" scrolling="yes" id="delivery_with_econt_iframe" name="econt_iframe_form"></iframe>';

  iframeContainer.empty();
  iframeContainer.append(iframe);
  stopLoader();
}

async function getDataFromForm(use_shipping) {
  let post_data = {
    action: 'woocommerce_delivery_with_econt_get_orderinfo',
    security: delivery_with_econt_calculate_shipping_object.security,
  };
  let params = {};
  let prefix = use_shipping ? 'shipping' : 'billing';

  startLoader();

  let fName = '';
  if (document.getElementById(prefix + '_first_name'))
    fName = document.getElementById(prefix + '_first_name').value;
  let lName = '';
  if (document.getElementById(prefix + '_last_name'))
    lName = document.getElementById(prefix + '_last_name').value;
  params.customer_name = fName + ' ' + lName;
  if (document.getElementById(prefix + '_company'))
    params.customer_company = document.getElementById(prefix + '_company').value;
  if (document.getElementById(prefix + '_address_1'))
    params.customer_address = document.getElementById(prefix + '_address_1').value;
  if (document.getElementById(prefix + '_city'))
    params.customer_city_name = document.getElementById(prefix + '_city').value;
  if (document.getElementById(prefix + '_postcode'))
    params.customer_post_code = document.getElementById(prefix + '_postcode').value;
  if (document.getElementById('billing_phone'))
    params.customer_phone = document.getElementById('billing_phone').value;
  if (document.getElementById('billing_email'))
    params.customer_email = document.getElementById('billing_email').value;

  post_data.params = params;

  await jQuery.ajax({
    type: 'POST',
    url: delivery_with_econt_calculate_shipping_object.ajax_url + '',
    data: post_data,
    success: function(response) {
      jQuery('#delivery_with_econt_calculate_shipping').removeClass('height-30');
      showIframe(response);
    },
    dataType: 'html'
  });
}

function startLoader() {
  jQuery('#delivery_with_econt_calculation_container').addClass('econt-loader');
  jQuery('#place_iframe_here').css({'z-index': '-1', display: 'none'});
}

function stopLoader() {
  setTimeout(function() {
    jQuery('#delivery_with_econt_calculation_container').removeClass('econt-loader');
    jQuery('#place_iframe_here').css({'z-index': '1', "display": "block"});
  }, 1000);
}

function showPriceInfo(global_message) {
  let im = jQuery('#econt_detailed_shipping');
  im.empty();
  if (!checkIfShippingMethodIsEcont()) {
    im.css("display", "none");
  } else {
    if (checkIfPaymentMethodIsSelected('payment_method_cod')) {
      im.text(global_message);
    } else if (checkIfPaymentMethodIsSelected('payment_method_econt_payment')) {
      im.text("");
    } else {
      im.text("");
    }
    im.css("display", "block");
  }
}

function checkIfShippingMethodIsEcont() {
  let sh = jQuery('[value=delivery_with_econt]');
  if (sh.prop("type") === 'radio' && sh.prop('checked')) {
    return true;
  } else if (sh.prop("type") === 'hidden') {
    return true;
  }
  return false;
}

function checkIfPaymentMethodIsSelected(el_id_payment_method) {
  let del = jQuery('#' + el_id_payment_method);

  if (del.prop('type') === 'radio' && del.prop("checked")) {
    return true;
  } else if (del.prop("type") === 'hidden') {
    return true;
  }

  return false;
}

function dweCloseModal() {
  jQuery('#myModal').css({'display': 'none'});
  jQuery('html').css({'overflow-y': 'auto'});
}

jQuery('span.close').on('click', dweCloseModal);