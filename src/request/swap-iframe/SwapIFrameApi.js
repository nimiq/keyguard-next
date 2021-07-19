/* global BitcoinRequestParserMixin */
/* global RequestParser */
/* global Nimiq */
/* global loadNimiq */
/* global BitcoinJS */
/* global BitcoinUtils */
/* global HtlcUtils */
/* global Errors */
/* global Constants */

class SwapIFrameApi extends BitcoinRequestParserMixin(RequestParser) { // eslint-disable-line no-unused-vars
    /**
     * @param {RpcState?} state
     * @param {KeyguardRequest.SignSwapTransactionsRequest} request
     * @returns {Promise<KeyguardRequest.SignSwapTransactionsResult>}
     */
    async signSwapTransactions(state, request) {
        const storageKey = Constants.SWAP_IFRAME_SESSION_STORAGE_KEY_PREFIX + request.swapId;

        const storedData = sessionStorage.getItem(storageKey);
        sessionStorage.removeItem(storageKey); // Delete storage

        if (!storedData) throw new Error('No swap stored in SessionStorage');

        /** @type {{keys: {nim: string, btc: string[]}, request: any}} */
        const { keys: privateKeys, request: storedRawRequest } = (JSON.parse(storedData));

        if (request.fund.type === 'NIM' || request.redeem.type === 'NIM') {
            if (!privateKeys.nim) throw new Error('No NIM key stored in SessionStorage');
            if (privateKeys.nim.length !== 64) throw new Error('Invalid NIM key stored in SessionStorage');
        }

        if (request.fund.type === 'BTC' || request.redeem.type === 'BTC') {
            if (!privateKeys.btc) throw new Error('No BTC key list stored in SessionStorage');
            if (!privateKeys.btc.length) throw new Error('No BTC keys stored in SessionStorage');
            if (privateKeys.btc.some(key => !key)) throw new Error('Empty BTC key stored in SessionStorage');
            if (privateKeys.btc.some(key => key.length !== 64)) {
                throw new Error('Invalid BTC key stored in SessionStorage');
            }
        }

        // Deserialize stored request
        if (storedRawRequest.fund.type === 'NIM') {
            storedRawRequest.fund.transaction = Nimiq.Transaction.fromPlain(storedRawRequest.fund.transaction);
        }
        if (storedRawRequest.redeem.type === 'NIM') {
            storedRawRequest.redeem.transaction = Nimiq.Transaction.fromPlain(storedRawRequest.redeem.transaction);
        }
        if (storedRawRequest.fund.type === 'BTC') {
            storedRawRequest.fund.inputs.forEach(/** @param {any} input */ input => {
                input.witnessUtxo.script = BitcoinJS.Buffer.from(input.witnessUtxo.script, 'hex');
            });
        }
        /** @type {Parsed<KeyguardRequest.SignSwapRequest>} */
        const storedRequest = storedRawRequest;

        /** @type {{
            type: 'NIM',
            htlcDetails: NimHtlcContents,
            htlcData: Uint8Array,
        } | {
            type: 'BTC',
            htlcDetails: BtcHtlcContents,
            htlcScript: Uint8Array,
            htlcAddress: string,
        } | undefined } */
        let fund;

        /** @type {{
            type: 'NIM',
            htlcDetails: NimHtlcContents,
            htlcData: Uint8Array,
            htlcAddress: string,
        } | {
            type: 'BTC',
            htlcDetails: BtcHtlcContents,
            htlcScript: Uint8Array,
            transactionHash: string,
            outputIndex: number,
            outputScript: Buffer,
        } | undefined } */
        let redeem;

        // Parse request
        if (storedRequest.fund.type !== request.fund.type || storedRequest.redeem.type !== request.redeem.type) {
            throw new Errors.InvalidRequestError('Different swap assets in iframe request than in top-level request');
        }

        if (request.fund.type === 'NIM' && storedRequest.fund.type === 'NIM') {
            const htlcDetails = HtlcUtils.decodeNimHtlcData(request.fund.htlcData);

            if (htlcDetails.refundAddress !== storedRequest.fund.transaction.sender.toUserFriendlyAddress()) {
                throw new Errors.InvalidRequestError('NIM HTLC refund address must be same as sender');
            }

            // Check that validityStartHeight is before HTLC timeout
            if (storedRequest.fund.transaction.validityStartHeight >= htlcDetails.timeoutBlockHeight) {
                throw new Errors.InvalidRequestError(
                    'Fund validityStartHeight must be lower than HTLC timeout block height',
                );
            }

            fund = {
                type: 'NIM',
                htlcDetails,
                htlcData: request.fund.htlcData,
            };
        }

        if (request.redeem.type === 'NIM' && storedRequest.redeem.type === 'NIM') {
            const htlcDetails = HtlcUtils.decodeNimHtlcData(request.redeem.htlcData);

            if (htlcDetails.redeemAddress !== storedRequest.redeem.transaction.recipient.toUserFriendlyAddress()) {
                throw new Errors.InvalidRequestError('NIM HTLC redeem address must be same as recipient');
            }

            // Check that validityStartHeight is before HTLC timeout
            if (storedRequest.redeem.transaction.validityStartHeight >= htlcDetails.timeoutBlockHeight) {
                throw new Errors.InvalidRequestError(
                    'Redeem validityStartHeight must be lower than HTLC timeout block height',
                );
            }

            redeem = {
                type: 'NIM',
                htlcDetails,
                htlcData: request.redeem.htlcData,
                htlcAddress: this.parseAddress(request.redeem.htlcAddress, 'redeem.htlcAddress')
                    .toUserFriendlyAddress(),
            };
        }

        if (request.fund.type === 'BTC' && storedRequest.fund.type === 'BTC') {
            const htlcDetails = HtlcUtils.decodeBtcHtlcScript(request.fund.htlcScript);

            if (htlcDetails.refundAddress !== storedRequest.fund.refundAddress) {
                throw new Errors.InvalidRequestError(
                    'BTC HTLC refund address must be same as given in top-level request',
                );
            }

            const htlcAddress = BitcoinJS.payments.p2wsh({
                // @ts-ignore Type 'Uint8Array' is not assignable to type 'Buffer'.
                witness: [BitcoinJS.Buffer.from(request.fund.htlcScript)],
                network: BitcoinUtils.Network,
            }).address;

            if (!htlcAddress) {
                throw new Errors.InvalidRequestError('Cannot derive HTLC address from BTC HTLC script');
            }

            fund = {
                type: 'BTC',
                htlcDetails,
                htlcScript: request.fund.htlcScript,
                htlcAddress,
            };
        }

        if (request.redeem.type === 'BTC' && storedRequest.redeem.type === 'BTC') {
            const htlcDetails = HtlcUtils.decodeBtcHtlcScript(request.redeem.htlcScript);

            if (htlcDetails.redeemAddress !== storedRequest.redeem.output.address) {
                throw new Errors.InvalidRequestError('BTC HTLC redeem address must be same as recipient');
            }

            const outputScript = BitcoinJS.payments.p2wsh({
                // @ts-ignore Type 'Uint8Array' is not assignable to type 'Buffer'.
                witness: [BitcoinJS.Buffer.from(request.redeem.htlcScript)],
                network: BitcoinUtils.Network,
            }).output;

            if (!outputScript) {
                throw new Errors.InvalidRequestError('Cannot derive HTLC output script from BTC HTLC script');
            }

            redeem = {
                type: 'BTC',
                htlcDetails,
                htlcScript: request.redeem.htlcScript,
                transactionHash: Nimiq.BufferUtils.toHex(Nimiq.BufferUtils.fromAny(request.redeem.transactionHash)),
                outputIndex: this.parsePositiveInteger(request.redeem.outputIndex),
                outputScript,
            };
        }

        if (!fund || !redeem) {
            throw new Errors.InvalidRequestError('No funding or redeeming data');
        }

        /** @type {Parsed<KeyguardRequest.SignSwapTransactionsRequest>} */
        const parsedRequest = {
            swapId: request.swapId,
            fund,
            redeem,
        };

        // Verify hash is the same across HTLCs
        if (parsedRequest.fund.htlcDetails.hash !== parsedRequest.redeem.htlcDetails.hash) {
            throw new Errors.InvalidRequestError('HTLC hashes do not match');
        }

        // TODO: Validate timeouts of the two contracts
        // Currently not possible because the NIM timeout is a block height, while the BTC timeout is a timestamp.
        // And since we cannot trust the local device time to be accurate, and we don't have a reference for NIM blocks
        // and their timestamps, we cannot compare the two.
        // When it becomes possible to compare (with Nimiq 2.0 Albatross), the redeem HTLC must have a later timeout
        // than the funding HTLC.

        /** @type {KeyguardRequest.SignSwapTransactionsResult} */
        const result = {};

        if (parsedRequest.fund.type === 'NIM' && storedRequest.fund.type === 'NIM') {
            await loadNimiq();

            const privateKey = new Nimiq.PrivateKey(Nimiq.BufferUtils.fromHex(privateKeys.nim));
            const publicKey = Nimiq.PublicKey.derive(privateKey);

            const transaction = Nimiq.Transaction.fromPlain({
                ...storedRequest.fund.transaction.toPlain(),
                data: parsedRequest.fund.htlcData,
                // Must be the exact object reference, which gets lost with toPlain()
                recipient: Nimiq.Address.CONTRACT_CREATION,
            });

            const signature = Nimiq.Signature.create(privateKey, publicKey, transaction.serializeContent());

            /** @type {KeyguardRequest.SignatureResult} */
            result.nim = {
                publicKey: publicKey.serialize(),
                signature: signature.serialize(),
            };
        }

        if (parsedRequest.fund.type === 'BTC' && storedRequest.fund.type === 'BTC') {
            const inputs = storedRequest.fund.inputs;

            // Sort inputs by tx hash ASC, then index ASC
            inputs.sort((a, b) => {
                if (a.hash !== b.hash) return a.hash < b.hash ? -1 : 1;
                return a.index - b.index;
            });

            // Construct outputs
            const outputs = [{
                address: parsedRequest.fund.htlcAddress,
                value: storedRequest.fund.recipientOutput.value,
            }];

            // Add change output
            if (storedRequest.fund.changeOutput) {
                // The address is set in SignSwap after password entry.
                if (!storedRequest.fund.changeOutput.address) {
                    throw new Errors.KeyguardError('Missing address in funding change output');
                }

                outputs.push(/** @type {{address: string, value: number}} */ (storedRequest.fund.changeOutput));
            }

            // Sort outputs by value ASC, then address ASC
            outputs.sort((a, b) => (a.value - b.value) || (a.address < b.address ? -1 : 1));

            // Construct transaction
            const psbt = new BitcoinJS.Psbt({ network: BitcoinUtils.Network });

            // Add inputs
            // @ts-ignore Argument of type 'Uint8Array' is not assignable to parameter of type 'Buffer'.
            psbt.addInputs(inputs);
            // Add outputs
            psbt.addOutputs(outputs);

            // Sign
            const keyPairs = privateKeys.btc.map(privateKey => BitcoinJS.ECPair.fromPrivateKey(
                // @ts-ignore Argument of type 'import("...").Buffer' is not assignable to parameter of type 'Buffer'.
                BitcoinJS.Buffer.from(privateKey, 'hex'),
            ));
            for (const keyPair of keyPairs) {
                psbt.signAllInputs(keyPair);
            }

            // Verify that all inputs are signed
            if (!psbt.validateSignaturesOfAllInputs()) {
                throw new Error('Invalid or missing signature(s) for BTC transaction.');
            }

            // Finalize
            psbt.finalizeAllInputs();

            // Extract tx
            const tx = psbt.extractTransaction();

            /** @type {KeyguardRequest.SignedBitcoinTransaction} */
            result.btc = {
                transactionHash: tx.getId(),
                raw: tx.toHex(),
            };
        }

        if (parsedRequest.redeem.type === 'NIM' && storedRequest.redeem.type === 'NIM') {
            await loadNimiq();

            const privateKey = new Nimiq.PrivateKey(Nimiq.BufferUtils.fromHex(privateKeys.nim));
            const publicKey = Nimiq.PublicKey.derive(privateKey);

            const transaction = Nimiq.Transaction.fromPlain({
                ...storedRequest.redeem.transaction.toPlain(),
                sender: parsedRequest.redeem.htlcAddress,
            });

            const signature = Nimiq.Signature.create(privateKey, publicKey, transaction.serializeContent());

            /** @type {KeyguardRequest.SignatureResult} */
            result.nim = {
                publicKey: publicKey.serialize(),
                signature: signature.serialize(),
            };
        }

        if (parsedRequest.redeem.type === 'BTC' && storedRequest.redeem.type === 'BTC') {
            const inputs = [{
                hash: parsedRequest.redeem.transactionHash,
                index: parsedRequest.redeem.outputIndex,
                witnessUtxo: {
                    script: parsedRequest.redeem.outputScript,
                    value: storedRequest.redeem.input.witnessUtxo.value,
                },
                witnessScript: BitcoinJS.Buffer.from(parsedRequest.redeem.htlcScript),
            }];

            // The address is set in SignSwap after password entry.
            if (!storedRequest.redeem.output.address) {
                throw new Errors.KeyguardError('Missing address in redeem output');
            }
            const output = /** @type {{address: string, value: number}} */ (storedRequest.redeem.output);

            // Construct transaction
            const psbt = new BitcoinJS.Psbt({ network: BitcoinUtils.Network });

            // Add inputs
            // @ts-ignore Argument of type 'Uint8Array' is not assignable to parameter of type 'Buffer'.
            psbt.addInputs(inputs);
            // Add outputs
            psbt.addOutput(output);

            // Sign
            const keyPair = BitcoinJS.ECPair.fromPrivateKey(
                // @ts-ignore Argument of type 'import("...").Buffer' is not assignable to parameter of type 'Buffer'.
                BitcoinJS.Buffer.from(privateKeys.btc[0], 'hex'),
            );
            psbt.signInput(0, keyPair);

            // Verify that all inputs are signed
            if (!psbt.validateSignaturesOfAllInputs()) {
                throw new Error('Invalid or missing signature(s) for BTC transaction.');
            }

            // Finalize (with custom logic for the HTLC)
            psbt.finalizeInput(0, (inputIndex, input /* , script, isSegwit, isP2SH, isP2WSH */) => {
                if (!input.partialSig) {
                    throw new Errors.KeyguardError('UNEXPECTED: Input does not have a partial signature');
                }

                if (!input.witnessScript) {
                    throw new Errors.KeyguardError('UNEXPECTED: Input does not have a witnessScript');
                }

                const witnessBytes = BitcoinJS.script.fromASM([
                    input.partialSig[0].signature.toString('hex'),
                    input.partialSig[0].pubkey.toString('hex'),
                    // Use zero-bytes as a dummy secret, required for signing
                    '0000000000000000000000000000000000000000000000000000000000000000',
                    'OP_1', // OP_1 (true) activates the redeem branch in the HTLC script
                    input.witnessScript.toString('hex'),
                ].join(' '));

                const witnessStack = BitcoinJS.script.toStack(witnessBytes);

                return {
                    finalScriptSig: undefined,
                    finalScriptWitness: HtlcUtils.witnessStackToScriptWitness(witnessStack),
                };
            });

            // Extract tx
            const tx = psbt.extractTransaction();

            /** @type {KeyguardRequest.SignedBitcoinTransaction} */
            result.btc = {
                transactionHash: tx.getId(),
                raw: tx.toHex(),
            };
        }

        return result;
    }
}
