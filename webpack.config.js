const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
    ...defaultConfig,
    entry: {
        'blocks/checkout': './src/blocks/checkout/index.js',
    },
    resolve: {
        ...defaultConfig.resolve,
        extensions: ['.js', '.jsx', '.ts', '.tsx', ...defaultConfig.resolve.extensions],
    }
}; 