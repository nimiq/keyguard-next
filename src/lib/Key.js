/* global Constants */
/* global Nimiq */
/* global SignMessageConstants */

class Key {
    /**
     * @param {Uint8Array} input
     * @returns {string}
     */
    static deriveHash(input) {
        return Nimiq.Hash.blake2b(input).toBase64();
    }

    /**
     * @param {Nimiq.Entropy|Nimiq.PrivateKey} secret
     * @param {boolean} [hasPin]
     */
    constructor(secret, hasPin = false) {
        this._secret = secret;
        this._hasPin = hasPin;
        /** @type {string?} */
        this._id = null;
        this._defaultAddress = this.deriveAddress(Constants.DEFAULT_DERIVATION_PATH);
    }

    /**
     * @param {string} path
     * @returns {Nimiq.PublicKey}
     */
    derivePublicKey(path) {
        return Nimiq.PublicKey.derive(this.derivePrivateKey(path));
    }

    /**
     * @param {string} path
     * @returns {Nimiq.Address}
     */
    deriveAddress(path) {
        return this.derivePublicKey(path).toAddress();
    }

    /**
     * @param {string} path
     * @param {Uint8Array} data
     * @returns {Nimiq.Signature}
     */
    sign(path, data) {
        const privateKey = this.derivePrivateKey(path);
        const publicKey = Nimiq.PublicKey.derive(privateKey);
        return Nimiq.Signature.create(privateKey, publicKey, data);
    }

    /**
     * @param {string} path
     * @param {Uint8Array} message - A byte array
     * @returns {Nimiq.Signature}
     */
    signMessage(path, message) {
        const msgLength = message.byteLength;
        const msgLengthAsString = msgLength.toString(10);

        /**
         * Adding a prefix to the message makes the calculated signature recognisable as
         * a Nimiq specific signature. This and the hashing prevents misuse where a malicious
         * request can sign arbitrary data (e.g. a transaction) and use the signature to
         * impersonate the victim. (https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign)
         */
        const dataLength = SignMessageConstants.SIGN_MSG_PREFIX.length
                         + msgLengthAsString.length
                         + msgLength;

        // Construct buffer
        const data = new Nimiq.SerialBuffer(dataLength);
        data.write(Nimiq.BufferUtils.fromAscii(SignMessageConstants.SIGN_MSG_PREFIX));
        data.write(Nimiq.BufferUtils.fromAscii(msgLengthAsString));
        data.write(message);

        // Hash data before signing (uses SHA256, because it is the widest available)
        const hash = Nimiq.Hash.computeSha256(data);

        return this.sign(path, hash);
    }

    /**
     * @param {string} path
     * @returns {Nimiq.PrivateKey}
     */
    derivePrivateKey(path) {
        return this._secret instanceof Nimiq.Entropy
            ? this._secret.toExtendedPrivateKey().derivePath(path).privateKey
            : this._secret;
    }

    /**
     * @type {string}
     */
    get id() {
        if (!this._id) {
            this._id = this.hash;
        }
        return this._id;
    }

    /**
     * @type {Nimiq.Entropy|Nimiq.PrivateKey}
     */
    get secret() {
        return this._secret;
    }

    /**
     * @type {Nimiq.Secret.Type}
     */
    get type() {
        return this._secret.type;
    }

    /**
     * @type {boolean}
     */
    get hasPin() {
        return this._hasPin;
    }

    set hasPin(hasPin) {
        /** @type {boolean} */ // Annotation required for Typescript
        this._hasPin = hasPin;
    }

    get defaultAddress() {
        return this._defaultAddress;
    }

    /**
     * @type {string}
     */
    get hash() {
        // Private keys use the address as input, as during migration of legacy accounts
        // their entropy or public key is not known, as it is stored encrypted.
        const input = this._secret instanceof Nimiq.Entropy
            ? this._secret.serialize()
            : Nimiq.PublicKey.derive(this._secret).toAddress().serialize();
        return Key.deriveHash(input);
    }
}

Key.PIN_LENGTH = 6;
