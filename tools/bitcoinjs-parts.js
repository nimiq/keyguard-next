const {
    bip32,
    networks,
    payments,
    address,
    script,
    Psbt,
    ECPair, // Used in swap-iframe to recreate keypairs from stored privatekeys
} = require('bitcoinjs-lib'); // eslint-disable-line import/no-extraneous-dependencies

const { Buffer } = require('buffer');

module.exports = {
    bip32,
    networks,
    payments,
    address,
    script,
    Psbt,
    ECPair,
    Buffer,
};
