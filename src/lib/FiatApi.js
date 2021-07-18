// Adapted and reduced version of FiatApi.ts from @nimiq/utils
// This file should also be updated whenever FiatApi.ts in @nimiq/utils is updated.
class FiatApi {
    // eslint-disable-next-line valid-jsdoc
    /**
     * @param {Array<FiatApi.SupportedCryptoCurrency>} cryptoCurrencies
     * @param {Array<FiatApi.SupportedFiatCurrency>} vsCurrencies
     * @returns {Promise<Partial<Record<
     *     FiatApi.SupportedCryptoCurrency,
     *     Partial<Record<FiatApi.SupportedFiatCurrency, number>>,
     * >>>}
     */
    static async getExchangeRates(cryptoCurrencies, vsCurrencies) {
        const coinIds = cryptoCurrencies.map(currency => FiatApi.COINGECKO_COIN_IDS[currency]);
        const response = await fetch(
            `${FiatApi.API_URL}/simple/price?ids=${coinIds.join(',')}&vs_currencies=${vsCurrencies.join(',')}`,
        );
        if (!response.ok) throw new Error(`Failed to fetch exchange rates: ${response.status}`);
        const apiResult = await response.json();
        // Map coingecko coin ids back to SupportedCryptoCurrency enum and sanitize retrieved data.
        return cryptoCurrencies.reduce((result, cryptoCurrency) => {
            const record = apiResult[FiatApi.COINGECKO_COIN_IDS[cryptoCurrency]];
            const sanitizedRecord = Object.keys(record).reduce((sanitized, fiatCurrency) => ({
                ...sanitized,
                ...(Object.values(FiatApi.SupportedFiatCurrency).includes(/** @type {any} */ (fiatCurrency))
                    ? { [fiatCurrency]: parseFloat(record[fiatCurrency]) }
                    : null
                ),
            }), {});
            return {
                ...result,
                [cryptoCurrency]: sanitizedRecord,
            };
        }, {});
    }
}

/**
 * @readonly
 * @enum { 'nim' | 'btc' }
 * Crypto currencies supported by the coingecko api that are currently of interest for us.
 */
FiatApi.SupportedCryptoCurrency = {
    NIM: /** @type {'nim'} */ ('nim'),
    BTC: /** @type {'btc'} */ ('btc'),
};

/**
 * @readonly
 * @enum {'aed' | 'ars' | 'aud' | 'bdt' | 'bhd' | 'bmd' | 'brl' | 'cad' | 'chf' | 'clp' | 'cny' | 'czk' | 'dkk' | 'eur'
 *     | 'gbp' | 'hkd' | 'huf' | 'idr' | 'ils' | 'inr' | 'jpy' | 'krw' | 'kwd' | 'lkr' | 'mmk' | 'mxn' | 'myr' | 'nok'
 *     | 'ngn' | 'nzd' | 'php' | 'pkr' | 'pln' | 'rub' | 'sar' | 'sek' | 'sgd' | 'thb' | 'try' | 'twd' | 'uah' | 'usd'
 *     | 'vnd' | 'zar'}
 * Fiat currencies supported by the coingecko api. Note that coingecko supports more vs_currencies (see
 * https://api.coingecko.com/api/v3/simple/supported_vs_currencies) but also includes crypto currencies and ounces of
 * gold amongst others that are not fiat currencies. See FiatApi in @nimiq/utils for how this list was assembled.
 */
