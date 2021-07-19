/* global Nimiq */
/* global Errors */
/* global BitcoinConstants */
/* global BitcoinJS */
/* global CONFIG */

class BitcoinUtils { // eslint-disable-line no-unused-vars
    static get Network() {
        switch (CONFIG.BTC_NETWORK) {
            case BitcoinConstants.NETWORK.MAIN:
                return BitcoinJS.networks.bitcoin;
            case BitcoinConstants.NETWORK.TEST:
                return BitcoinJS.networks.testnet;
            default:
                throw new Error('Invalid BTC_NETWORK configuration');
        }
    }

    /**
     * @param {string[]} paths
     * @returns {{prefix: string, suffixes: string[]}}
     */
    static pathsToPrefixAndSuffixes(paths) {
        const sorted = paths.concat().sort();
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        let i = 0;
        while (i < first.length && first.charAt(i) === last.charAt(i)) {
            i += 1;
        }
        let prefix = first.substring(0, i);

        // Make sure prefix ends on a slash so we don't derive a partial step
        while (prefix.charAt(prefix.length - 1) !== '/') {
            prefix = prefix.substring(0, prefix.length - 1);
        }

        const suffixes = prefix ? paths.map(path => path.replace(prefix, '')) : paths;

        // Remove trailing slash from prefix before returning
        prefix = prefix.substring(0, prefix.length - 1);

        return {
            prefix,
            suffixes,
        };
    }

    /**
     * @param {BitcoinJSTypes.BIP32Interface} keyPair
     * @returns {BitcoinJSTypes.Payment}
     */
    static keyPairToNestedSegwit(keyPair) {
        return BitcoinJS.payments.p2sh({
            redeem: BitcoinJS.payments.p2wpkh({
                pubkey: keyPair.publicKey,
                network: BitcoinUtils.Network,
            }),
        });
    }

    /**
     * @param {BitcoinJSTypes.BIP32Interface} keyPair
     * @returns {BitcoinJSTypes.Payment}
     */
    static keyPairToNativeSegwit(keyPair) {
        return BitcoinJS.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: BitcoinUtils.Network,
        });
    }

    /**
     * @param {string} path
     * @returns {'BIP49'|'BIP84'}
     */
    static parseBipFromDerivationPath(path) {
        if (path.startsWith('m/49\'/')) return BitcoinConstants.BIP.BIP49;
        if (path.startsWith('m/84\'/')) return BitcoinConstants.BIP.BIP84;
        throw new Error(`Could not parse BIP from derivation path: ${path}`);
    }

    /**
     * @param {any} address
     * @returns {boolean}
     */
    static validateAddress(address) {
        try {
            const parsedAddress = BitcoinJS.address.fromBase58Check(address);
            return BitcoinConstants.BIP49_ADDRESS_VERSIONS[CONFIG.BTC_NETWORK].includes(parsedAddress.version);
        } catch (error) {
            // Ignore, try Bech32 format below
        }

        try {
            const parsedAddress = BitcoinJS.address.fromBech32(address);
            return BitcoinConstants.BIP84_ADDRESS_PREFIX[CONFIG.BTC_NETWORK] === parsedAddress.prefix;
        } catch (error) {
            return false;
        }
    }

    /**
     * @param {number} coins Bitcoin count in decimal
     * @returns {number} Number of Satoshis
     */
    static coinsToSatoshis(coins) {
        return Math.round(coins * BitcoinConstants.SATOSHIS_PER_COIN);
    }

    /**
     * @param {number} satoshis Number of Satoshis.
     * @returns {number} Bitcoin count in decimal.
     */
    static satoshisToCoins(satoshis) {
        return satoshis / BitcoinConstants.SATOSHIS_PER_COIN;
    }

    /**
     * @param {string | Uint8Array | Buffer} bytes
     * @param {'BIP49' | 'BIP84'} bip
     * @returns {string}
     */
    static addressBytesToAddress(bytes, bip) {
        if (typeof bytes === 'string') {
            bytes = Nimiq.BufferUtils.fromAny(bytes);
        }

        if (bip === BitcoinConstants.BIP.BIP49) {
            return BitcoinJS.address.toBase58Check(
                // @ts-ignore Argument of type 'Uint8Array | Buffer' is not assignable to parameter of type 'Buffer'.
                bytes,
                BitcoinConstants.BIP49_ADDRESS_VERSIONS[CONFIG.BTC_NETWORK][1], // 0 => BIP44, 1 => BIP49
            );
        }

        if (bip === BitcoinConstants.BIP.BIP84) {
            return BitcoinJS.address.toBech32(
                // @ts-ignore Argument of type 'Uint8Array | Buffer' is not assignable to parameter of type 'Buffer'.
                bytes,
                BitcoinConstants.BIP84_ADDRESS_VERSION,
                BitcoinConstants.BIP84_ADDRESS_PREFIX[CONFIG.BTC_NETWORK],
            );
        }

        throw new Errors.KeyguardError('TYPE ERROR: Invalid BIP');
    }
}
