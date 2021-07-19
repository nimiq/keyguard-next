// Adapted and simplified from @nimiq/utils.
// See there for extended documentation on how the data was generated.
// This file should also be updated whenever CurrencyInfo in @nimiq/utils is updated.
class CurrencyInfo {
    /**
     * @param {string} currencyCode 3-letter currency code
     * @param {string} [locale] The locale to use for auto-detecting the name and symbol
     * @throws If currency code is not a well-formed currency code.
     */
    constructor(currencyCode, locale) {
        /** @type {string} */
        this.code = currencyCode.toUpperCase();
        /** @type {string} */
        this.symbol = '';
        /** @type {string} */
        this.name = '';
        /** @type {number} */
        this.decimals = 2;
        /** @type {string} */
        this.locale = '';

        // Get the country from the currency code which is typically (but not necessarily) the first two letters,
        // see https://en.wikipedia.org/wiki/ISO_4217#National_currencies.
        const currencyCountry = this.code.substring(0, 2);

        const nameLocalesToTry = [
            ...(locale ? [locale] : []), // try requested locale
            `${navigator.language.substring(0, 2)}-${currencyCountry}`, // user language as spoken in currency country
            navigator.language, // fallback
            'en-US', // en-US as last resort
        ];
        // also normalizes the locales
        [this.locale] = 'DisplayNames' in Intl
            // @ts-ignore TODO use proper types once https://github.com/microsoft/TypeScript/pull/44022 is available
            ? Intl.DisplayNames.supportedLocalesOf(nameLocalesToTry)
            : Intl.NumberFormat.supportedLocalesOf(nameLocalesToTry);

        const cacheKey = `${this.code} ${this.locale}`;
        const cachedCurrencyInfo = CurrencyInfo.CACHED_AUTO_GENERATED_CURRENCY_INFOS[cacheKey];
        if (cachedCurrencyInfo) {
            return cachedCurrencyInfo;
        }

        let formattedString;
        const formatterOptions = {
            style: 'currency',
            currency: currencyCode, // without toUpperCase to avoid conversion of characters, e.g. Eszett to SS
            useGrouping: false,
            numberingSystem: 'latn',
        };

        if ('DisplayNames' in Intl) {
            // Use DisplayNames if available as it provides better names.
            // @ts-ignore TODO use proper types once https://github.com/microsoft/TypeScript/pull/44022 is merged
            this.name = new Intl.DisplayNames(this.locale, { type: 'currency' }).of(currencyCode);
        } else {
            // Note that toLocaleString throws for not well-formatted currency codes
            // (see https://www.ecma-international.org/ecma-402/1.0/#sec-6.3.1).
            formattedString = (0).toLocaleString(
                this.locale,
                { currencyDisplay: 'name', ...formatterOptions },
            );
            // Using regex parsing instead of NumberFormat.formatToParts which has less browser support.
            this.name = formattedString.replace(CurrencyInfo.NUMBER_REGEX, '').trim();
        }

        const extraSymbol = CurrencyInfo.EXTRA_SYMBOLS[this.code];
        if (typeof extraSymbol === 'string') {
            this.symbol = extraSymbol;
        } else if (Array.isArray(extraSymbol)) {
            // Use right-to-left currency symbols only if a right-to-left locale was used and explicitly requested.
            const useRightToLeft = this.locale === locale
                && CurrencyInfo.RIGHT_TO_LEFT_DETECTION_REGEX.test(this.name);
            this.symbol = extraSymbol[useRightToLeft ? 1 : 0];
        } else {
            formattedString = (0).toLocaleString(
                // Unless a locale was specifically requested, use `en-${currencyCountry}` for the symbol detection
                // instead of this.locale which is based on navigator.language, as the EXTRA_SYMBOLS have been
                // created based on en.
                [
                    ...(locale ? [locale] : []), // try requested locale
                    `en-${currencyCountry}`,
                    'en',
                ],
                { currencyDisplay: 'narrowSymbol', ...formatterOptions },
            );
            this.symbol = formattedString.replace(CurrencyInfo.NUMBER_REGEX, '').trim();
        }

        if (CurrencyInfo.CUSTOM_DECIMAL_LESS_CURRENCIES.has(this.code)) {
            this.decimals = 0;
        } else {
            if (!formattedString) {
                // As we only need the number, the used locale and currencyDisplay don't matter.
                formattedString = (0).toLocaleString('en', formatterOptions);
            }
            const numberMatch = formattedString.match(CurrencyInfo.NUMBER_REGEX);
            this.decimals = numberMatch ? (numberMatch[1] || '').length : 2;
        }

        CurrencyInfo.CACHED_AUTO_GENERATED_CURRENCY_INFOS[cacheKey] = this;
    }
}

/**
 * @private
 * @readonly
 * @type {{[code: string]: string | [string, string]}}
 */
