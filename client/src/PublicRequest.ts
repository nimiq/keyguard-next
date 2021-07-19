import * as Nimiq from '@nimiq/core-web';
import { KeyguardCommand } from './KeyguardCommand';

export type ObjectType = {
    [key: string]: any;
};

// Returns B if T and B have same keys. Ignores modifiers (readonly, optional)
export type Is<T, B> = keyof T extends keyof B ? keyof B extends keyof T ? B : never : never;
export type Transform<T, K extends keyof T, E> = Omit<T, K> & E;

// Base types for Requests
export type BasicRequest = {
    appName: string,
};

export type SingleKeyResult = {
    keyId: string;
    keyType: Nimiq.Secret.Type;
    keyLabel?: string;
    addresses: Array<{
        keyPath: string,
        address: Uint8Array,
    }>;
    fileExported: boolean;
    wordsExported: boolean;
    bitcoinXPub?: string;
};

export type TransactionInfo = {
    keyPath: string,
    senderLabel?: string,
    sender: Uint8Array,
    senderType: Nimiq.Account.Type,
    recipient: Uint8Array,
    recipientType?: Nimiq.Account.Type,
    value: number,
    fee: number,
    validityStartHeight: number,
    data?: Uint8Array,
    flags?: number,
};

export enum BitcoinTransactionInputType {
    STANDARD = 'standard',
    HTLC_REDEEM = 'htlc-redeem',
    HTLC_REFUND = 'htlc-refund',
}

export type BitcoinTransactionInput = {
    keyPath: string,
    transactionHash: string,
    outputIndex: number,
    outputScript: string,
    value: number,
} & ({
    type?: BitcoinTransactionInputType.STANDARD,
} | {
    type: BitcoinTransactionInputType.HTLC_REDEEM | BitcoinTransactionInputType.HTLC_REFUND,
    witnessScript: string,
});

export type BitcoinTransactionOutput = {
    address: string,
    value: number,
    label?: string,
};

export type BitcoinTransactionChangeOutput = {
    keyPath: string, // We require a key path for the change output to make sure that this output goes to the same key.
    address?: string, // An address can still be passed in and will be checked against the derived address.
    value: number,
};

export type BitcoinTransactionInfo = {
    inputs: BitcoinTransactionInput[],
    recipientOutput: BitcoinTransactionOutput,
    changeOutput?: BitcoinTransactionChangeOutput,
};

export type SignTransactionRequestLayout = 'standard' | 'checkout' | 'cashlink';
export type SignBtcTransactionRequestLayout = 'standard' | 'checkout';

// Specific Requests

export type CreateRequest = BasicRequest & {
    defaultKeyPath: string,
    enableBackArrow?: boolean,
    bitcoinXPubPath: string,
 };

export type DeriveAddressRequest = SimpleRequest & {
    baseKeyPath: string
    indicesToDerive: string[],
};

export type DeriveAddressesRequest = {
    keyId: string,
    paths: string[],
};

export type EmptyRequest = null;

export type ImportRequest = BasicRequest & {
    requestedKeyPaths: string[],
    isKeyLost?: boolean,
    enableBackArrow?: boolean,
    wordsOnly?: boolean,
    bitcoinXPubPath: string,
};

export type ResetPasswordRequest = ImportRequest & {
    expectedKeyId: string,
};

export type ReleaseKeyRequest = {
    keyId: string,
    shouldBeRemoved: boolean,
};

export type RemoveKeyRequest = BasicRequest & {
    keyId: string,
    keyLabel: string,
};

export type SignatureResult = {
    publicKey: Uint8Array,
    signature: Uint8Array,
};

export type SimpleRequest = BasicRequest & {
    keyId: string,
    keyLabel?: string,
};

export type ExportRequest = SimpleRequest & {
    fileOnly?: boolean,
    wordsOnly?: boolean,
};

export type ExportResult = {
    fileExported: boolean,
    wordsExported: boolean,
};

type SignTransactionRequestCommon = SimpleRequest & TransactionInfo;

export type SignTransactionRequestStandard = SignTransactionRequestCommon & {
    layout?: 'standard',
    recipientLabel?: string,
};

export type SignTransactionRequestCheckout = SignTransactionRequestCommon & {
    layout: 'checkout',
    shopOrigin: string,
    shopLogoUrl?: string,
    time?: number,
    expires?: number,
    fiatCurrency?: string,
    fiatAmount?: number,
    vendorMarkup?: number,
};

