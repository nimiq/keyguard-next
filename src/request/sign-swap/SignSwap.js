/* global Nimiq */
/* global Key */
/* global KeyStore */
/* global PasswordBox */
/* global Errors */
/* global Utf8Tools */
/* global TopLevelApi */
/* global NumberFormatting */
/* global BitcoinUtils */
/* global BitcoinKey */
/* global Identicon */
/* global IqonHash */
/* global LoginFileConfig */
/* global TemplateTags */
/* global I18n */
/* global Constants */

/**
 * @callback SignSwap.resolve
 * @param {KeyguardRequest.SimpleResult} result
 */

class SignSwap {
    /**
     * @param {Parsed<KeyguardRequest.SignSwapRequest>} request
     * @param {SignSwap.resolve} resolve
     * @param {reject} reject
     */
    constructor(request, resolve, reject) {
        this._request = request;
        /** @type {HTMLElement} */
        this.$el = (document.getElementById(SignSwap.Pages.CONFIRM_SWAP));

        const fundTx = request.fund;
        const redeemTx = request.redeem;

        /** @type {HTMLDivElement} */
        const $exchangeRate = (this.$el.querySelector('#exchange-rate'));
        /** @type {HTMLDivElement} */
        const $identicon = (this.$el.querySelector('.identicon'));
        /** @type {HTMLSpanElement} */
        const $nimLabel = (this.$el.querySelector('.nimiq-address .label'));
        /** @type {HTMLDivElement} */
        const $balanceBar = (this.$el.querySelector('.balance-bar'));
        /** @type {HTMLDivElement} */
        const $swapValues = (this.$el.querySelector('.swap-values'));
        /** @type {HTMLSpanElement} */
        const $swapNimValue = (this.$el.querySelector('#swap-nim-value'));
        /** @type {HTMLSpanElement} */
        const $newNimBalance = (this.$el.querySelector('#new-nim-balance'));
        /** @type {HTMLSpanElement} */
        const $swapBtcValue = (this.$el.querySelector('#swap-btc-value'));
        /** @type {HTMLSpanElement} */
        const $newBtcBalance = (this.$el.querySelector('#new-btc-balance'));
        /** @type {HTMLSpanElement} */
        const $swapNimValueFiat = (this.$el.querySelector('#swap-nim-value-fiat'));
        /** @type {HTMLSpanElement} */
        const $newNimBalanceFiat = (this.$el.querySelector('#new-nim-balance-fiat'));
        /** @type {HTMLSpanElement} */
        const $swapBtcValueFiat = (this.$el.querySelector('#swap-btc-value-fiat'));
        /** @type {HTMLSpanElement} */
        const $newBtcBalanceFiat = (this.$el.querySelector('#new-btc-balance-fiat'));

        // The total amount of NIM the user loses/receives
        const swapNimValue = fundTx.type === 'NIM' // eslint-disable-line no-nested-ternary
            ? fundTx.transaction.value + fundTx.transaction.fee
            : redeemTx.type === 'NIM'
                ? redeemTx.transaction.value
                : 0; // Should never happen, if parsing works correctly

        // The total amount of BTC the user loses/receives
        const swapBtcValue = fundTx.type === 'BTC' // eslint-disable-line no-nested-ternary
            ? fundTx.inputs.reduce((sum, input) => sum + input.witnessUtxo.value, 0)
                - (fundTx.changeOutput ? fundTx.changeOutput.value : 0)
            : redeemTx.type === 'BTC'
                ? redeemTx.output.value
                : 0; // Should never happen, if parsing works correctly

        $swapNimValue.textContent = `${fundTx.type === 'NIM' ? '-' : '+'}\u2009${NumberFormatting.formatNumber(
            Nimiq.Policy.lunasToCoins(swapNimValue),
        )}`;
        $swapNimValueFiat.textContent = NumberFormatting.formatCurrency(
            Nimiq.Policy.lunasToCoins(swapNimValue) * request.nimFiatRate,
            request.fiatCurrency,
        );

        $swapBtcValue.textContent = `${fundTx.type === 'BTC' ? '-' : '+'}\u2009${NumberFormatting.formatNumber(
            BitcoinUtils.satoshisToCoins(swapBtcValue),
            8,
        )}`;
        $swapBtcValueFiat.textContent = NumberFormatting.formatCurrency(
            BitcoinUtils.satoshisToCoins(swapBtcValue) * request.btcFiatRate,
            request.fiatCurrency,
        );

        $swapValues.classList.add(`${fundTx.type.toLowerCase()}-to-${redeemTx.type.toLowerCase()}`);

        // Exchange rate
        const nimExchangeValue = fundTx.type === 'NIM' // eslint-disable-line no-nested-ternary
            // When the user funds NIM, the service receives the HTLC balance - their network fee.
            ? Nimiq.Policy.lunasToCoins(fundTx.transaction.value - request.serviceFundingNetworkFee)
            : redeemTx.type === 'NIM'
                // When the user redeems NIM, the service lost the HTLC balance + their network fee.
                // The transaction value is "HTLC balance - tx fee", therefore the "HTLC balance"
                // is the transaction value + tx fee.
                ? Nimiq.Policy.lunasToCoins(
                    redeemTx.transaction.value + redeemTx.transaction.fee + request.serviceRedeemingNetworkFee,
                )
                : 0; // Should never happen, if parsing works correctly

        const btcExchangeValue = fundTx.type === 'BTC' // eslint-disable-line no-nested-ternary
            // When the user funds BTC, the service receives the HTLC balance - their network fee.
            ? BitcoinUtils.satoshisToCoins(fundTx.recipientOutput.value - request.serviceFundingNetworkFee)
            : redeemTx.type === 'BTC'
                // When the user redeems BTC, the service lost the HTLC balance + their network fee.
                // The HTLC balance is represented by the redeeming tx input value.
                ? BitcoinUtils.satoshisToCoins(redeemTx.input.witnessUtxo.value + request.serviceRedeemingNetworkFee)
                : 0; // Should never happen, if parsing works correctly

        if (!nimExchangeValue || !btcExchangeValue) {
            throw new Errors.KeyguardError(
                `UNEXPECTED: Swap values are invalid - NIM: ${nimExchangeValue}, BTC: ${btcExchangeValue}`,
            );
        }

        const exchangeRate = BitcoinUtils.satoshisToCoins(
            Math.round(BitcoinUtils.coinsToSatoshis(btcExchangeValue / nimExchangeValue)),
        );
        $exchangeRate.textContent = `1 NIM = ${NumberFormatting.formatNumber(
            exchangeRate,
            8, 8, // max decimals, min decimals (always show all BTC decimals for the exchange rate)
        )} BTC`;

        const swapNimAddress = fundTx.type === 'NIM' // eslint-disable-line no-nested-ternary
            ? fundTx.transaction.sender.toUserFriendlyAddress()
            : redeemTx.type === 'NIM'
                ? redeemTx.transaction.recipient.toUserFriendlyAddress()
                : ''; // Should never happen, if parsing works correctly
        const nimAddressInfo = request.nimiqAddresses.find(address => address.address === swapNimAddress);
        if (!nimAddressInfo) {
            throw new Errors.KeyguardError('UNEXPECTED: Address info of swap NIM address not found');
        }

        // eslint-disable-next-line no-new
        new Identicon(nimAddressInfo.address, $identicon);
        $nimLabel.textContent = fundTx.type === 'NIM' // eslint-disable-line no-nested-ternary
            ? fundTx.senderLabel
            : redeemTx.type === 'NIM'
                ? redeemTx.recipientLabel
                : ''; // Should never happen, if parsing works correctly

        const newNimBalance = nimAddressInfo.balance + (swapNimValue * (fundTx.type === 'NIM' ? -1 : 1));
        const newBtcBalance = request.bitcoinAccount.balance + (swapBtcValue * (fundTx.type === 'BTC' ? -1 : 1));

        $newNimBalance.textContent = NumberFormatting.formatNumber(Nimiq.Policy.lunasToCoins(newNimBalance));
        $newNimBalanceFiat.textContent = NumberFormatting.formatCurrency(
            Nimiq.Policy.lunasToCoins(newNimBalance) * request.nimFiatRate,
            request.fiatCurrency,
        );
        $newBtcBalance.textContent = NumberFormatting.formatNumber(BitcoinUtils.satoshisToCoins(newBtcBalance), 8);
        const newBtcBalanceFiat = BitcoinUtils.satoshisToCoins(newBtcBalance) * request.btcFiatRate;
        $newBtcBalanceFiat.textContent = NumberFormatting.formatCurrency(newBtcBalanceFiat, request.fiatCurrency);

        // Draw distribution graph

        const nimDistributionData = request.nimiqAddresses.map(addressInfo => {
            const active = swapNimAddress === addressInfo.address;
            const backgroundClass = LoginFileConfig[IqonHash.getBackgroundColorIndex(addressInfo.address)].className;
            const oldBalance = Nimiq.Policy.lunasToCoins(addressInfo.balance) * request.nimFiatRate;
            const newBalance = active
                ? Nimiq.Policy.lunasToCoins(newNimBalance) * request.nimFiatRate
                : oldBalance;

            return {
                oldBalance,
                newBalance,
                backgroundClass,
                active,
            };
        });

        const btcDistributionData = {
            oldBalance: BitcoinUtils.satoshisToCoins(request.bitcoinAccount.balance) * request.btcFiatRate,
            newBalance: newBtcBalanceFiat,
            backgroundClass: 'bitcoin',
            active: true,
        };

        const totalBalance = nimDistributionData.reduce((sum, data) => sum + data.newBalance, 0)
            + btcDistributionData.newBalance;

        /**
         * @param {{oldBalance: number, newBalance: number, backgroundClass: string, active: boolean}} data
         * @returns {HTMLDivElement}
         */
        function createBar(data) {
            const $bar = document.createElement('div');
            $bar.classList.add('bar', data.backgroundClass);
            $bar.classList.toggle('active', data.active);
            $bar.style.width = `${data.newBalance / totalBalance * 100}%`;
            if (data.active && data.newBalance > data.oldBalance) {
                const $change = document.createElement('div');
                $change.classList.add('change');
                $change.style.width = `${(data.newBalance - data.oldBalance) / data.newBalance * 100}%`;
                $bar.appendChild($change);
            }
            return $bar;
        }

        const $bars = document.createDocumentFragment();
        for (const data of nimDistributionData) {
            $bars.appendChild(createBar(data));
        }
        const $separator = document.createElement('div');
        $separator.classList.add('separator');
        $bars.appendChild($separator);
        $bars.appendChild(createBar(btcDistributionData));

        $balanceBar.appendChild($bars);

        /** @type {HTMLDivElement} */
        const $topRow = (this.$el.querySelector('.nq-notice'));
        $topRow.appendChild(
            this._makeFeeTooltip(request, fundTx.type === 'NIM'
                ? Nimiq.Policy.coinsToLunas(nimExchangeValue)
                : BitcoinUtils.coinsToSatoshis(btcExchangeValue)),
        );

        // Set up password box.
        /** @type {HTMLFormElement} */
        const $passwordBox = (document.querySelector('#password-box'));
        this._passwordBox = new PasswordBox($passwordBox, {
            hideInput: !request.keyInfo.encrypted,
            buttonI18nTag: 'passwordbox-confirm-swap',
            minLength: request.keyInfo.hasPin ? Key.PIN_LENGTH : undefined,
        });

        this._passwordBox.on(
            PasswordBox.Events.SUBMIT,
            /** @param {string} [password] */ password => {
                this._onConfirm(request, resolve, reject, password);
            },
        );
    }