FiatApi.SupportedFiatCurrency = {
    AED: /** @type {'aed'} */ ('aed'), // Arab Emirates Dirham
    ARS: /** @type {'ars'} */ ('ars'), // Argentine Peso
    AUD: /** @type {'aud'} */ ('aud'), // Australian Dollar
    BDT: /** @type {'bdt'} */ ('bdt'), // Bangladeshi Taka
    BHD: /** @type {'bhd'} */ ('bhd'), // Bahraini Dinar
    BMD: /** @type {'bmd'} */ ('bmd'), // Bermudan Dollar
    BRL: /** @type {'brl'} */ ('brl'), // Brazilian Real
    CAD: /** @type {'cad'} */ ('cad'), // Canadian Dollar
    CHF: /** @type {'chf'} */ ('chf'), // Swiss Franc
    CLP: /** @type {'clp'} */ ('clp'), // Chilean Peso
    CNY: /** @type {'cny'} */ ('cny'), // Chinese Yuan
    CZK: /** @type {'czk'} */ ('czk'), // Czech Koruna
    DKK: /** @type {'dkk'} */ ('dkk'), // Danish Krone
    EUR: /** @type {'eur'} */ ('eur'), // Euro
    GBP: /** @type {'gbp'} */ ('gbp'), // British Pound
    HKD: /** @type {'hkd'} */ ('hkd'), // Hong Kong Dollar
    HUF: /** @type {'huf'} */ ('huf'), // Hungarian Forint
    IDR: /** @type {'idr'} */ ('idr'), // Indonesian Rupiah
    ILS: /** @type {'ils'} */ ('ils'), // Israeli New Shekel
    INR: /** @type {'inr'} */ ('inr'), // Indian Rupee
    JPY: /** @type {'jpy'} */ ('jpy'), // Japanese Yen
    KRW: /** @type {'krw'} */ ('krw'), // South Korean Won
    KWD: /** @type {'kwd'} */ ('kwd'), // Kuwaiti Dinar
    LKR: /** @type {'lkr'} */ ('lkr'), // Sri Lankan Rupee
    MMK: /** @type {'mmk'} */ ('mmk'), // Burmese Kyat
    MXN: /** @type {'mxn'} */ ('mxn'), // Mexican Peso
    MYR: /** @type {'myr'} */ ('myr'), // Malaysian Ringgit
    NOK: /** @type {'nok'} */ ('nok'), // Norwegian Krone
    NGN: /** @type {'ngn'} */ ('ngn'), // Nigerian Naira
    NZD: /** @type {'nzd'} */ ('nzd'), // New Zealand Dollar
    PHP: /** @type {'php'} */ ('php'), // Philippine Peso
    PKR: /** @type {'pkr'} */ ('pkr'), // Pakistani Rupee
    PLN: /** @type {'pln'} */ ('pln'), // Poland Złoty
    RUB: /** @type {'rub'} */ ('rub'), // Russian Ruble
    SAR: /** @type {'sar'} */ ('sar'), // Saudi Riyal
    SEK: /** @type {'sek'} */ ('sek'), // Swedish Krona
    SGD: /** @type {'sgd'} */ ('sgd'), // Singapore Dollar
    THB: /** @type {'thb'} */ ('thb'), // Thai Baht
    TRY: /** @type {'try'} */ ('try'), // Turkish Lira
    TWD: /** @type {'twd'} */ ('twd'), // New Taiwan Dollar
    UAH: /** @type {'uah'} */ ('uah'), // Ukrainian Hryvnia
    USD: /** @type {'usd'} */ ('usd'), // United States Dollar
    // VEF: /** @type {'vef'} */ ('vef'), // Discontinued Venezuelan Bolívar Fuerte replaced by VES. Rates are off.
    VND: /** @type {'vnd'} */ ('vnd'), // Vietnamese Đồng
    ZAR: /** @type {'zar'} */ ('zar'), // South African Rand
};

/**
 * @readonly
 * Coingecko api url. Note that the origin must be whitelisted in the csp.
 */
FiatApi.API_URL = 'https://api.coingecko.com/api/v3';

/**
 * @readonly
 * Crypto currency tickers mapped to coingecko coin ids.
 */
FiatApi.COINGECKO_COIN_IDS = {
    [FiatApi.SupportedCryptoCurrency.NIM]: 'nimiq-2',
    [FiatApi.SupportedCryptoCurrency.BTC]: 'bitcoin',
};
