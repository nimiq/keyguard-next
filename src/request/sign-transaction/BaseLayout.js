/* global Nimiq */
/* global KeyStore */
/* global Identicon */
/* global PassphraseBox */

class BaseLayout {
    /**
     * @param {ParsedSignTransactionRequest} request
     * @param {Function} resolve
     * @param {Function} reject
     */
    constructor(request, resolve, reject) {
        /** @type {HTMLDivElement} */
        const $pageBody = (document.querySelector('#confirm-transaction .transaction'));

        /** @type {HTMLDivElement} */
        const $senderIdenticon = ($pageBody.querySelector('#sender-identicon'));
        /** @type {HTMLDivElement} */
        const $recipientIdenticon = ($pageBody.querySelector('#recipient-identicon'));

        /** @type {HTMLDivElement} */
        const $senderLabel = ($pageBody.querySelector('#sender-label'));
        /** @type {HTMLDivElement} */
        const $recipientLabel = ($pageBody.querySelector('#recipient-label'));

        /** @type {HTMLDivElement} */
        const $senderAddress = ($pageBody.querySelector('#sender-address'));
        /** @type {HTMLDivElement} */
        const $recipientAddress = ($pageBody.querySelector('#recipient-address'));

        /** @type {HTMLDivElement} */
        const $value = ($pageBody.querySelector('#value'));
        /** @type {HTMLDivElement} */
        const $fee = ($pageBody.querySelector('#fee'));
        /** @type {HTMLDivElement} */
        const $data = ($pageBody.querySelector('#data'));

        // Set sender data.
        const transaction = request.transaction;
        const senderAddress = transaction.sender.toUserFriendlyAddress();
        new Identicon(senderAddress, $senderIdenticon); // eslint-disable-line no-new
        $senderAddress.textContent = senderAddress;
        if (request.senderLabel) {
            $senderLabel.classList.remove('display-none');
            $senderLabel.textContent = request.senderLabel;
        }

        // Set recipient data.
        if ($recipientAddress) {
            const recipientAddress = transaction.recipient.toUserFriendlyAddress();
            if (request.layout === 'checkout') {
                new Identicon(undefined, $recipientIdenticon); // eslint-disable-line no-new
            } else {
                new Identicon(recipientAddress, $recipientIdenticon); // eslint-disable-line no-new
            }
            $recipientAddress.textContent = recipientAddress;
            if (request.recipientLabel) {
                $recipientLabel.classList.remove('display-none');
                $recipientLabel.textContent = request.recipientLabel;
            }
        }

        // Set value and fee.
        const total = transaction.value + transaction.fee;
        const totalNim = Nimiq.Policy.satoshisToCoins(total);

        $value.textContent = this._formatNumber(totalNim);

        if ($fee && transaction.fee > 0) {
            $fee.textContent = Nimiq.Policy.satoshisToCoins(transaction.fee).toString();
            /** @type {HTMLDivElement} */
            const $feeSection = ($pageBody.querySelector('.fee-section'));
            $feeSection.classList.remove('display-none');
        }

        // Set transaction extra data.
        if ($data && transaction.data.byteLength > 0) {
            // FIXME Detect and use proper encoding.
            $data.textContent = Nimiq.BufferUtils.toAscii(transaction.data);
            /** @type {HTMLDivElement} */
            const $dataSection = ($pageBody.querySelector('.data-section'));
            $dataSection.classList.remove('display-none');
        }

        // Set up passphrase box.
        /** @type {HTMLFormElement} */
        const $passphraseBox = (document.querySelector('#passphrase-box'));
        this._passphraseBox = new PassphraseBox($passphraseBox, {
            bgColor: 'purple',
            hideInput: !request.keyInfo.encrypted,
            buttonI18nTag: 'passphrasebox-confirm-tx',
        });

        this._passphraseBox.on(
            PassphraseBox.Events.SUBMIT,
            passphrase => this._onConfirm(request, resolve, reject, passphrase),
        );
        this._passphraseBox.on(PassphraseBox.Events.CANCEL, () => window.history.back());

        /** @type {HTMLElement} */
        const $appName = (document.querySelector('#app-name'));
        $appName.textContent = request.appName;
        /** @type HTMLAnchorElement */
        const $cancelLink = ($appName.parentNode);
        $cancelLink.classList.remove('display-none');
        $cancelLink.addEventListener('click', () => window.close());
    }

    /**
     * @param {ParsedSignTransactionRequest} request
     * @param {Function} resolve
     * @param {Function} reject
     * @param {string} passphrase
     * @returns {Promise<void>}
     * @private
     */
    async _onConfirm(request, resolve, reject, passphrase) {
        document.body.classList.add('loading');

        try {
            // XXX Passphrase encoding
            const passphraseBuf = Nimiq.BufferUtils.fromAscii(passphrase);
            const key = await KeyStore.instance.get(request.keyInfo.id, passphraseBuf);
            if (!key) {
                reject(new Error('Failed to retrieve key'));
                return;
            }

            const publicKey = key.derivePublicKey(request.keyPath);
            const signature = key.sign(request.keyPath, request.transaction.serializeContent());
            const result = /** @type {SignTransactionResult} */ {
                publicKey: publicKey.serialize(),
                signature: signature.serialize(),
            };
            resolve(result);
        } catch (e) {
            console.error(e);
            document.body.classList.remove('loading');

            // Assume the passphrase was wrong
            this._passphraseBox.onPassphraseIncorrect();
        }
    }

    run() {
        // Go to start page
        window.location.hash = BaseLayout.Pages.CONFIRM_TRANSACTION;
        this._passphraseBox.focus();

        // Async pre-load the crypto worker to reduce wait time at first decrypt attempt
        Nimiq.CryptoWorker.getInstanceAsync();
    }

    /**
     * @param {number} value
     * @param {number} [maxDecimals]
     * @param {number} [minDecimals]
     * @returns {string}
     */
    _formatNumber(value, maxDecimals = 5, minDecimals = 2) {
        const roundingFactor = 10 ** maxDecimals;
        value = Math.floor(value * roundingFactor) / roundingFactor;

        const result = parseFloat(value.toFixed(minDecimals)) === value
            ? value.toFixed(minDecimals)
            : value.toString();

        if (Math.abs(value) < 10000) return result;

        // Add thin spaces (U+202F) every 3 digits. Stop at the decimal separator if there is one.
        const regexp = minDecimals > 0 ? /(\d)(?=(\d{3})+\.)/g : /(\d)(?=(\d{3})+$)/g;
        return result.replace(regexp, '$1\u202F');
    }
}

BaseLayout.Pages = {
    CONFIRM_TRANSACTION: 'confirm-transaction',
};