CurrencyInfo.EXTRA_SYMBOLS = {
    AED: ['DH', 'د.إ'],
    AFN: ['Afs', '؋'],
    ALL: 'L',
    ANG: 'ƒ',
    AWG: 'ƒ',
    BGN: 'лв.',
    BHD: ['BD', '.د.ب'],
    BTN: 'Nu.',
    BYN: 'Br',
    CDF: 'Fr',
    CHF: 'Fr.',
    CVE: '$',
    DJF: 'Fr',
    DZD: ['DA', 'د.ج'],
    EGP: ['£', 'ج.م'],
    ETB: 'Br',
    HTG: 'G',
    IQD: ['ID', 'ع.د'],
    IRR: ['RI', '﷼'],
    JOD: ['JD', 'د.ا'],
    KES: 'Sh',
    KGS: '\u20c0', // new unicode char to be released Sep 2021
    KWD: ['KD', 'د.ك'],
    LBP: ['LL', 'ل.ل'],
    LSL: 'M', // mismatch to Wikipedia's L because M is used for plural
    LYD: ['LD', 'ل.د'],
    MAD: ['DH', 'درهم'], // mismatch to Wikipedia as the actual wiki article shows different symbols, also in Arabic
    MDL: 'L',
    MKD: 'ден',
    MMK: 'Ks', // Ks for plural
    MRU: 'UM',
    MVR: ['Rf', '.ރ'],
    MZN: 'MT',
    NPR: 'रु', // mismatch to Wikipedia as actual wiki article shows it as रु, also in Nepali
    OMR: ['R.O.', 'ر.ع.'],
    PAB: 'B/.',
    PEN: 'S/', // mismatch to Wikipedia as actual wiki article shows it as S/, also in Spanish
    PKR: '₨',
    QAR: ['QR', 'ر.ق'],
    RSD: 'дин.',
    SAR: ['SR', '﷼'],
    SDG: ['£SD', 'ج.س.'],
    SOS: 'Sh.',
    TJS: 'SM', // mismatch to Wikipedia as actual wiki article shows it as SM
    TMT: 'm', // mismatch to Wikipedia as actual wiki article shows it as m
    TND: ['DT', 'د.ت'],
    UZS: 'сум', // mismatch to Wikipedia as actual wiki article shows it as сум
    VES: 'Bs.',
    WST: 'T',
    XPF: '₣',
    YER: ['RI', '﷼'],
};

/**
 * Some currencies have been devalued so much by inflation that their sub-units have been removed from circulation
 * or are effectively not being used anymore. This is not for all currencies reflected yet in toLocaleString, such
 * that we mark some currencies manually as decimal-less.
 * @private
 * @readonly
 * @type {Set<string>}
 */
CurrencyInfo.CUSTOM_DECIMAL_LESS_CURRENCIES = new Set([
    'AMD', // sub-unit rarely used
    'AOA', // sub-unit rarely used
    'ARS', // sub-unit discontinued
    'BDT', // sub-unit discontinued
    'BTN', // sub-unit rarely used
    'CDF', // sub-unit rarely used
    'COP', // sub-unit rarely used
    'CRC', // sub-unit discontinued
    'CVE', // sub-unit discontinued
    'CZK', // sub-unit discontinued
    'DOP', // sub-unit rarely used
    'DZD', // sub-unit discontinued
    'GMD', // sub-unit discontinued
    'GYD', // sub-unit discontinued
    'HUF', // sub-unit discontinued
    'IDR', // sub-unit discontinued
    'INR', // sub-unit discontinued
    'JMD', // sub-unit discontinued
    'KES', // sub-unit rarely used
    'KGS', // sub-unit rarely used
    'KHR', // sub-unit discontinued
    'KZT', // sub-unit rarely used
    'LKR', // sub-unit discontinued
    'MAD', // sub-unit rarely used
    'MKD', // sub-unit discontinued
    'MNT', // sub-unit discontinued
    'MOP', // sub-unit discontinued
    'MWK', // sub-unit rarely used
    'MXN', // sub-unit rarely used
    'NGN', // sub-unit rarely used
    'NOK', // sub-unit discontinued
    'NPR', // sub-unit rarely used
    'PHP', // sub-unit rarely used
    'PKR', // sub-unit discontinued
    'RUB', // sub-unit rarely used
    'SEK', // sub-unit discontinued
    'TWD', // sub-unit discontinued
    'TZS', // sub-unit discontinued
    'UAH', // sub-unit discontinued
    'UYU', // sub-unit discontinued
    'UZS', // sub-unit discontinued
    'VES', // sub-unit rarely used
]);

/**
 * Cached auto-generated CurrencyInfos such that they do not need to be recalculated.
 * @private
 * @readonly
 * @type {{[currencyAndLocale: string]: CurrencyInfo}}
 */
CurrencyInfo.CACHED_AUTO_GENERATED_CURRENCY_INFOS = {};

/**
 * Regex for detecting the number with optional decimals in a formatted string for useGrouping: false
 * @private
 * @readonly
 * @type {RegExp}
 */
CurrencyInfo.NUMBER_REGEX = /\d+(?:\D(\d+))?/;

/**
 * Regex for detecting right-to-left text.
 * Simplified and adapted from https://stackoverflow.com/a/14824756.
 * Note that this rtl detection is incomplete but good enough for our needs.
 * @private
 * @readonly
 * @type {RegExp}
 */
CurrencyInfo.RIGHT_TO_LEFT_DETECTION_REGEX = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