export type SignTransactionRequestCashlink = SignTransactionRequestCommon & {
    layout: 'cashlink',
    cashlinkMessage?: string,
};

export type SignTransactionRequest
    = SignTransactionRequestStandard
    | SignTransactionRequestCheckout
    | SignTransactionRequestCashlink;

export type SignBtcTransactionRequestStandard = SimpleRequest & BitcoinTransactionInfo & {
    layout?: 'standard',
};

export type SignBtcTransactionRequestCheckout = SimpleRequest & BitcoinTransactionInfo & {
    layout: 'checkout',
    shopOrigin: string,
    shopLogoUrl?: string,
    time?: number,
    expires?: number,
    fiatCurrency?: string,
    fiatAmount?: number,
    vendorMarkup?: number,
};

export type SignBtcTransactionRequest
    = SignBtcTransactionRequestStandard
    | SignBtcTransactionRequestCheckout;

export type SignSwapRequest = SimpleRequest & {
    swapId: string,
    fund: (
        {type: 'NIM'}
        & Omit<TransactionInfo,
            | 'recipient' // Only known in second step (in swap-iframe), derived from htlcData
            | 'recipientType' // Must be HTLC
            | 'recipientLabel' // Not used
            | 'data' // Only known in second step (in swap-iframe)
            | 'flags' // Must be CONTRACT_CREATION
        >
        & { senderLabel: string }
    ) | (
        {type: 'BTC'}
        & Transform<BitcoinTransactionInfo, 'recipientOutput', {
            recipientOutput: Omit<BitcoinTransactionOutput,
                | 'address' // Only known in second step (in swap-iframe), derived from htlcScript
                | 'label' // Not used
            >,
            refundKeyPath: string, // To validate that we own the HTLC script's refund address
        }>
    ),
    redeem: (
        {type: 'NIM'}
        & Omit<TransactionInfo,
            | 'sender' // Only known in second step (in swap-iframe)
            | 'senderType' // Must be HTLC
            | 'senderLabel' // Not used
            | 'recipientType' // Must by BASIC (can only redeem to signer adress)
            | 'flags' // Must be NONE, as it cannot be CONTRACT_CREATION
        >
        & { recipientLabel: string }
    ) | (
        {type: 'BTC'}
        & {
            input: Omit<BitcoinTransactionInput, // Only allow one input (the HTLC UTXO)
                | 'transactionHash' // Only known in second step (in swap-iframe)
                | 'outputIndex' // Only known in second step (in swap-iframe)
                | 'outputScript' // Only known in second step (in swap-iframe), derived from htlcScript
                | 'witnessScript' // Only known in second step (in swap-iframe)
                | 'type' // Must be 'htlc-redeem'
            >,
            output: BitcoinTransactionChangeOutput,
        }
    ),

    // Data needed for display
    fiatCurrency: string,
    nimFiatRate: number,
    btcFiatRate: number,
    serviceFundingNetworkFee: number, // Luna or Sats, depending which one gets funded
    serviceRedeemingNetworkFee: number, // Luna or Sats, depending which one gets redeemed
    serviceExchangeFee: number, // Luna or Sats, depending which one gets funded
    nimiqAddresses: Array<{
        address: string,
        balance: number, // Luna
    }>,
    bitcoinAccount: {
        balance: number, // Sats
    },
};

// Used in swap-iframe
export type SignSwapTransactionsRequest = {
    swapId: string,
    fund: {
        type: 'NIM'
        htlcData: Uint8Array,
    } | {
        type: 'BTC',
        htlcScript: Uint8Array,
    },
    redeem: {
        type: 'NIM',
        htlcData: Uint8Array,
        htlcAddress: string,
    } | {
        type: 'BTC',
        htlcScript: Uint8Array,
        transactionHash: string,
        outputIndex: number;
    },
};

export type SignMessageRequest = SimpleRequest & {
    keyPath: string,
    message: Uint8Array | string,
    // `signer` is the address, because Keyguard would otherwise only be able to display it after decryption.
    // The Keyguard validates that the `keyPath` generates this address, before signing the message.
    signer: Uint8Array,
    signerLabel: string,
};

export type DeriveBtcXPubRequest = SimpleRequest & {
    bitcoinXPubPath: string,
};

export type DeriveBtcXPubResult = {
    bitcoinXPub: string,
};

// Request unions

export type RedirectRequest
    = CreateRequest
    | DeriveAddressRequest
    | ExportRequest
    | ImportRequest
    | RemoveKeyRequest
    | SignMessageRequest
    | SignTransactionRequest
    | SignBtcTransactionRequest
    | SimpleRequest
    | DeriveBtcXPubRequest
    | SignSwapRequest;

