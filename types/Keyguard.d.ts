// tslint:disable-next-line no-reference
/// <reference path="./KeyguardRequestNamespace.d.ts" />

interface Newable {
    new(...args: any[]): any
}

interface Event {
    readonly data: any
}

interface Window {
    rpcServer: RpcServer
    KeyStore: any
    TRANSLATIONS: dict
    NIMIQ_IQONS_SVG_PATH?: string
}

type AccountType = string

declare namespace AccountType {
    type HIGH = 'high'
    type LOW = 'low'
}

// Deprecated, only used for migrating databases
type AccountInfo = {
    userFriendlyAddress: string
    type: AccountType
    label: string
}

// Deprecated, only used for migrating databases
type AccountRecord = AccountInfo & {
    encryptedKeyPair: Uint8Array
}

type KeyRecord = {
    id: string
    type: Nimiq.Secret.Type
    hasPin: boolean
    secret: Uint8Array
    defaultAddress: Uint8Array
}

type ParsedBitcoinTransactionInput = {
    hash: string,
    index: number,
    witnessUtxo: {
        script: Uint8Array,
        value: number,
    },
    redeemScript?: Uint8Array,
    witnessScript?: Uint8Array,
    type: 'standard' | 'htlc-redeem' | 'htlc-refund',
    keyPath: string,
    address: string,
};

type NimHtlcContents = {
    refundAddress: string,
    redeemAddress: string,
    hash: string,
    timeoutBlockHeight: number,
};

type BtcHtlcContents = {
    refundAddress: string,
    redeemAddress: string,
    hash: string,
    timeoutTimestamp: number,
};

type Transform<T, K extends keyof T, E> = Omit<T, K> & E;

type KeyId2KeyInfo<T extends { keyId: string }> = Transform<T, 'keyId', { keyInfo: KeyInfo }>
type ConstructTransaction<T extends KeyguardRequest.TransactionInfo> = Transform<T,
    'sender' | 'senderType' | 'recipient' | 'recipientType' | 'value' | 'fee' |
    'validityStartHeight' | 'data' | 'flags',
    { transaction: Nimiq.ExtendedTransaction }>

type Is<T, B> = KeyguardRequest.Is<T, B>;

type Parsed<T extends KeyguardRequest.Request> =
    T extends Is<T, KeyguardRequest.SignTransactionRequestStandard> ?
        ConstructTransaction<KeyId2KeyInfo<KeyguardRequest.SignTransactionRequestStandard>>
        & { layout: KeyguardRequest.SignTransactionRequestLayout } :
    T extends Is<T, KeyguardRequest.SignTransactionRequestCheckout> ?
        Transform<
            ConstructTransaction<KeyId2KeyInfo<KeyguardRequest.SignTransactionRequestCheckout>>,
            'shopLogoUrl',
            { shopLogoUrl?: URL }
        > :
    T extends Is<T, KeyguardRequest.SignTransactionRequestCashlink> ?
        ConstructTransaction<KeyId2KeyInfo<KeyguardRequest.SignTransactionRequestCashlink>> :
    T extends Is<T, KeyguardRequest.SignMessageRequest> ?
        Transform<
            KeyId2KeyInfo<KeyguardRequest.SignMessageRequest>,
            'signer' | 'message',
            { signer: Nimiq.Address, message: Uint8Array | string }
        > :
    T extends Is<T, KeyguardRequest.SimpleRequest>
        | Is<T, KeyguardRequest.DeriveAddressRequest>
        | Is<T, KeyguardRequest.DeriveBtcXPubRequest>
        | Is<T, KeyguardRequest.RemoveKeyRequest>
        | Is<T, KeyguardRequest.ExportRequest> ? KeyId2KeyInfo<T> :
    T extends Is<T, KeyguardRequest.ImportRequest> ?
        Transform<
            KeyguardRequest.ImportRequest,
            'isKeyLost' | 'wordsOnly',
            { isKeyLost: boolean, wordsOnly: boolean }
        > :
    T extends Is<T, KeyguardRequest.ResetPasswordRequest> ?
        Transform<
            KeyguardRequest.ResetPasswordRequest,
            'isKeyLost' | 'expectedKeyId' | 'wordsOnly',
            { isKeyLost: boolean, expectedKeyId: string, wordsOnly: boolean }
        > :
    T extends Is<T, KeyguardRequest.SignBtcTransactionRequestStandard> ?
        Transform<
            KeyId2KeyInfo<KeyguardRequest.SignBtcTransactionRequestStandard>,
            'inputs', { inputs: ParsedBitcoinTransactionInput[] }
        > & { layout: KeyguardRequest.SignBtcTransactionRequestLayout } :
    T extends Is<T, KeyguardRequest.SignBtcTransactionRequestCheckout> ?
        Transform<
            Transform<
                KeyId2KeyInfo<KeyguardRequest.SignBtcTransactionRequestCheckout>,
                'inputs', { inputs: ParsedBitcoinTransactionInput[] }
            >, 'shopLogoUrl', { shopLogoUrl?: URL }
        > :
    T extends Is<T, KeyguardRequest.SignSwapRequest> ?
        Transform<
            KeyId2KeyInfo<KeyguardRequest.SignSwapRequest>,
            'fund' | 'redeem', {
                fund: {
                    type: 'NIM',
                    keyPath: string,
                    transaction: Nimiq.ExtendedTransaction,
                    senderLabel: string,
                } | {
                    type: 'BTC',
                    inputs: ParsedBitcoinTransactionInput[],
                    recipientOutput: { // Cannot parse an output with most of it's required properties missing
                        value: number,
                    },
                    changeOutput?: KeyguardRequest.BitcoinTransactionChangeOutput,
                    refundKeyPath: string,
                    refundAddress: string,
                },
                redeem: {
                    type: 'NIM',
                    keyPath: string,
                    transaction: Nimiq.ExtendedTransaction,
                    recipientLabel: string,
                } | {
                    type: 'BTC',
                    input: { // Cannot parse an input with most of it's required properties missing
                        witnessUtxo: {
                            value: number,
                        },
                        keyPath: string,
                    },
                    output: KeyguardRequest.BitcoinTransactionChangeOutput,
                },
            }
        > :
    T extends Is<T, KeyguardRequest.SignSwapTransactionsRequest> ?
        Transform<
            KeyguardRequest.SignSwapTransactionsRequest,
            'fund' | 'redeem', {
                fund: {
                    type: 'NIM',
                    htlcDetails: NimHtlcContents,
                    htlcData: Uint8Array,
                } | {
                    type: 'BTC',
                    htlcDetails: BtcHtlcContents,
                    htlcScript: Uint8Array,
                    htlcAddress: string,
                },
                redeem: {
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
                },
            }
        > :
    T;
