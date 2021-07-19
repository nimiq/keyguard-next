/* global BitcoinRequestParserMixin */
/* global TopLevelApi */
/* global Nimiq */
/* global I18n */
/* global SignBtcTransaction */
/* global Errors */

class SignBtcTransactionApi extends BitcoinRequestParserMixin(TopLevelApi) {
    /**
     * @param {KeyguardRequest.SignBtcTransactionRequest} request
     * @returns {Promise<Parsed<KeyguardRequest.SignBtcTransactionRequest>>}
     */
    async parseRequest(request) {
        if (!request) {
            throw new Errors.InvalidRequestError('request is required');
        }

        /** @type {Parsed<KeyguardRequest.SignBtcTransactionRequest>} */
        const parsedRequest = {};
        parsedRequest.appName = this.parseAppName(request.appName);
        parsedRequest.keyInfo = await this.parseKeyId(request.keyId);
        if (parsedRequest.keyInfo.type !== Nimiq.Secret.Type.ENTROPY) {
            throw new Errors.InvalidRequestError('Bitcoin is only supported with modern accounts.');
        }
        parsedRequest.keyLabel = this.parseLabel(request.keyLabel);
        parsedRequest.inputs = this.parseInputs(request.inputs);
        parsedRequest.recipientOutput = /** @type {KeyguardRequest.BitcoinTransactionOutput} */ (
            this.parseOutput(request.recipientOutput, false, 'recipientOutput'));
        parsedRequest.changeOutput = this.parseChangeOutput(request.changeOutput, true, 'changeOutput');
        parsedRequest.layout = this.parseLayout(request.layout);
        if (request.layout === SignBtcTransactionApi.Layouts.CHECKOUT
            && parsedRequest.layout === SignBtcTransactionApi.Layouts.CHECKOUT) {
            parsedRequest.shopOrigin = this.parseShopOrigin(request.shopOrigin);
            parsedRequest.shopLogoUrl = this.parseShopLogoUrl(request.shopLogoUrl);
            if (parsedRequest.shopLogoUrl && parsedRequest.shopLogoUrl.origin !== parsedRequest.shopOrigin) {
                throw new Errors.InvalidRequestError('origin of shopLogoUrl must be same as shopOrigin');
            }

            parsedRequest.fiatAmount = this.parseNonNegativeFiniteNumber(request.fiatAmount);
            parsedRequest.fiatCurrency = this.parseFiatCurrency(request.fiatCurrency);
            if ((parsedRequest.fiatAmount === undefined) !== (parsedRequest.fiatCurrency === undefined)) {
                throw new Errors.InvalidRequestError('fiatAmount and fiatCurrency must be both defined or undefined.');
            }

            parsedRequest.vendorMarkup = this.parseVendorMarkup(request.vendorMarkup);

            parsedRequest.time = this.parseNonNegativeFiniteNumber(request.time);
            parsedRequest.expires = this.parseNonNegativeFiniteNumber(request.expires);
            if (parsedRequest.expires !== undefined) {
                if (parsedRequest.time === undefined) {
                    throw new Errors.InvalidRequestError('If `expires` is given, `time` must be given too.');
                } else if (parsedRequest.time >= parsedRequest.expires) {
                    throw new Errors.InvalidRequestError('`expires` must be greater than `time`');
                }
            }
        }

        return parsedRequest;
    }

    /**
     * Checks that the given layout is valid
     * @param {unknown} layout
     * @returns {KeyguardRequest.SignBtcTransactionRequestLayout}
     */
    parseLayout(layout) {
        if (!layout) {
            return SignBtcTransactionApi.Layouts.STANDARD;
        }
        // @ts-ignore (Property 'values' does not exist on type 'ObjectConstructor'.)
        if (Object.values(SignBtcTransactionApi.Layouts).indexOf(layout) === -1) {
            throw new Errors.InvalidRequestError('Invalid selected layout');
        }
        return /** @type KeyguardRequest.SignBtcTransactionRequestLayout */ (layout);
    }

    get Handler() {
        return SignBtcTransaction;
    }

    /**
     * @param {Parsed<KeyguardRequest.SignBtcTransactionRequest>} parsedRequest
     */
    async onBeforeRun(parsedRequest) {
        if (parsedRequest.layout === SignBtcTransactionApi.Layouts.CHECKOUT) {
            this.enableGlobalCloseButton(I18n.translatePhrase('sign-tx-cancel-payment'));
        }
    }
}

/**
 * @enum {KeyguardRequest.SignBtcTransactionRequestLayout}
 * @readonly
 */
SignBtcTransactionApi.Layouts = {
    STANDARD: /** @type {'standard'} */ ('standard'),
    CHECKOUT: /** @type {'checkout'} */ ('checkout'),
};
