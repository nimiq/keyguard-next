const BitcoinConstants = { // eslint-disable-line no-unused-vars
    SATOSHIS_PER_COIN: 1e8,
    NETWORK: {
        MAIN: /** @type {'MAIN'} */ ('MAIN'),
        TEST: /** @type {'TEST'} */ ('TEST'),
    },
    BIP: {
        BIP49: /** @type {'BIP49'} */ ('BIP49'), // Nested SegWit
        BIP84: /** @type {'BIP84'} */ ('BIP84'), // Native SegWit
    },
    ACCOUNT_DERIVATION_PATH: { // Used in tests
        BIP49: {
            MAIN: 'm/49\'/0\'/0\'',
            TEST: 'm/49\'/1\'/0\'',
        },
        BIP84: {
            MAIN: 'm/84\'/0\'/0\'',
            TEST: 'm/84\'/1\'/0\'',
        },
    },
    EXTENDED_KEY_PREFIXES: {
        // See https://github.com/satoshilabs/slips/blob/master/slip-0132.md#registered-hd-version-bytes
        BIP49: {
            MAIN: {
                public: 0x049d7cb2, // ypub
                private: 0x049d7878, // yprv
            },
            TEST: {
                public: 0x044a5262, // upub
                private: 0x044a4e28, // uprv
            },
        },
        BIP84: {
            MAIN: {
                public: 0x04b24746, // zpub
                private: 0x04b2430c, // zprv
            },
            TEST: {
                public: 0x045f1cf6, // vpub
                private: 0x045f18bc, // vprv
            },
        },
    },
    BIP49_ADDRESS_VERSIONS: {
        // See https://en.bitcoin.it/wiki/List_of_address_prefixes
        MAIN: [0, 5],
        TEST: [111, 196],
    },
    BIP84_ADDRESS_PREFIX: {
        // See https://en.bitcoin.it/wiki/List_of_address_prefixes
        MAIN: 'bc',
        TEST: 'tb',
    },
    BIP84_ADDRESS_VERSION: 0,
};