export type IFrameRequest
    = EmptyRequest
    | DeriveAddressesRequest
    | ReleaseKeyRequest
    | SignSwapTransactionsRequest;

export type Request = RedirectRequest | IFrameRequest;

// Base types for Results

export type KeyInfoObject = {
    id: string;
    type: Nimiq.Secret.Type;
    hasPin: boolean;
};

export type LegacyKeyInfoObject = KeyInfoObject & {
    legacyAccount: {
        label: string,
        address: Uint8Array,
    };
};

// Specific Results

export type DerivedAddress = {
    address: Uint8Array,
    keyPath: string,
};
export type KeyResult = SingleKeyResult[];
export type ListResult = KeyInfoObject[];
export type ListLegacyResult = LegacyKeyInfoObject[];
export type SignTransactionResult = SignatureResult;
export type SimpleResult = { success: boolean };
export type SignedBitcoinTransaction = {
    transactionHash: string,
    raw: string,
};
export type SignSwapTransactionsResult = {
    nim: SignatureResult,
    btc: SignedBitcoinTransaction,
};

// Result unions

export type IFrameResult
    = DerivedAddress[]
    | ListLegacyResult
    | ListResult
    | SimpleResult
    | SignSwapTransactionsResult;

export type RedirectResult
    = DerivedAddress[]
    | ExportResult
    | KeyResult
    | SignTransactionResult
    | SignedBitcoinTransaction
    | SimpleResult
    | DeriveBtcXPubResult;

export type Result = RedirectResult | IFrameResult;

// Derived Result types

export type ResultType<T extends RedirectRequest> =
    T extends Is<T, SignMessageRequest> | Is<T, SignTransactionRequest> ? SignatureResult :
    T extends Is<T, DeriveAddressRequest> ? DerivedAddress[] :
    T extends Is<T, CreateRequest> | Is<T, ImportRequest> | Is<T, ResetPasswordRequest> ? KeyResult :
    T extends Is<T, ExportRequest> ? ExportResult :
    T extends Is<T, RemoveKeyRequest> | Is<T, SimpleRequest> ? SimpleResult :
    T extends Is<T, SignBtcTransactionRequest> ? SignedBitcoinTransaction :
    T extends Is<T, DeriveBtcXPubRequest> ? DeriveBtcXPubResult :
    T extends Is<T, SignSwapRequest> ? SimpleResult :
    never;

export type ResultByCommand<T extends KeyguardCommand> =
    T extends KeyguardCommand.SIGN_MESSAGE | KeyguardCommand.SIGN_TRANSACTION ? SignatureResult :
    T extends KeyguardCommand.DERIVE_ADDRESS ? DerivedAddress[] :
    T extends KeyguardCommand.CREATE | KeyguardCommand.IMPORT ? KeyResult :
    T extends KeyguardCommand.EXPORT ? ExportResult :
    T extends KeyguardCommand.REMOVE ? SimpleResult :
    T extends KeyguardCommand.SIGN_BTC_TRANSACTION ? SignedBitcoinTransaction :
    T extends KeyguardCommand.DERIVE_BTC_XPUB ? DeriveBtcXPubResult :
    T extends KeyguardCommand.SIGN_SWAP ? SimpleResult :
    never;

// Error constants

export type KeyguardError = {
    Types: {
        // used for request parsing errors.
        INVALID_REQUEST: 'InvalidRequest',
        // used for errors thrown from core methods
        CORE: 'Core',
        // used for internal keyguard Errors.
        KEYGUARD: 'Keyguard',
        // used for the remaining Errors which are not assigned an own type just yet.
        UNCLASSIFIED: 'Unclassified',
    },
    Messages: {
        // specifically used to trigger a redirect to create after returning to caller
        GOTO_CREATE: 'GOTO_CREATE',
        // Specifically used to trigger a redirect to a special import after returning to caller
        GOTO_RESET_PASSWORD: 'GOTO_RESET_PASSWORD',
        // used to signal a user initiated cancelation of the request
        CANCELED: 'CANCELED',
        // used to signal that the request expired
        EXPIRED: 'EXPIRED',
        // used to signal that a given keyId no longer exist in KG, to be treated by caller.
        KEY_NOT_FOUND: 'keyId not found',
        // network name does not exist
        INVALID_NETWORK_CONFIG: 'Invalid network config',
    },
};
