import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import { useSelect } from '@wordpress/data';
import EcontDelivery from './EcontDelivery';

const EcontShippingContent = () => {
    const { isEcontShippingSelected } = useSelect((select) => {
        const store = select('wc/store/cart');
        if (!store) {
            return { isEcontShippingSelected: false };
        }

        // Get shipping rates
        const shippingRates = store.getShippingRates();

        // Find selected shipping rate
        const selectedRate = shippingRates?.[0]?.shipping_rates?.find(rate => rate.selected);

        return {
            isEcontShippingSelected: selectedRate?.method_id === 'delivery_with_econt'
        };
    }, []);

    if (!isEcontShippingSelected) {
        return null;
    }

    return <EcontDelivery />;
};

console.log('Registering Econt delivery block plugin');

registerPlugin('econt-delivery-block', {
    render: EcontShippingContent,
    scope: 'woocommerce-checkout'
});