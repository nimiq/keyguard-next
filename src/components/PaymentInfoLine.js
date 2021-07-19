/* global I18n */
/* global TemplateTags */
/* global NumberFormatting */
/* global FiatApi */
/* global AddressInfo */
/* global Timer */

/** @typedef {{
 *      recipient: string,
 *      label?: string,
 *      imageUrl?: URL,
 *      amount: number,
 *      currency: 'nim' | 'btc',
 *      unitsToCoins: (units: number) => number,
 *      networkFee: number,
 *      fiatAmount?: number,
 *      fiatCurrency?: string,
 *      vendorMarkup?: number,
 *      time?: number,
 *      expires?: number
 *  }} PaymentInfo */

class PaymentInfoLine { // eslint-disable-line no-unused-vars
    /**
     * @param {PaymentInfo} paymentInfo
     * @param {HTMLElement} [$el]
     */
    constructor(paymentInfo, $el) {
        this.paymentInfo = paymentInfo;
        this.$el = PaymentInfoLine._createElement($el);

        /** @type HTMLElement */
        const $amount = (this.$el.querySelector('.amount'));
        const amount = NumberFormatting.formatNumber(
            paymentInfo.unitsToCoins(paymentInfo.amount),
            paymentInfo.currency === 'nim' ? 4 : 7,
        );
        $amount.textContent = `${amount} ${paymentInfo.currency.toUpperCase()}`;

        this._createPriceTooltip(/** @type {HTMLElement} */ (this.$el.querySelector('.amounts')));

        const recipientInfo = new AddressInfo({
            userFriendlyAddress: paymentInfo.recipient,
            label: paymentInfo.label || null,
            imageUrl: paymentInfo.imageUrl || null,
            accountLabel: null,
        });
        recipientInfo.renderTo(/** @type HTMLElement */ (this.$el.querySelector('.recipient')));

        /** @type HTMLElement */
        const $timer = (this.$el.querySelector('.timer'));
        if (paymentInfo.time && paymentInfo.expires) {
            new Timer(paymentInfo.time, paymentInfo.expires, $timer); // eslint-disable-line no-new
        } else {
            $timer.remove();
        }
    }

    /**
     * @private
     * @param {HTMLElement} [$el]
     * @returns {HTMLElement}
     */
    static _createElement($el) {
        $el = $el || document.createElement('div');
        $el.classList.add('payment-info-line');

        $el.innerHTML = TemplateTags.noVars`
            <div class="amounts">
                <div class="amount"></div>
            </div>
            <div class="arrow-runway">
                <svg class="nq-icon">
                    <use xlink:href="../../../node_modules/@nimiq/style/nimiq-style.icons.svg#nq-arrow-right-small"/>
                </svg>
            </div>
            <div class="recipient"></div>
            <div class="timer"></div>
        `;

        return $el;
    }

    /**
     * @protected
     * @param {HTMLElement} $container
     */
    _createPriceTooltip($container) {
        // eslint-disable-next-line object-curly-newline
        const { fiatAmount, fiatCurrency, vendorMarkup, amount, networkFee } = this.paymentInfo;
        if (!fiatAmount || !fiatCurrency) return;

        const $tooltip = document.createElement('div');
        $tooltip.classList.add('price-tooltip', 'tooltip');
        $tooltip.tabIndex = 0; // make the tooltip focusable

        /* eslint-disable indent */
        $tooltip.innerHTML = TemplateTags.hasVars(1)`
            <svg class="warning-triangle nq-icon">
                <use xlink:href="../../../node_modules/@nimiq/style/nimiq-style.icons.svg#nq-alert-triangle"/>
            </svg>
            <span class="fiat-amount"></span>
            <div class="tooltip-box">
                <div class="price-breakdown">
                    <label data-i18n="payment-info-line-order-amount">Order amount</label>
                    <div class="fiat-amount"></div>
                    <template class="vendor-markup-template">
                        ${!vendorMarkup || vendorMarkup >= 0
                            ? '<label data-i18n="payment-info-line-vendor-markup">Vendor crypto markup</label>'
                            : '<label data-i18n="payment-info-line-vendor-discount">Vendor crypto discount</label>'
                        }
                        <div class="vendor-markup"></div>
                    </template>
                    <label class="highlight-on-bad-rate" data-i18n="payment-info-line-effective-rate">
                        Effective rate
                    </label>
                    <div class="effective-rate highlight-on-bad-rate"></div>
                </div>
                <div class="rate-info info highlight-on-bad-rate"></div>
                <div class="free-service-info info" data-i18n="payment-info-line-free-service">
                    Nimiq provides this service free of charge.
                </div>
                <hr>
                <div class="price-breakdown">
                    <label data-i18n="payment-info-line-total">Total</label>
                    <div class="total"></div>
                </div>
                <div class="network-fee-info info">
                    + <span class="network-fee"></span>
                    <span data-i18n="payment-info-line-network-fee">network fee</span>
                </div>
            </div>
        `;
        /* eslint-enable indent */

        I18n.translateDom($tooltip);

        const formattedFiatAmount = NumberFormatting.formatCurrency(fiatAmount, fiatCurrency);
        $tooltip.querySelectorAll('.fiat-amount').forEach($fiatAmount => {
            $fiatAmount.textContent = formattedFiatAmount;
        });

        /** @type {HTMLTemplateElement} */
        const $vendorMarkupTemplate = ($tooltip.querySelector('.vendor-markup-template'));
        if (vendorMarkup !== undefined) {
            // Convert to percent and round to two decimals. Always ceil to avoid displaying a lower fee than charged or
            // larger discount than applied. Subtract small epsilon to avoid that numbers get rounded up as a result of
            // floating point imprecision after multiplication. Otherwise formatting for example .07 results in 7.01%.
            const vendorMarkupPercent = Math.ceil(vendorMarkup * 100 * 100 - 1e-10) / 100;
            $vendorMarkupTemplate.replaceWith($vendorMarkupTemplate.content);
            /** @type {HTMLElement} */
            const $vendorMarkup = ($tooltip.querySelector('.vendor-markup'));
            $vendorMarkup.textContent = `${vendorMarkup >= 0 ? '+' : ''}${vendorMarkupPercent}%`;
        } else {
            $vendorMarkupTemplate.remove();
        }

        const ticker = this.paymentInfo.currency.toUpperCase();

        /** @type {HTMLElement} */
        const $effectiveRate = ($tooltip.querySelector('.effective-rate'));
        // Fiat/crypto rate. Higher fiat/crypto rate means user is paying less crypto for the requested fiat amount
        // and is therefore better for the user. Note: precision loss should be acceptable here.
        const effectiveRate = fiatAmount / this.paymentInfo.unitsToCoins(amount);
        $effectiveRate.textContent = `${NumberFormatting.formatCurrency(
            effectiveRate,
            fiatCurrency,
            0.0001,
        )} / ${ticker}`;

        /** @type {HTMLElement} */
        const $total = ($tooltip.querySelector('.total'));
        $total.textContent = `${NumberFormatting.formatNumber(this.paymentInfo.unitsToCoins(amount))} ${ticker}`;

        // Note that in the Keyguard the fee is never undefined.
        if (networkFee !== 0) {
            /** @type {HTMLElement} */
            const $networkFee = ($tooltip.querySelector('.network-fee'));
            $networkFee.textContent = `${NumberFormatting.formatNumber(
                this.paymentInfo.unitsToCoins(networkFee),
            )} ${ticker}`;
        } else {
            /** @type {HTMLElement} */
            const $networkFeeInfo = ($tooltip.querySelector('.network-fee-info'));
            $networkFeeInfo.remove();
        }

        /** @type {HTMLElement} */
        const $rateInfo = ($tooltip.querySelector('.rate-info'));
        const updateRateComparison = this._updateRateComparison.bind(this, effectiveRate, $tooltip, $rateInfo);
        updateRateComparison();
        window.setInterval(updateRateComparison, PaymentInfoLine.REFERENCE_RATE_UPDATE_INTERVAL);
        I18n.observer.on(I18n.Events.LANGUAGE_CHANGED, updateRateComparison);

        $container.appendChild($tooltip);
    }

