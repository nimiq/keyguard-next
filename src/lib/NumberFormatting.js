/* global I18n */
/* global CurrencyInfo */

class NumberFormatting { // eslint-disable-line no-unused-vars
    /**
     * @param {number} value
     * @param {number} [maxDecimals]
     * @param {number} [minDecimals]
     * @returns {string}
     */
    static formatNumber(value, maxDecimals = 5, minDecimals = 0) {
        const roundingFactor = 10 ** maxDecimals;
        value = Math.round(value * roundingFactor) / roundingFactor;

        const result = parseFloat(value.toFixed(minDecimals)) === value
            ? value.toFixed(minDecimals)
            : value.toString();

        if (Math.abs(value) < 10000) return result;

        // Add thin spaces (U+202F) every 3 digits. Stop at the decimal separator if there is one.
        const regexp = result.includes('.') ? /(\d)(?=(\d{3})+\.)/g : /(\d)(?=(\d{3})+$)/g;
        return result.replace(regexp, '$1\u202F');
    }

    /**
     * @param {number} value
     * @param {string} currency
     * @param {number} [maxRelativeDeviation = .1]
     * @param {string} [locale = I18n.language]
     * @returns {string}
     */
    static formatCurrency(value, currency, maxRelativeDeviation = 0.1, locale = I18n.language) {
        const positioningLocale = this._getPositioningLocale(currency);
        const currencyInfo = new CurrencyInfo(currency, locale);
        const formattingOptions = {
            style: 'currency',
            currency,
            currencyDisplay: 'code', // will later be replaced by the optimized currency symbol provided by CurrencyInfo
            useGrouping: false,
            numberingSystem: 'latn',
            // start with decimal count typical for this currency, e.g. 2 for eur
            minimumFractionDigits: currencyInfo.decimals,
            maximumFractionDigits: currencyInfo.decimals,
        };
        let formatted;
        let integers;
        let relativeDeviation;

        do {
            // formatted = value.toLocaleString([localeWithLatinNumbers, 'en-US'], formattingOptions)
            formatted = value.toLocaleString([
                positioningLocale,
                locale,
                `${navigator.language.substring(0, 2)}-${positioningLocale}`,
                navigator.language,
                `en-${positioningLocale}`,
                'en',
            ], formattingOptions)
                // Enforce a dot as decimal separator for consistency and parseFloat. Using capturing groups instead of
                // lookahead/lookbehind to avoid browser support limitations.
                .replace(/(\d)\D(\d)/, '$1.$2');
            const partsMatch = formatted.match(/(-)?\D*(\d+)(\.\d+)?/);
            if (!partsMatch) return formatted; // should never happen
            const [/* full match */, sign, /* integers */, decimalsIncludingSeparator] = partsMatch;
            integers = partsMatch[2];
            const formattedNumber = `${sign || ''}${integers}${decimalsIncludingSeparator || ''}`;
            relativeDeviation = Math.abs((value - Number.parseFloat(formattedNumber)) / value);

            formattingOptions.minimumFractionDigits += 1;
            formattingOptions.maximumFractionDigits += 1;
        } while (relativeDeviation > maxRelativeDeviation
            && formattingOptions.minimumFractionDigits <= 20 // max for minimumFractionDigits and maximumFractionDigits
        );

        // Replace the currency code with our custom currency symbol.
        formatted = formatted.replace(/[A-Z]{3}\s?/i, (match, position) => {
            if (position !== 0 || !/[A-Z.]$/i.test(currencyInfo.symbol)) {
                // For trailing currency symbol or currency symbol that does not end with a latin letter or dot do not
                // append a space, e.g.: 1.00 € (EUR), $1.00 (USD), R$1.00 (BRL), ₼1.00 (AZN), ৳1 (BDT), S/1.00 (PEN)
                return currencyInfo.symbol;
            }
            // For leading currency symbol that ends with a latin letter or dot, add a (non-breaking) space, e.g.
            // KM 1.00 (BAM), B/. 1.00 (PAB), лв. 1.00 (BGN), kr 1.00 (DKK)
            return `${currencyInfo.symbol}\u00A0`;
        });

        // apply integer grouping
        if (integers.length <= 4) return formatted;
        return formatted.replace(integers, NumberFormatting.formatNumber(parseInt(integers, 10)));
    }

    /**
     * @private
     * @param {string} currency
     * @returns {string}
     */
    static _getPositioningLocale(currency) {
        // Try to guess a locale which positions the currency symbol in a way typical for countries, where the currency
        // is used, e.g. 1.00€ for eur; $1.00 for usd.
        currency = currency.toLowerCase();
        switch (currency) {
            case 'eur':
            case 'chf':
                return 'de';
            case 'gbp':
            case 'usd':
                return 'en';
            case 'cny':
                return 'zh';
            default:
                // Return the country from the currency code which is typically (but not necessarily) the first two
                // letters (see https://en.wikipedia.org/wiki/ISO_4217#National_currencies), in the hope that it
                // coincides with a locale.
                // TODO oftentimes this results in the wrong locale, e.g. ARS (Argentinan Peso) -> AR (Arabic),
                //  CAD (Canadian Dollar) -> CA (Catalan). Can we come up with a better heuristic?
                return currency.substr(0, 2);
        }
    }
}
