/* global BitcoinRequestParserMixin */
/* global TopLevelApi */
/* global Nimiq */
/* global SignSwap */
/* global Errors */

class SignSwapApi extends BitcoinRequestParserMixin(TopLevelApi) { // eslint-disable-line no-unused-vars
    /**
     * @param {KeyguardRequest.SignSwapRequest} request
     * @returns {Promise<Parsed<KeyguardRequest.SignSwapRequest>>}
     */
    async parseRequest(request) {
        if (!request) {
            throw new Errors.InvalidRequestError('request is required');
        }

        try {
            sessionStorage.setItem('_test', 'write-access');
            const stored = sessionStorage.getItem('_test');
            if (stored !== 'write-access') throw new Error();
            sessionStorage.removeItem('_test');
        } catch (e) {
            throw new Error('Cannot access browser storage because of privacy settings');
        }

        /** @type {Parsed<KeyguardRequest.SignSwapRequest>} */
        const parsedRequest = {};
        parsedRequest.appName = this.parseAppName(request.appName);
        parsedRequest.keyInfo = await this.parseKeyId(request.keyId);
        if (parsedRequest.keyInfo.type !== Nimiq.Secret.Type.ENTROPY) {
            throw new Errors.InvalidRequestError('Bitcoin is only supported with modern accounts.');
        }
        parsedRequest.keyLabel = this.parseLabel(request.keyLabel, true, 'keyLabel');

        parsedRequest.swapId = /** @type {string} */ (this.parseLabel(request.swapId, false, 'swapId'));

        if (request.fund.type === request.redeem.type) {
            throw new Errors.InvalidRequestError('Swap must be between two different currencies');
        }

        if (request.fund.type === 'NIM') {
            parsedRequest.fund = {
                type: 'NIM',
                keyPath: this.parsePath(request.fund.keyPath, 'fund.keyPath'),
                transaction: this.parseTransaction({
                    data: new Uint8Array(78), // Dummy, required for CONTRACT_CREATION flag
                    ...request.fund,
                    // Enforced properties
                    recipient: 'CONTRACT_CREATION',
                    recipientType: Nimiq.Account.Type.HTLC,
                    flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
                }),
                /** @type {string} */
                senderLabel: (this.parseLabel(request.fund.senderLabel, false, 'fund.senderLabel')),
            };
        } else if (request.fund.type === 'BTC') {
            parsedRequest.fund = {
                type: 'BTC',
                inputs: this.parseInputs(request.fund.inputs),
                recipientOutput: {
                    value: this.parsePositiveInteger(
                        request.fund.recipientOutput.value,
                        false,
                        'fund.recipientOutput.value',
                    ),
                },
                changeOutput: this.parseChangeOutput(request.fund.changeOutput, true, 'fund.changeOutput'),
                refundKeyPath: this.parseBitcoinPath(request.fund.refundKeyPath, 'fund.refundKeyPath'),
                refundAddress: '', // Will be filled out after password entry
            };
        } else {
            throw new Errors.InvalidRequestError('Invalid funding type');
        }

        if (request.redeem.type === 'NIM') {
            parsedRequest.redeem = {
                type: 'NIM',
                keyPath: this.parsePath(request.redeem.keyPath, 'redeem.keyPath'),
                transaction: this.parseTransaction({
                    sender: Nimiq.Address.NULL.toUserFriendlyAddress(), // Dummy
                    ...request.redeem,
                    // Enforced properties
                    senderType: Nimiq.Account.Type.HTLC,
                    recipientType: Nimiq.Account.Type.BASIC,
                    flags: Nimiq.Transaction.Flag.NONE,
                }),
                /** @type {string} */
                recipientLabel: (this.parseLabel(request.redeem.recipientLabel, false, 'recipientLabel')),
            };
        } else if (request.redeem.type === 'BTC') {
            parsedRequest.redeem = {
                type: 'BTC',
                input: {
                    witnessUtxo: {
                        value: this.parsePositiveInteger(request.redeem.input.value, false, 'redeem.input.value'),
                    },
                    keyPath: this.parseBitcoinPath(request.redeem.input.keyPath, 'redeem.input.keyPath'),
                },
                /** @type {KeyguardRequest.BitcoinTransactionChangeOutput} */
                output: (this.parseChangeOutput(request.redeem.output, false, 'redeem.output')),
            };
        } else {
            throw new Errors.InvalidRequestError('Invalid redeeming type');
        }

        // Parse display data
        parsedRequest.fiatCurrency = /** @type {string} */ (this.parseFiatCurrency(request.fiatCurrency, false));
        parsedRequest.nimFiatRate = /** @type {number} */ (
            this.parseNonNegativeFiniteNumber(request.nimFiatRate, false, 'nimFiatRate'));
        parsedRequest.btcFiatRate = /** @type {number} */ (
            this.parseNonNegativeFiniteNumber(request.btcFiatRate, false, 'btcFiatRate'));
        parsedRequest.serviceFundingNetworkFee = /** @type {number} */ (
            this.parsePositiveInteger(request.serviceFundingNetworkFee, true, 'serviceFundingNetworkFee'));
        parsedRequest.serviceRedeemingNetworkFee = /** @type {number} */ (
            this.parsePositiveInteger(request.serviceRedeemingNetworkFee, true, 'serviceRedeemingNetworkFee'));
        parsedRequest.serviceExchangeFee = /** @type {number} */ (
            this.parsePositiveInteger(request.serviceExchangeFee, true, 'serviceExchangeFee'));

        parsedRequest.nimiqAddresses = request.nimiqAddresses.map((address, index) => ({
            address: this.parseAddress(address.address, `nimiqAddresses[${index}].address`).toUserFriendlyAddress(),
            balance: this.parsePositiveInteger(address.balance, true, `nimiqAddresses[${index}].balance`),
        }));
        parsedRequest.bitcoinAccount = {
            balance: this.parsePositiveInteger(request.bitcoinAccount.balance, true, 'bitcoinAccount.balance'),
        };

        const nimAddress = parsedRequest.fund.type === 'NIM' // eslint-disable-line no-nested-ternary
            ? parsedRequest.fund.transaction.sender.toUserFriendlyAddress()
            : parsedRequest.redeem.type === 'NIM'
                ? parsedRequest.redeem.transaction.recipient.toUserFriendlyAddress()
                : ''; // Should never happen, if parsing works correctly
        const activeNimiqAddress = parsedRequest.nimiqAddresses.find(addressInfo => addressInfo.address === nimAddress);
        if (!activeNimiqAddress) {
            throw new Errors.InvalidRequestError(
                'The address details of the NIM address doing the swap must be provided',
            );
        }
        if (
            parsedRequest.fund.type === 'NIM'
            && activeNimiqAddress.balance < (parsedRequest.fund.transaction.value + parsedRequest.fund.transaction.fee)
        ) {
            throw new Errors.InvalidRequestError('The sending NIM address does not have enough balance');
        }

        return parsedRequest;
    }

    get Handler() {
        return SignSwap;
    }
}