    /**
     * @protected
     * @param {number} effectiveRate
     * @param {HTMLElement} $tooltip
     * @param {HTMLElement} $rateInfo
     */
    async _updateRateComparison(effectiveRate, $tooltip, $rateInfo) {
        if (!this.paymentInfo.fiatCurrency) return;
        /** @type {FiatApi.SupportedFiatCurrency} */
        const fiatCurrency = (this.paymentInfo.fiatCurrency.toLowerCase());
        if (!Object.values(FiatApi.SupportedFiatCurrency).includes(fiatCurrency)) return;

        let referenceRate;
        try {
            /* eslint-disable object-curly-spacing */
            const {[this.paymentInfo.currency]: currencyRecord} = await FiatApi.getExchangeRates(
                [this.paymentInfo.currency],
                [fiatCurrency],
            );
            if (!currencyRecord) return;
            ({[fiatCurrency]: referenceRate} = currencyRecord);
            /* eslint-enable object-curly-spacing */
            if (typeof referenceRate !== 'number') return;
        } catch (e) {
            return;
        }

        // Compare rates. Convert them from fiat/crypto to crypto/fiat as the user will be paying crypto in the end
        // and the flipped rates can therefore be compared more intuitively. Negative rate deviation is better for
        // the user.
        const flippedEffectiveRate = 1 / effectiveRate;
        const flippedReferenceRate = 1 / referenceRate;
        const rateDeviation = (flippedEffectiveRate - flippedReferenceRate) / flippedReferenceRate;

        const isBadRate = rateDeviation >= PaymentInfoLine.RATE_DEVIATION_THRESHOLD
            || (!!this.paymentInfo.vendorMarkup
                && this.paymentInfo.vendorMarkup < 0 // verify promised discount
                && rateDeviation >= this.paymentInfo.vendorMarkup + PaymentInfoLine.RATE_DEVIATION_THRESHOLD
            );
        $tooltip.classList.toggle('bad-rate', isBadRate);

        if (isBadRate || Math.abs(rateDeviation) >= PaymentInfoLine.RATE_DEVIATION_THRESHOLD) {
            let rateInfo;
            if (rateDeviation < 0 && isBadRate) {
                // False discount
                rateInfo = I18n.translatePhrase('payment-info-line-actual-discount');
            } else if (rateDeviation >= 0) {
                rateInfo = I18n.translatePhrase('payment-info-line-paying-more');
            } else {
                rateInfo = I18n.translatePhrase('payment-info-line-paying-less');
            }

            // Converted to absolute percent, rounded to one decimal
            const formattedRateDeviation = `${Math.round(Math.abs(rateDeviation) * 100 * 10) / 10}%`;
            $rateInfo.textContent = rateInfo.replace('%RATE_DEVIATION%', formattedRateDeviation);

            $rateInfo.style.display = 'block';
        } else {
            $rateInfo.style.display = 'none';
        }
    }
}

PaymentInfoLine.RATE_DEVIATION_THRESHOLD = 0.1;
PaymentInfoLine.REFERENCE_RATE_UPDATE_INTERVAL = 30000;
