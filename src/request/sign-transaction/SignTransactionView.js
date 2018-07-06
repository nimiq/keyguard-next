class SignTransactionView extends Nimiq.Observable {
    /**
     * Decrypt key and use it to sign a transaction constructed with the data from txRequest.
     *
     * @param {TransactionRequest} txRequest
     * @param {string} passphraseOrPin
     * @return {Promise<SignedTransactionResult | undefined>}
     * @protected
     */
    async _signTx(txRequest, passphraseOrPin) {
        if (txRequest.type !== TransactionType.BASIC) {
            throw new Error('Not yet implemented');
        }

        const { value, fee, recipient, signer, validityStartHeight } = txRequest;

        const key = await KeyStore.instance.get(signer, passphraseOrPin);
        const tx = key.createTransaction(recipient, value, fee, validityStartHeight);

        const signatureProof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(tx.proof));

        return {
            sender: tx.sender.toUserFriendlyAddress(),
            senderPubKey: signatureProof.publicKey.serialize(),
            recipient: tx.recipient.toUserFriendlyAddress(),
            value: Nimiq.Policy.satoshisToCoins(tx.value),
            fee: Nimiq.Policy.satoshisToCoins(tx.fee),
            validityStartHeight: tx.validityStartHeight,
            signature: signatureProof.signature.serialize(),
            extraData: Utf8Tools.utf8ByteArrayToString(tx.data),
            hash: tx.hash().toBase64()
        };
    }
}
