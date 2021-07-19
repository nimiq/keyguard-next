/* global BitcoinRequestParserMixin */
/* global TopLevelApi */
/* global ImportFile */
/* global ImportWords */
/* global Errors */

class ImportApi extends BitcoinRequestParserMixin(TopLevelApi) {
    /**
     * @param {KeyguardRequest.ImportRequest | KeyguardRequest.ResetPasswordRequest} request
     * @returns {Promise<Parsed<KeyguardRequest.ImportRequest | KeyguardRequest.ResetPasswordRequest>>}
     */
    async parseRequest(request) {
        if (!request) {
            throw new Errors.InvalidRequestError('request is required');
        }

        const parsedRequest = {};
        parsedRequest.appName = this.parseAppName(request.appName);
        parsedRequest.requestedKeyPaths = this.parsePathsArray(request.requestedKeyPaths, 'requestedKeyPaths');
        parsedRequest.isKeyLost = this.parseBoolean(request.isKeyLost);
        parsedRequest.enableBackArrow = this.parseBoolean(request.enableBackArrow);
        parsedRequest.wordsOnly = this.parseBoolean(request.wordsOnly);
        if ('expectedKeyId' in request) {
            parsedRequest.expectedKeyId = (await this.parseKeyId(request.expectedKeyId)).id;
        }
        parsedRequest.bitcoinXPubPath = this.parseBitcoinPath(request.bitcoinXPubPath, 'bitcoinXPubPath');

        this._handler = parsedRequest.wordsOnly ? ImportWords : ImportFile;

        return parsedRequest;
    }

    get Handler() {
        return this._handler;
    }
}

ImportApi.SESSION_STORAGE_KEY_PREFIX = 'nimiq_key_';
