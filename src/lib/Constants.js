const Constants = { // eslint-disable-line no-unused-vars
    MIN_WIDTH_FOR_AUTOFOCUS: 600, // px
    NETWORK: {
        DEV: 'dev',
        TEST: 'test',
        MAIN: 'main',
    },
    LEGACY_DERIVATION_PATH: 'm/0\'',
    DEFAULT_DERIVATION_PATH: 'm/44\'/242\'/0\'/0\'',
    CASHLINK_FUNDING_DATA: new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    SWAP_IFRAME_SESSION_STORAGE_KEY_PREFIX: 'swap_id_',
};
