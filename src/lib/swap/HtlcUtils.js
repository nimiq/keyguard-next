/* global Nimiq */
/* global BitcoinJS */
/* global BitcoinUtils */
/* global BitcoinConstants */
/* global Errors */

class HtlcUtils { // eslint-disable-line no-unused-vars
    /**
     * @param {unknown} data - Uint8Array
     * @returns {NimHtlcContents}
     */
    static decodeNimHtlcData(data) {
        const error = new Errors.InvalidRequestError('Invalid NIM HTLC data');

        if (!data || !(data instanceof Uint8Array) || data.length !== 78) throw error;

        const buf = new Nimiq.SerialBuffer(data);

        const sender = Nimiq.Address.unserialize(buf).toUserFriendlyAddress();
        const recipient = Nimiq.Address.unserialize(buf).toUserFriendlyAddress();
        const hashAlgorithm = /** @type {Nimiq.Hash.Algorithm} */ (buf.readUint8());
        const hashRoot = Nimiq.Hash.unserialize(buf, hashAlgorithm).toHex();
        const hashCount = buf.readUint8();
        const timeout = buf.readUint32();

        if (hashAlgorithm !== Nimiq.Hash.Algorithm.SHA256) throw error;
        if (hashCount !== 1) throw error;

        return {
            refundAddress: sender,
            redeemAddress: recipient,
            hash: hashRoot,
            timeoutBlockHeight: timeout,
        };
    }

    /**
     * @param {unknown} script - Uint8Array
     * @returns {BtcHtlcContents}
     */
    static decodeBtcHtlcScript(script) {
        const error = new Errors.InvalidRequestError('Invalid BTC HTLC script');

        if (!script || !(script instanceof Uint8Array) || !script.length) throw error;
        // @ts-ignore Type 'import(...).Buffer' is not assignable to type 'Buffer'.
        const chunks = BitcoinJS.script.decompile(BitcoinJS.Buffer.from(script));
        if (!chunks) throw error;
        const asm = BitcoinJS.script.toASM(chunks).split(' ');

        let branchesVerifiedIndividually = false;

        /* eslint-disable no-plusplus */
        let i = 0;

        // Start redeem branch
        if (asm[i] !== 'OP_IF') throw error;

        // Check secret size
        if (asm[++i] !== 'OP_SIZE' || asm[++i] !== (32).toString(16) || asm[++i] !== 'OP_EQUALVERIFY') throw error;

        // Check hash
        if (asm[++i] !== 'OP_SHA256' || asm[i + 2] !== 'OP_EQUALVERIFY') throw error;
        const hash = Nimiq.BufferUtils.toHex(Nimiq.BufferUtils.fromHex(asm[++i]));
        if (hash.length !== 64) throw error;
        ++i;

        // Check redeem address
        if (asm[++i] !== 'OP_DUP' || asm[++i] !== 'OP_HASH160') throw error;
        const redeemAddressBytes = Nimiq.BufferUtils.toHex(Nimiq.BufferUtils.fromHex(asm[++i]));

        // End redeem branch, start refund branch
        if (asm[++i] !== 'OP_ELSE') {
            branchesVerifiedIndividually = true;
            if (asm[i] !== 'OP_EQUALVERIFY' || asm[++i] !== 'OP_CHECKSIG' || asm[++i] !== 'OP_ELSE') throw error;
        }

        // Check timeout
        // Bitcoin HTLC timeouts are backdated 1 hour, to account for Bitcoin's
        // minimum age for valid transaction locktimes (6 blocks).
        // @ts-ignore Argument of type 'Buffer' is not assignable to parameter of type 'Buffer'
        const timeoutTimestamp = BitcoinJS.script.number.decode(BitcoinJS.Buffer.from(asm[++i], 'hex')) + (60 * 60);
        if (asm[++i] !== 'OP_CHECKLOCKTIMEVERIFY' || asm[++i] !== 'OP_DROP') throw error;

        // Check refund address
        if (asm[++i] !== 'OP_DUP' || asm[++i] !== 'OP_HASH160') throw error;
        const refundAddressBytes = Nimiq.BufferUtils.toHex(Nimiq.BufferUtils.fromHex(asm[++i]));

        // End refund branch
        if (branchesVerifiedIndividually) {
            if (asm[++i] !== 'OP_EQUALVERIFY' || asm[++i] !== 'OP_CHECKSIG' || asm[++i] !== 'OP_ENDIF') throw error;
        } else {
            // End contract
            // eslint-disable-next-line no-lonely-if
            if (asm[++i] !== 'OP_ENDIF' || asm[++i] !== 'OP_EQUALVERIFY' || asm[++i] !== 'OP_CHECKSIG') throw error;
        }

        if (asm.length !== ++i) throw error;
        /* eslint-enable no-plusplus */

        return {
            refundAddress: BitcoinUtils.addressBytesToAddress(refundAddressBytes, BitcoinConstants.BIP.BIP84),
            redeemAddress: BitcoinUtils.addressBytesToAddress(redeemAddressBytes, BitcoinConstants.BIP.BIP84),
            hash,
            timeoutTimestamp,
        };
    }

    /**
     * @param {Buffer[]} witness
     * @returns {Buffer}
     */
    static witnessStackToScriptWitness(witness) {
        /** @type {number[]} */
        let buffer = [];

        /**
         * @param {Buffer} slice
         */
        function writeSlice(slice) {
            buffer = buffer.concat([...slice.subarray(0)]);
        }

        /**
         * Specification: https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
         *
         * @param {number} i
         */
        function writeVarInt(i) {
            if (i < 0xFD) {
                buffer.push(i);
            } else if (i <= 0xFFFF) {
                buffer.push(0xFD);
                const number = new Nimiq.SerialBuffer(2);
                number.writeUint16(i);
                buffer = buffer.concat([...number.reverse()]);
            } else if (i <= 0xFFFFFFFF) {
                buffer.push(0xFE);
                const number = new Nimiq.SerialBuffer(4);
                number.writeUint32(i);
                buffer = buffer.concat([...number.reverse()]);
            } else {
                buffer.push(0xFF);
                const number = new Nimiq.SerialBuffer(8);
                number.writeUint64(i);
                buffer = buffer.concat([...number.reverse()]);
            }
        }

        /**
         * @param {Buffer} slice
         */
        function writeVarSlice(slice) {
            writeVarInt(slice.length);
            writeSlice(slice);
        }

        /**
         * @param {Buffer[]} vector
         */
        function writeVector(vector) {
            writeVarInt(vector.length);
            vector.forEach(writeVarSlice);
        }

        writeVector(witness);

        // @ts-ignore Type 'Buffer' is not assignable to type 'Buffer'.
        return BitcoinJS.Buffer.from(buffer);
    }
}
