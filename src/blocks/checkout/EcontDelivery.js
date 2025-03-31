"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

const EcontDelivery = () => {
    // Declare jQuery and wp variables
    const jQuery = window.jQuery
    const wp = window.wp

    // Component state
    const [iframeUrl, setIframeUrl] = useState("")
    const [globalShipmentPrices, setGlobalShipmentPrices] = useState({
        cod: undefined,
        cod_e: undefined,
        no_cod: undefined,
    })
    const [globalInfoMessage, setGlobalInfoMessage] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [useShipping, setUseShipping] = useState(true)
    const [buttonContainer, setButtonContainer] = useState(null)
    const [portalContainer, setPortalContainer] = useState(null)
    const [isEcontSelected, setIsEcontSelected] = useState(false)
    const [globalAlertMessage, setGlobalAlertMessage] = useState(false)
    const [cartTotal, setCartTotal] = useState(0)
    const [cartWeight, setCartWeight] = useState(1) // Default weight of 1kg
    const [checkoutButtonDisabled, setCheckoutButtonDisabled] = useState(false)
    const [isOrderButtonDisabled, setIsOrderButtonDisabled] = useState(false)
    const [currentShippingMethod, setCurrentShippingMethod] = useState("")

    // Refs
    const isMountedRef = useRef(true)
    const messageListenerRef = useRef(null)
    const econtContainerRef = useRef(null)
    const modalRef = useRef(null)

    // Get locale for button text
    const locale = document.documentElement.lang.split("-")[0] || "en"
    const buttonText = locale === "bg" ? "Редактирай данни" : "Edit details"
    const selectLocationText = locale === "bg" ? "Изчисли цена за доставка" : "Calculate shipping price"

    // Function to reset cookies and state
    const resetCookies = () => {
        document.cookie = "econt_shippment_price=0; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"
        document.cookie = "econt_customer_info_id=0; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;"

        setGlobalShipmentPrices({
            cod: undefined,
            cod_e: undefined,
            no_cod: undefined,
        })
        setGlobalInfoMessage("")
    }

    // Function to validate shipping price
    const validateShippingPrice = (e) => {
        if (
            isEcontShippingSelected() &&
            (globalShipmentPrices.cod === undefined ||
                globalShipmentPrices.cod_e === undefined ||
                globalShipmentPrices.no_cod === undefined)
        ) {
            e.preventDefault()
            e.stopPropagation()

            if (globalAlertMessage) {
                wp.data.dispatch("wc/store/cart").invalidateResolutionForStoreSelector("getCartData")
                setGlobalAlertMessage(false)
                return
            }

            alert(locale === "bg" ? "Моля калкулирайте цена за доставка с Еконт!" : "Please calculate Econt shipping price!")
            wp.data.dispatch("wc/store/cart").invalidateResolutionForStoreSelector("getCartData")
            setGlobalAlertMessage(true)
            return false
        }
    }

    // Function to check if Econt shipping is selected
    const isEcontShippingSelected = () => {
        // Try multiple selectors to find the Econt radio button
        const selectors = [
            'input[value="delivery_with_econt"]',
            'input[id*="delivery_with_econt"]',
            'input[name^="shipping_method"][value*="econt"]',
            'input[name^="shipping_method"][id*="econt"]',
        ]

        for (const selector of selectors) {
            const econtRadio = document.querySelector(selector)
            if (econtRadio) {
                if (econtRadio.type === "radio" && econtRadio.checked) {
                    return true
                } else if (econtRadio.type === "hidden") {
                    return true
                }
            }
        }

        // Also check if we have a shipping method with "econt" in the value
        if (typeof jQuery !== "undefined") {
            const shippingMethod = jQuery('input[name^="shipping_method"]:checked').val()
            if (shippingMethod && shippingMethod.includes("econt")) {
                return true
            }
        }

        return false
    }

    // Function to get current shipping method
    const getCurrentShippingMethod = () => {
        if (typeof jQuery !== "undefined") {
            const shippingMethod = jQuery('input[name^="shipping_method"]:checked').val() || ""
            return shippingMethod
        }
        return ""
    }

    // Function to check if a payment method is selected
    const isPaymentMethodSelected = (paymentMethodId) => {
        const paymentMethod = document.getElementById(paymentMethodId)
        if (paymentMethod) {
            if (paymentMethod.type === "radio" && paymentMethod.checked) {
                return true
            } else if (paymentMethod.type === "hidden") {
                return true
            }
        }
        return false
    }

    // Function to find the shipping option container
    const findShippingOptionContainer = () => {
        const selectors = [
            "#shipping-option",
            ".wc-block-components-shipping-rates-control",
            ".shipping_method",
            ".woocommerce-shipping-methods",
            "#shipping_method",
        ]

        for (const selector of selectors) {
            const element = document.querySelector(selector)
            if (element) {
                return element
            }
        }

        return null
    }

    // Function to find the Econt radio button label
    const findEcontRadioLabel = () => {
        // Look for the Econt radio button
        const econtRadio = document.querySelector('input[value="delivery_with_econt"]')
        if (econtRadio) {
            // Find the parent label element
            const label = econtRadio.closest("label")
            return label
        }
        return null
    }

    // Function to create a button container next to the Econt radio
    const createButtonContainerNextToEcontRadio = () => {
        if (!isMountedRef.current) return null

        // Find the Econt radio label
        const econtLabel = findEcontRadioLabel()
        if (!econtLabel) return null

        // Check if we already have a button container
        let container = document.getElementById("econt-button-container")

        // If no container exists, create one
        if (!container) {
            container = document.createElement("div")
            container.id = "econt-button-container"
            container.style.marginTop = "16px"
            container.style.marginBottom = "16px" // Indent to align with radio button
            container.style.marginLeft = "24px" // Indent to align with radio button
            container.style.marginRight = "24px" // Indent to align with radio button

            // Insert after the Econt radio label
            if (econtLabel.nextSibling) {
                econtLabel.parentNode.insertBefore(container, econtLabel.nextSibling)
            } else {
                econtLabel.parentNode.appendChild(container)
            }
        }

        return container
    }

    // Function to create a portal container after shipping options
    const createPortalContainerAfterShippingOption = () => {
        if (!isMountedRef.current) return null

        // Find the shipping option element
        const targetElement = findShippingOptionContainer()
        if (!targetElement) return null

        // Check if we already have a portal container
        let container = document.getElementById("econt-portal-container")

        // If no container exists, create one
        if (!container) {
            container = document.createElement("div")
            container.id = "econt-portal-container"

            // Insert after the shipping option
            if (targetElement.nextSibling) {
                targetElement.parentNode.insertBefore(container, targetElement.nextSibling)
            } else {
                targetElement.parentNode.appendChild(container)
            }
        }

        return container
    }

    // Function to disable/enable the place order button
    const togglePlaceOrderButton = (disable) => {
        // Update React state first
        setIsOrderButtonDisabled(disable)

        // Try to find the button using multiple selectors
        const buttonSelectors = [
            ".wc-block-components-checkout-place-order-button",
            "#place_order",
            "button[name='woocommerce_checkout_place_order']",
            ".checkout-button",
            "button.alt",
        ]

        let buttonFound = false

        // Try direct DOM manipulation first
        for (const selector of buttonSelectors) {
            const button = document.querySelector(selector)
            if (button) {
                buttonFound = true
                button.disabled = disable

                if (disable) {
                    button.style.opacity = "0.5"
                    button.style.cursor = "not-allowed"
                } else {
                    button.style.opacity = ""
                    button.style.cursor = ""
                }

            }
        }

        // Also try with jQuery for better compatibility
        if (typeof jQuery !== "undefined") {
            for (const selector of buttonSelectors) {
                const $button = jQuery(selector)
                if ($button.length) {
                    buttonFound = true

                    if (disable) {
                        $button.prop("disabled", true)
                        $button.addClass("disabled")
                        $button.css({
                            opacity: "0.5",
                            cursor: "not-allowed",
                        })
                    } else {
                        $button.prop("disabled", false)
                        $button.removeClass("disabled")
                        $button.css({
                            opacity: "1",
                            cursor: "pointer",
                        })
                    }

                }
            }
        }

    }

    // Function to create a modal container
    const createModalContainer = () => {
        if (!isMountedRef.current) return null

        // Check if we already have a modal container
        let container = document.getElementById("econt-modal-container")

        // If no container exists, create one
        if (!container) {
            container = document.createElement("div")
            container.id = "econt-modal-container"
            document.body.appendChild(container)
        }

        return container
    }

    // Function to check form fields before opening modal
    const checkForm = (useShipping) => {
        const fields = [
            `#${useShipping ? "shipping" : "billing"}-first_name`,
            `#${useShipping ? "shipping" : "billing"}-last_name`,
            `#${useShipping ? "shipping" : "billing"}-country`,
            `#${useShipping ? "shipping" : "billing"}-address_1`,
            `#${useShipping ? "shipping" : "billing"}-city`,
            `#${useShipping ? "shipping" : "billing"}-state`,
            `#${useShipping ? "shipping" : "billing"}-postcode`,
            "#billing-phone",
            "#email",
        ]

        let showModal = true

        fields.forEach((field) => {
            if (typeof jQuery !== "undefined") {
                if (jQuery(field).val() === "") {
                    showModal = false
                }
            }
        })

        return showModal
    }

    // Function to get cart data from the new WooCommerce Store API
    const getCartData = async () => {
        try {
            // Use the new WooCommerce Store API to get cart data
            if (wp && wp.data && wp.data.select("wc/store/cart")) {
                const cartData = wp.data.select("wc/store/cart").getCartData()

                // console.log(cartData)
                if (cartData) {
                    // console.log("Cart data from Store API:", cartData)

                    // Get total price from cart data
                    const total = cartData.totals?.total_items || 0
                    setCartTotal(Number.parseFloat(total) / 100) // Convert from cents to currency units

                    // Calculate total weight from cart items
                    const totalWeight = cartData.itemsWeight * 0.001

                    // console.log("Calculated total weight:", totalWeight)

                    // Set minimum weight of 1kg if calculated weight is less
                    const finalWeight = totalWeight > 0 ? totalWeight : 1
                    setCartWeight(finalWeight)

                    return {
                        total: Number.parseFloat(total) / 100,
                        weight: finalWeight,
                        currency: cartData.totals?.currency_code || "BGN",
                    }
                }
            }

            // Fallback to jQuery method if WP Store API is not available
            if (typeof jQuery !== "undefined") {
                const cartTotalElement = jQuery(".order-total .amount")
                if (cartTotalElement.length) {
                    const total =
                        Number.parseFloat(
                            cartTotalElement
                                .text()
                                .replace(/[^0-9,.]/g, "")
                                .replace(",", "."),
                        ) || 0
                    setCartTotal(total)

                    // Try to get weight from hidden input if available
                    let weight = 1
                    const weightInput = jQuery('input[name="cart_weight"]')
                    if (weightInput.length) {
                        weight = Number.parseFloat(weightInput.val()) || 1
                        setCartWeight(weight)
                    }

                    return { total, weight, currency: "BGN" }
                }
            }

            return { total: 0, weight: 1, currency: "BGN" }
        } catch (error) {
            return { total: 0, weight: 1, currency: "BGN" }
        }
    }

    // Function to get data from form and make AJAX request
    const getDataFromForm = async () => {

        if (!isMountedRef.current) {
            return
        }

        if (!isEcontShippingSelected()) {
            return
        }

        // Start loading
        setIsLoading(true)

        // Create modal container in advance
        const modalContainer = createModalContainer()

        // Get customer data from form
        const prefix = useShipping ? "shipping" : "billing"
        const customerData = {
            first_name: document.getElementById(`${prefix}-first_name`)?.value || "",
            last_name: document.getElementById(`${prefix}-last_name`)?.value || "",
            company: document.getElementById(`${prefix}-company`)?.value || "",
            address_1: document.getElementById(`${prefix}-address_1`)?.value || "",
            city: document.getElementById(`${prefix}-city`)?.value || "",
            postcode: document.getElementById(`${prefix}-postcode`)?.value || "",
            phone: document.getElementById(`${prefix}-phone`)?.value || "",
            email: document.getElementById("email")?.value || "",
        }

        // Prepare request params
        const params = {
            customer_name: `${customerData.first_name} ${customerData.last_name}`.trim(),
            customer_company: customerData.company,
            customer_address: customerData.address_1,
            customer_city_name: customerData.city,
            customer_post_code: customerData.postcode,
            customer_phone: customerData.phone,
            customer_email: customerData.email,
        }

        // Get cart data from the new WooCommerce Store API
        const cartData = await getCartData()

        // Extend params with cart data
        const extendedParams = {
            ...params,
            order_total: cartData.total,
            order_currency: cartData.currency,
            pack_count: 1,
            order_weight: cartData.weight, // Use the calculated weight from cart items
        }

        // Remove empty values
        Object.keys(params).forEach((key) => {
            if (!params[key]) delete params[key]
        })

        try {
            // Make AJAX request
            if (typeof jQuery !== "undefined") {

                if (!window.econtData) {
                    setIsLoading(false)
                    return
                }

                const response = await jQuery.ajax({
                    type: "POST",
                    url: window.econtData.ajaxUrl,
                    data: {
                        action: "woocommerce_delivery_with_econt_get_orderinfo",
                        security: window.econtData.nonce,
                        params: extendedParams,
                    },
                })

                if (!response) {
                    setIsLoading(false)
                    return
                }

                // Process URL
                let url
                if (typeof response === "string") {
                    url = response.split('"').join("").replace(/\\\//g, "/")
                } else if (typeof response === "object") {
                    url = response.toString()
                } else {
                    setIsLoading(false)
                    return
                }

                // Set locale and build full URL
                const validLocales = ["bg", "en", "gr", "ro"]
                const fullUrl = `${url}&lang=${validLocales.includes(locale) ? locale : "bg"}`

                // Update iframe with URL
                setIframeUrl(fullUrl)

                // Open the modal
                setIsModalOpen(true)

                // Stop loading after a short delay
                setTimeout(() => {
                    setIsLoading(false)
                }, 1000)
            } else {
                setIsLoading(false)
            }
        } catch (error) {
            setIsLoading(false)
        }
    }

    // Handle postMessage events from iframe
    const handleIframeMessage = async (event) => {
        // Check if message is from Econt
        const econtServiceUrl = document.querySelector('meta[name="econt-service-url"]')?.content
        if (econtServiceUrl && econtServiceUrl.indexOf(event.origin) < 0) {
            return
        }

        const data = event.data

        // Reset alert message flag
        setGlobalAlertMessage(false)

        // Handle error message
        if (data.shipment_error && data.shipment_error !== "") {
            if (typeof jQuery !== "undefined") {
                // jQuery("#econt_display_error_message").empty()
                alert(data.shipment_error)
                // jQuery(".econt-alert").addClass("active")

                // jQuery("html,body").animate(
                //     { scrollTop: jQuery("#delivery_with_econt_calculate_shipping").offset().top - 50 },
                //     750,
                // )

                // setTimeout(() => {
                //     jQuery(".econt-alert").removeClass("active")
                // }, 3500)
            }
            return false
        }

        // Store shipment prices
        setGlobalShipmentPrices({
            cod: data.shipping_price_cod,
            cod_e: data.shipping_price_cod_e,
            no_cod: data.shipping_price,
        })

        // Determine current shipping price based on payment method
        let shipmentPrice = data.shipping_price
        const codInput = document.getElementById("payment_method_cod")
        const econtPaymentInput = document.getElementById("payment_method_econt_payment")

        if (codInput && codInput.checked) {
            shipmentPrice = data.shipping_price_cod
        } else if (econtPaymentInput && econtPaymentInput.checked) {
            shipmentPrice = data.shipping_price_cod_e
        }

        // Set info message
        const infoMessage = `${data.shipping_price} ${data.shipping_price_currency_sign} за доставка и ${
            Math.round((shipmentPrice - data.shipping_price) * 100) / 100
        } ${data.shipping_price_currency_sign} наложен платеж.`

        setGlobalInfoMessage(infoMessage)

        // Set cookie
        document.cookie = `econt_shippment_price=${shipmentPrice}; path=/`

        // Close modal
        setIsModalOpen(false)

        // Update form fields
        const prefix = useShipping ? "shipping" : "billing"
        let fullName = []
        let company = ""

        if (data.face != null) {
            fullName = data.face.split(" ")
            company = data.name
        } else {
            fullName = data.name.split(" ")
        }

        // // Update form fields
        // if (document.getElementById(`${prefix}_first_name`))
        //     document.getElementById(`${prefix}_first_name`).value = fullName[0] ? fullName[0] : ""
        //
        // if (document.getElementById(`${prefix}_last_name`))
        //     document.getElementById(`${prefix}_last_name`).value = fullName[1] ? fullName[1] : ""
        //
        // if (document.getElementById(`${prefix}_company`)) document.getElementById(`${prefix}_company`).value = company
        //
        // if (document.getElementById(`${prefix}_address_1`))
        //     document.getElementById(`${prefix}_address_1`).value = data.address != "" ? data.address : data.office_name
        //
        // if (document.getElementById(`${prefix}_city`)) document.getElementById(`${prefix}_city`).value = data.city_name
        //
        // if (document.getElementById(`${prefix}_postcode`))
        //     document.getElementById(`${prefix}_postcode`).value = data.post_code
        //
        // if (document.getElementById("billing_phone")) document.getElementById("billing_phone").value = data.phone
        //
        // if (document.getElementById("billing_email")) document.getElementById("billing_email").value = data.email

        // Set customer info ID cookie
        document.cookie = `econt_customer_info_id=${data.id}; path=/`

        // Trigger checkout update
        wp.data.dispatch("wc/store/cart").invalidateResolutionForStoreSelector("getCartData")

        // Enable the place order button now that we have shipping data
        togglePlaceOrderButton(false) // Use the function to ensure state is updated too
    }

    // Function to show price info
    const showPriceInfo = () => {
        if (typeof jQuery !== "undefined") {
            const infoElement = jQuery("#econt_detailed_shipping")
            infoElement.empty()

            if (!isEcontShippingSelected()) {
                infoElement.css("display", "none")
            } else {
                if (isPaymentMethodSelected("payment_method_cod")) {
                    infoElement.text(globalInfoMessage)
                } else if (isPaymentMethodSelected("payment_method_econt_payment")) {
                    infoElement.text("")
                } else {
                    infoElement.text("")
                }
                infoElement.css("display", "block")
            }
        }
    }

    // Function to update checkout button state
    const updateCheckoutButtonState = (disabled) => {
        if (typeof jQuery !== "undefined") {
            const placeOrderButton = jQuery("#place_order")

            if (placeOrderButton.length) {
                if (disabled) {
                    // Disable the button
                    placeOrderButton.prop("disabled", true)
                    placeOrderButton.addClass("disabled")
                    placeOrderButton.css({
                        opacity: "0.5",
                        cursor: "not-allowed",
                    })

                    // Add a tooltip or message
                    if (!jQuery("#econt-shipping-warning").length) {
                        const warningMessage =
                            locale === "bg"
                                ? "Моля калкулирайте цена за доставка с Еконт преди да продължите!"
                                : "Please calculate Econt shipping price before proceeding!"

                        placeOrderButton.after(
                            `<div id="econt-shipping-warning" style="color: #e2401c; margin-top: 10px;">${warningMessage}</div>`,
                        )
                    }
                } else {
                    // Enable the button
                    placeOrderButton.prop("disabled", false)
                    placeOrderButton.removeClass("disabled")
                    placeOrderButton.css({
                        opacity: "1",
                        cursor: "pointer",
                    })

                    // Remove the warning message
                    jQuery("#econt-shipping-warning").remove()
                }
            }
        }
    }

    // Function to check shipping method and update UI accordingly
    const checkShippingMethod = () => {
        // Get current shipping method
        const newShippingMethod = getCurrentShippingMethod()
        const isEcont = isEcontShippingSelected()

        // Update state with current selection
        setIsEcontSelected(isEcont)
        setCurrentShippingMethod(newShippingMethod)

        if (isEcont) {
            // Create portal container if needed
            const container = createPortalContainerAfterShippingOption()
            if (container) {
                setPortalContainer(container)
            }

            // Create button container if needed
            const btnContainer = createButtonContainerNextToEcontRadio()
            if (btnContainer) {
                setButtonContainer(btnContainer)
            }

            // Get cart data when Econt is selected
            getCartData()

            // Check if we need to disable the checkout button
            const shouldDisableButton =
                globalShipmentPrices.cod === undefined ||
                globalShipmentPrices.cod_e === undefined ||
                globalShipmentPrices.no_cod === undefined

            // Disable place order button until shipping data is received
            togglePlaceOrderButton(shouldDisableButton)
        } else {
            // If Econt is not selected, make sure the button is enabled
            togglePlaceOrderButton(false)
        }
    }

    // Effect to monitor shipping method changes
    useEffect(() => {
        // Initial check
        checkShippingMethod()

        // Set up event listeners for shipping method changes
        const handleShippingMethodChange = () => {
            checkShippingMethod()

            // Double-check after a short delay to ensure changes are applied
            setTimeout(checkShippingMethod, 100)
            setTimeout(checkShippingMethod, 500)
        }

        if (typeof jQuery !== "undefined") {
            // Listen for checkout updates
            jQuery(document.body).on("updated_checkout", handleShippingMethodChange)

            // Listen for shipping method radio changes
            jQuery(document).on("change", 'input[name^="shipping_method"]', handleShippingMethodChange)

            // Also check when any input changes (broader approach)
            jQuery(document).on("change", "input", () => {
                setTimeout(checkShippingMethod, 100)
            })
        }

        // Also check periodically for the first few seconds
        const intervalId = setInterval(checkShippingMethod, 1000)
        setTimeout(() => clearInterval(intervalId), 2000)

        // Clean up event listeners
        return () => {
            if (typeof jQuery !== "undefined") {
                jQuery(document.body).off("updated_checkout", handleShippingMethodChange)
                jQuery(document).off("change", 'input[name^="shipping_method"]', handleShippingMethodChange)
                jQuery(document).off("change", "input")
            }
            clearInterval(intervalId)
        }
    }, [globalShipmentPrices])

    // Dedicated effect to handle shipping method changes
    useEffect(() => {

        // If not using Econt, ensure button is enabled
        if (!currentShippingMethod.includes("econt")) {

            // Enable button with a slight delay to ensure it happens after any other code
            setTimeout(() => togglePlaceOrderButton(false), 200)
            setTimeout(() => togglePlaceOrderButton(false), 500)
        }
    }, [currentShippingMethod])

    // Add a call to debugCartData in the useEffect that handles cart data changes
    // Find the useEffect with handleCartDataChange and add this line at the beginning of the function:
    // Replace the cart data change effect with this updated version
    useEffect(() => {
        // Function to handle cart data changes
        const handleCartDataChange = () => {
            if (isEcontSelected) {
                // Debug cart data structure to find weight information
                // debugCartData()
                getCartData()
            }
        }

        // Set up subscription to cart data changes
        let unsubscribe
        if (wp && wp.data && wp.data.subscribe) {
            unsubscribe = wp.data.subscribe(() => {
                const newCartData = wp.data.select("wc/store/cart")?.getCartData()
                if (newCartData) {
                    handleCartDataChange()
                }
            })
        }

        // Initial debug and data fetch
        if (isEcontSelected) {
            // debugCartData()
            getCartData()
        }

        // Clean up subscription
        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [isEcontSelected])

    // Effect to update portal container when shipping method changes
    useEffect(() => {
        if (isEcontSelected) {
            const container = createPortalContainerAfterShippingOption()
            if (container) {
                setPortalContainer(container)
            }

            const btnContainer = createButtonContainerNextToEcontRadio()
            if (btnContainer) {
                setButtonContainer(btnContainer)
            }

            // Show price info
            showPriceInfo()

            // Check if we need to disable the checkout button
            const shouldDisableButton =
                globalShipmentPrices.cod === undefined ||
                globalShipmentPrices.cod_e === undefined ||
                globalShipmentPrices.no_cod === undefined

            setCheckoutButtonDisabled(shouldDisableButton)
            updateCheckoutButtonState(shouldDisableButton)
        }
    }, [isEcontSelected, globalInfoMessage])

    // Effect to set up message event listener
    useEffect(() => {
        messageListenerRef.current = handleIframeMessage
        window.addEventListener("message", handleIframeMessage)

        return () => {
            window.removeEventListener("message", handleIframeMessage)
            messageListenerRef.current = null
        }
    }, [useShipping])

    // Effect to handle modal close on escape key
    useEffect(() => {
        const handleEscapeKey = (e) => {
            if (e.key === "Escape" && isModalOpen) {
                setIsModalOpen(false)
            }
        }

        document.addEventListener("keydown", handleEscapeKey)

        return () => {
            document.removeEventListener("keydown", handleEscapeKey)
        }
    }, [isModalOpen])

    // Effect to handle click outside modal to close
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target) && isModalOpen) {
                // Check if the click is on the modal overlay (background)
                if (e.target.classList.contains("econt-modal-overlay")) {
                    setIsModalOpen(false)
                }
            }
        }

        document.addEventListener("mousedown", handleClickOutside)

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isModalOpen])

    // Effect to handle payment method changes
    useEffect(() => {
        const handlePaymentMethodChange = () => {
            if (typeof jQuery !== "undefined") {
                const paymentInputs = jQuery('input[name^="payment_method"]')

                paymentInputs.each((key, field) => {
                    jQuery(`#${field.id}`).change(function () {
                        if (this.value === "cod" && isEcontShippingSelected()) {
                            document.cookie = `econt_shippment_price=${globalShipmentPrices.cod}; path=/`
                            jQuery("#econt_detailed_shipping").css("display", "block")
                        } else if (this.value === "econt_payment" && isEcontShippingSelected()) {
                            document.cookie = `econt_shippment_price=${globalShipmentPrices.cod_e}; path=/`
                            jQuery("#econt_detailed_shipping").css("display", "block")
                        } else if (isEcontShippingSelected()) {
                            document.cookie = `econt_shippment_price=${globalShipmentPrices.no_cod}; path=/`
                            jQuery("#econt_detailed_shipping").css("display", "none")
                        }

                        wp.data.dispatch("wc/store/cart").invalidateResolutionForStoreSelector("getCartData")
                    })
                })
            }
        }

        if (typeof jQuery !== "undefined") {
            jQuery(document.body).on("updated_checkout", handlePaymentMethodChange)
        }

        return () => {
            if (typeof jQuery !== "undefined") {
                jQuery(document.body).off("updated_checkout", handlePaymentMethodChange)
            }
        }
    }, [globalShipmentPrices])

    // Effect to handle place order button click
    useEffect(() => {
        const handlePlaceOrderClick = (e) => {
            validateShippingPrice(e)
        }

        if (typeof jQuery !== "undefined") {
            jQuery("#place_order").on("click", handlePlaceOrderClick)
        }

        return () => {
            if (typeof jQuery !== "undefined") {
                jQuery("#place_order").off("click", handlePlaceOrderClick)
            }
        }
    }, [globalShipmentPrices])

    // Effect to handle coupon changes
    useEffect(() => {
        const handleCouponChange = () => {
            resetCookies()
        }

        if (typeof jQuery !== "undefined") {
            jQuery("button[name='apply_coupon']").on("click", handleCouponChange)
            jQuery("a.woocommerce-remove-coupon").on("click", handleCouponChange)
        }

        return () => {
            if (typeof jQuery !== "undefined") {
                jQuery("button[name='apply_coupon']").off("click", handleCouponChange)
                jQuery("a.woocommerce-remove-coupon").off("click", handleCouponChange)
            }
        }
    }, [])

    // Effect to handle checkout errors
    useEffect(() => {
        const handleCheckoutError = () => {
            resetCookies()
            wp.data.dispatch("wc/store/cart").invalidateResolutionForStoreSelector("getCartData")
        }

        if (typeof jQuery !== "undefined") {
            jQuery(document.body).on("checkout_error", handleCheckoutError)
        }

        return () => {
            if (typeof jQuery !== "undefined") {
                jQuery(document.body).off("checkout_error", handleCheckoutError)
            }
        }
    }, [])

    // Effect to clean up on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false

            // Clean up any event listeners
            if (typeof jQuery !== "undefined") {
                jQuery(document.body).off("updated_checkout")
                jQuery('input[name^="shipping_method"]').off("change")
                jQuery("#place_order").off("click")
                jQuery("button[name='apply_coupon']").off("click")
                jQuery("a.woocommerce-remove-coupon").off("click")
                jQuery(document.body).off("checkout_error")
            }

            // Remove message event listener
            if (messageListenerRef.current) {
                window.removeEventListener("message", messageListenerRef.current)
                messageListenerRef.current = null
            }

            // Remove portal container
            const container = document.getElementById("econt-portal-container")
            if (container) {
                container.remove()
            }

            // Remove button container
            const btnContainer = document.getElementById("econt-button-container")
            if (btnContainer) {
                btnContainer.remove()
            }

            // Remove modal container
            const modalContainer = document.getElementById("econt-modal-container")
            if (modalContainer) {
                modalContainer.remove()
            }
        }
    }, [])

    // Render the button next to Econt radio
    const renderEcontButton = () => {
        if (!isEcontSelected) {
            return null
        }

        // Create button container if it doesn't exist
        const btnContainer = buttonContainer || createButtonContainerNextToEcontRadio()
        if (!btnContainer) {
            return null
        }

        // Set button container state if needed
        if (btnContainer !== buttonContainer) {
            setButtonContainer(btnContainer)
        }

        return createPortal(
            <button
                type="button"
                id="calculate_shipping_button"
                className="econt-button econt-button-select"
                style={{
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#0066cc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px",
                    marginTop: "8px",
                }}
                onClick={() => {
                    getDataFromForm()
                }}
            >
                {globalShipmentPrices.no_cod ? buttonText : selectLocationText}
            </button>,
            btnContainer,
        )
    }

    // Render the modal
    const renderModal = () => {
        if (!isModalOpen) return null

        const modalContainer = createModalContainer()
        if (!modalContainer) return null

        return createPortal(
            <div
                id="myModal"
                className="econt-modal-overlay"
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 9999,
                }}
            >
                <div
                    ref={modalRef}
                    className="econt-modal"
                    style={{
                        backgroundColor: "white",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                        width: "90%",
                        maxWidth: "900px",
                        maxHeight: "90vh",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    <div
                        className="econt-modal-header"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "16px 24px",
                            borderBottom: "1px solid #eee",
                        }}
                    >
                        <h3 style={{ margin: 0 }}>{locale === "bg" ? "Доставка с Еконт" : "Econt Delivery"}</h3>
                        <button
                            type="button"
                            className="econt-modal-close"
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "24px",
                                padding: "4px",
                                lineHeight: "1",
                            }}
                            onClick={() => setIsModalOpen(false)}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                    </div>
                    <div
                        className="econt-modal-body"
                        style={{
                            padding: "24px",
                            overflow: "auto",
                            flex: 1,
                        }}
                    >
                        {/* Loading indicator */}
                        {isLoading && (
                            <div
                                className="econt-loading"
                                style={{
                                    padding: "20px",
                                    backgroundColor: "#f8f9fa",
                                    textAlign: "center",
                                }}
                            >
                                {locale === "bg" ? "Зареждане..." : "Loading..."}
                            </div>
                        )}

                        {/* Iframe container */}
                        <div
                            id="place_iframe_here"
                            style={{
                                display: isLoading ? "none" : "block",
                                zIndex: isLoading ? "-1" : "1",
                            }}
                        >
                            {iframeUrl && (
                                <iframe
                                    src={iframeUrl}
                                    id="delivery_with_econt_iframe"
                                    name="econt_iframe_form"
                                    scrolling="yes"
                                    style={{
                                        width: "100%",
                                        height: "600px",
                                        border: "none",
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>,
            modalContainer,
        )
    }

    // If we have a portal container and Econt is selected, render through portal
    if (portalContainer && isEcontSelected) {
        return createPortal(
            <div
                ref={econtContainerRef}
                className="wp-block-econt-delivery"
                style={{
                    position: "relative",
                    zIndex: "10",
                    display: "block",
                    visibility: "visible",
                    opacity: "1",
                    marginTop: "20px",
                    marginBottom: "32px",
                }}
                data-econt-component="true"
                data-econt-shipping-selected="true"
            >
                {renderEcontButton()}
                {renderModal()}
            </div>,
            portalContainer,
        )
    }

    // Fallback render method if portal is not available
    return (
        <div
            ref={econtContainerRef}
            className="wp-block-econt-delivery"
            style={{
                position: "relative",
                zIndex: isEcontSelected ? "10" : "-1",
                display: isEcontSelected ? "block" : "none",
                visibility: isEcontSelected ? "visible" : "hidden",
                opacity: isEcontSelected ? "1" : "0",
            }}
            data-econt-component="true"
            data-econt-shipping-selected={isEcontSelected ? "true" : "false"}
        >
            {renderEcontButton()}
            {renderModal()}
        </div>
    )
}

export default EcontDelivery