    /**
     * @param {Parsed<KeyguardRequest.SignSwapRequest>} request
     * @param {number} exchangeAmount - In Luna or Satoshi, depending on which currency is funded
     * @returns {HTMLDivElement}
     */
    _makeFeeTooltip(request, exchangeAmount) {
        // eslint-disable-next-line object-curly-newline
        const {
            fund: fundTx,
            redeem: redeemTx,
            serviceFundingNetworkFee,
            serviceRedeemingNetworkFee,
            serviceExchangeFee,
        } = request;

        const $tooltip = document.createElement('div');
        $tooltip.classList.add('tooltip', 'fee-breakdown', 'bottom');
        $tooltip.tabIndex = 0; // make the tooltip focusable

        /* eslint-disable indent */
        $tooltip.innerHTML = TemplateTags.hasVars(0)`
            <div class="pill">
                <span class="fees"></span>&nbsp;<span data-i18n="sign-swap-fees">fees</span>
            </div>
            <div class="tooltip-box">
                <div class="price-breakdown">
                    <label data-i18n="sign-swap-btc-fees">BTC network fees</label>
                    <div class="btc-fiat-fee"></div>
                </div>
                <p class="explainer" data-i18n="sign-swap-btc-fees-explainer">
                    Atomic swaps require two BTC transactions.
                </p>
                <div class="price-breakdown">
                    <label data-i18n="sign-swap-nim-fees">NIM network fees</label>
                    <div class="nim-fiat-fee"></div>
                </div>
                <div class="price-breakdown">
                    <label data-i18n="sign-swap-exchange-fee">Swap fee</label>
                    <div class="exchange-fiat-fee"></div>
                </div>
                <p class="explainer">
                    <span class="exchange-percent-fee"></span>
                    <span data-i18n="sign-swap-of-exchange-value">of swap value.</span>
                </p>
                <hr>
                <div class="price-breakdown">
                    <label data-i18n="sign-swap-total-fees">Total fees</label>
                    <div class="total-fees"></div>
                </div>
            </div>
        `;
        /* eslint-enable indent */

        I18n.translateDom($tooltip);

        // All variables are in FIAT!

        const myNimFee = Nimiq.Policy.lunasToCoins(fundTx.type === 'NIM' // eslint-disable-line no-nested-ternary
            ? fundTx.transaction.fee
            : redeemTx.type === 'NIM'
                ? redeemTx.transaction.fee
                : 0) * request.nimFiatRate;

        const myBtcFee = BitcoinUtils.satoshisToCoins(fundTx.type === 'BTC' // eslint-disable-line no-nested-ternary
            ? fundTx.inputs.reduce((sum, input) => sum + input.witnessUtxo.value, 0)
                - fundTx.recipientOutput.value
                - (fundTx.changeOutput ? fundTx.changeOutput.value : 0)
            : redeemTx.type === 'BTC'
                ? redeemTx.input.witnessUtxo.value - redeemTx.output.value
                : 0) * request.btcFiatRate;

        const theirNimFee = Nimiq.Policy.lunasToCoins(fundTx.type === 'NIM'
            ? serviceFundingNetworkFee
            : serviceRedeemingNetworkFee) * request.nimFiatRate;
        const theirBtcFee = BitcoinUtils.satoshisToCoins(fundTx.type === 'BTC'
            ? serviceFundingNetworkFee
            : serviceRedeemingNetworkFee) * request.btcFiatRate;

        const theirExchangeFee = fundTx.type === 'NIM'
            ? Nimiq.Policy.lunasToCoins(serviceExchangeFee) * request.nimFiatRate
            : BitcoinUtils.satoshisToCoins(serviceExchangeFee) * request.btcFiatRate;

        const theirExchangeFeePercentage = NumberFormatting.formatNumber(
            serviceExchangeFee / (exchangeAmount - serviceExchangeFee) * 100,
            1,
        );

        /** @type {HTMLDivElement} */ ($tooltip.querySelector('.nim-fiat-fee'))
            .textContent = NumberFormatting.formatCurrency(myNimFee + theirNimFee, request.fiatCurrency);

        /** @type {HTMLDivElement} */ ($tooltip.querySelector('.btc-fiat-fee'))
            .textContent = NumberFormatting.formatCurrency(myBtcFee + theirBtcFee, request.fiatCurrency);

        /** @type {HTMLDivElement} */ ($tooltip.querySelector('.exchange-fiat-fee'))
            .textContent = NumberFormatting.formatCurrency(theirExchangeFee, request.fiatCurrency);

        /** @type {HTMLDivElement} */ ($tooltip.querySelector('.exchange-percent-fee'))
            .textContent = `${theirExchangeFeePercentage}%`;

        const totalFees = NumberFormatting.formatCurrency(
            myNimFee + myBtcFee + theirNimFee + theirBtcFee + theirExchangeFee,
            request.fiatCurrency,
        );
        /** @type {HTMLDivElement} */ ($tooltip.querySelector('.total-fees')).textContent = totalFees;
        /** @type {HTMLDivElement} */ ($tooltip.querySelector('.fees')).textContent = totalFees;

        return $tooltip;
    }

