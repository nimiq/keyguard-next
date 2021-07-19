/* global Nimiq */
/* global Errors */
/* global BitcoinJS */
/* global BitcoinUtils */

/**
 * @template {{}} T
 * @typedef {new (...args: any[]) => T} Constructor;
 */

// eslint-disable-next-line valid-jsdoc
/**
 * A mixin to add Bitcoin-related request parsers to a RequestParser class.
 *
 * @template {Constructor<RequestParser>} TBase
 * @param {TBase} clazz
 * @returns {typeof Clazz}
 */
function BitcoinRequestParserMixin(clazz) {
    const BitcoinHTLCInputTypes = [
        'htlc-redeem',
        'htlc-refund',
    ];

    class Clazz extends clazz {
        /**
         * @param {unknown} type
         * @param {string} name
         * @returns {'standard' | 'htlc-redeem' | 'htlc-refund'}
         */
        parseInputType(type, name) {
            if (!type || type === 'standard') return 'standard';
            if (typeof type !== 'string') {
                throw new Errors.InvalidRequestError(`${name}: Invalid input type ${type}`);
            }

            const typeString = type.toLowerCase();

            if (!BitcoinHTLCInputTypes.includes(typeString)) {
                throw new Errors.InvalidRequestError(`${name}: Invalid input type ${type}`);
            }

            return /** @type {'htlc-redeem' | 'htlc-refund'} */ (typeString);
        }

        /**
         * @param {unknown} inputs
         * @returns {ParsedBitcoinTransactionInput[]}
         */
        parseInputs(inputs) {
            if (!Array.isArray(inputs)) {
                throw new Errors.InvalidRequestError('inputs must be an array');
            }
            if (inputs.length === 0) {
                throw new Errors.InvalidRequestError('inputs must not be empty');
            }

            // Construct inputs
            return inputs.map((input, index) => {
                const script = BitcoinJS.Buffer.from(Nimiq.BufferUtils.fromAny(input.outputScript));

                /** @type {ParsedBitcoinTransactionInput} */
                const parsed = {
                    hash: Nimiq.BufferUtils.toHex(Nimiq.BufferUtils.fromAny(input.transactionHash)),
                    index: this.parsePositiveInteger(input.outputIndex, true, `input[${index}].outputIndex`),
                    witnessUtxo: {
                        script,
                        value: this.parsePositiveInteger(input.value, false, `input[${index}].value`),
                    },
                    type: this.parseInputType(input.type, `input[${index}].type`),
                    keyPath: this.parseBitcoinPath(input.keyPath, `input[${index}].keypath`),
                    // Address added only for display
                    // @ts-ignore Argument of type 'Uint8Array' is not assignable to parameter of type 'Buffer'.
                    address: BitcoinJS.address.fromOutputScript(script, BitcoinUtils.Network),
                };

                if (BitcoinHTLCInputTypes.includes(parsed.type) && !input.witnessScript) {
                    throw new Errors.InvalidRequestError(`input[${index}].witnessScript is required for HTLC inputs`);
                }

                if (input.witnessScript) {
                    parsed.witnessScript = BitcoinJS.Buffer.from(Nimiq.BufferUtils.fromAny(input.witnessScript));
                }

                return parsed;
            });
        }

        /**
         * @param {unknown} paths
         * @param {string} name - name of the property, used in error case only
         * @returns {string[]}
         */
        parseBitcoinPathsArray(paths, name) {
            if (!Array.isArray(paths)) {
                throw new Errors.InvalidRequestError(`${name} must be an array`);
            }
            if (paths.length === 0) {
                throw new Errors.InvalidRequestError(`${name} must not be empty`);
            }
            const requestedKeyPaths = paths.map(
                /**
                 * @param {unknown} path
                 * @param {number} index
                 * @returns {string}
                 */
                (path, index) => this.parseBitcoinPath(path, `${name}[${index}]`),
            );
            return requestedKeyPaths;
        }

        /**
         * @param {unknown} path
         * @param {string} name - name of the property, used in error case only
         * @returns {string}
         */
        parseBitcoinPath(path, name) {
            if (typeof path !== 'string' || path === '') {
                throw new Errors.InvalidRequestError(`${name} must be a string`);
            }
            if (!this.isValidBitcoinPath(path)) {
                throw new Errors.InvalidRequestError(`${name}: Invalid path`);
            }
            try {
                BitcoinUtils.parseBipFromDerivationPath(path);
            } catch (error) {
                throw new Errors.InvalidRequestError(`${name}: Invalid BIP, only BIP49 and BIP84 are supported`);
            }
            return path;
        }

        /**
         * @param {string} path
         * @returns {boolean}
         */
        isValidBitcoinPath(path) {
            if (path.match(/^m(\/[0-9]+'?)*$/) === null) return false;

            // Overflow check.
            const segments = path.split('/');
            for (const segment of segments) {
                const index = parseInt(segment, 10);
                if (index < 0 || index > BitcoinRequestParserMixin.DERIVATION_INDEX_MAX) return false;
            }

            return true;
        }

        /**
         * @param {unknown} output
         * @param {boolean} allowUndefined
         * @param {string} parameterName
         * @returns {KeyguardRequest.BitcoinTransactionOutput | undefined}
         */
        parseOutput(output, allowUndefined, parameterName) {
            if (output === undefined && allowUndefined) {
                return undefined;
            }

            if (typeof output !== 'object' || output === null) {
                throw new Error(`${parameterName} is not a valid output`);
            }

            /** @type {KeyguardRequest.BitcoinTransactionOutput} */
            const parsed = {
                address: this.parseBitcoinAddress(
                    /** @type {{address: unknown}} */ (output).address,
                    `${parameterName}.address`,
                ),
                label: this.parseLabel(/** @type {{label: unknown}} */ (output).label, true, `${parameterName}.label`),
                value: this.parsePositiveInteger(
                    /** @type {{value: unknown}} */ (output).value,
                    false,
                    `${parameterName}.value`,
                ),
            };
            return parsed;
        }

        /**
         * @param {unknown} output
         * @param {boolean} allowUndefined
         * @param {string} parameterName
         * @returns {KeyguardRequest.BitcoinTransactionChangeOutput | undefined}
         */
        parseChangeOutput(output, allowUndefined, parameterName) {
            if (output === undefined && allowUndefined) {
                return undefined;
            }

            if (typeof output !== 'object' || output === null) {
                throw new Error(`${parameterName} is not a valid output`);
            }

            /** @type {KeyguardRequest.BitcoinTransactionChangeOutput} */
            const parsed = {
                keyPath: this.parseBitcoinPath(
                    /** @type {{keyPath: unknown}} */ (output).keyPath, `${parameterName}.keyPath`,
                ),
                address: /** @type {{address: unknown}} */ (output).address !== undefined
                    ? this.parseBitcoinAddress(
                        /** @type {{address: unknown}} */ (output).address,
                        `${parameterName}.address`,
                    )
                    : undefined,
                value: this.parsePositiveInteger(
                    /** @type {{value: unknown}} */ (output).value,
                    false,
                    `${parameterName}.value`,
                ),
            };
            return parsed;
        }

        /**
         * @param {unknown} address
         * @param {string} parameterName
         * @returns {string}
         */
        parseBitcoinAddress(address, parameterName) {
            if (!BitcoinUtils.validateAddress(address)) {
                throw new Errors.InvalidRequestError(`${parameterName} is not a valid Bitcoin address`);
            }
            return /** @type {string} */ (address);
        }
    }

    return Clazz;
}

BitcoinRequestParserMixin.DERIVATION_INDEX_MAX = 2147483647; // 2**31 - 1