    /**
     * @param {Parsed<KeyguardRequest.SignSwapRequest>} request
     * @param {SignSwap.resolve} resolve
     * @param {reject} reject
     * @param {string} [password]
     * @returns {Promise<void>}
     * @private
     */
    async _onConfirm(request, resolve, reject, password) {
        TopLevelApi.setLoading(true);
        const passwordBuf = password ? Utf8Tools.stringToUtf8ByteArray(password) : undefined;
        /** @type {Key?} */
        let key = null;
        try {
            key = await KeyStore.instance.get(request.keyInfo.id, passwordBuf);
        } catch (e) {
            if (e.message === 'Invalid key') {
                TopLevelApi.setLoading(false);
                this._passwordBox.onPasswordIncorrect();
                return;
            }
            reject(new Errors.CoreError(e));
            return;
        }
        if (!key) {
            reject(new Errors.KeyNotFoundError());
            return;
        }

        const btcKey = new BitcoinKey(key);

        /** @type {{nim: string, btc: string[]}} */
        const privateKeys = {};

        if (request.fund.type === 'NIM') {
            const privateKey = key.derivePrivateKey(request.fund.keyPath);
            privateKeys.nim = privateKey.toHex();
        }

        if (request.fund.type === 'BTC') {
            const keyPairs = request.fund.inputs.map(input => btcKey.deriveKeyPair(input.keyPath));
            const privKeys = keyPairs.map(keyPair => /** @type {Buffer} */ (keyPair.privateKey).toString('hex'));
            privateKeys.btc = privKeys;

            if (request.fund.changeOutput) {
                // Calculate, validate and store output address
                const address = btcKey.deriveAddress(request.fund.changeOutput.keyPath);
                if (request.fund.changeOutput.address && request.fund.changeOutput.address !== address) {
                    throw new Errors.InvalidRequestError(
                        'Given address is different from derived address for change output',
                    );
                }
                request.fund.changeOutput.address = address;
            }

            // Calculate and store refund address from refundKeyPath
            request.fund.refundAddress = btcKey.deriveAddress(request.fund.refundKeyPath);
        }

        if (request.redeem.type === 'NIM') {
            const privateKey = key.derivePrivateKey(request.redeem.keyPath);
            privateKeys.nim = privateKey.toHex();
        }

        if (request.redeem.type === 'BTC') {
            const keyPairs = [btcKey.deriveKeyPair(request.redeem.input.keyPath)];
            const privKeys = keyPairs.map(keyPair => /** @type {Buffer} */ (keyPair.privateKey).toString('hex'));
            privateKeys.btc = privKeys;

            // Calculate, validate and store output address
            const address = btcKey.deriveAddress(request.redeem.output.keyPath);
            if (request.redeem.output.address && request.redeem.output.address !== address) {
                throw new Errors.InvalidRequestError(
                    'Given address is different from derived address for output',
                );
            }
            request.redeem.output.address = address;
        }

        try {
            sessionStorage.setItem(
                Constants.SWAP_IFRAME_SESSION_STORAGE_KEY_PREFIX + request.swapId,
                JSON.stringify({
                    keys: privateKeys,
                    // Serialize request to store in SessionStorage
                    request,
                }, (_, value) => {
                    if (value instanceof Nimiq.Transaction) {
                        return value.toPlain();
                    }
                    if (value instanceof Uint8Array) {
                        return Nimiq.BufferUtils.toHex(value);
                    }
                    return value;
                }),
            );
        } catch (error) {
            reject(error);
            return;
        }

        resolve({ success: true });
    }

    run() {
        // Go to start page
        window.location.hash = SignSwap.Pages.CONFIRM_SWAP;
    }
}

SignSwap.Pages = {
    CONFIRM_SWAP: 'confirm-swap',
};
