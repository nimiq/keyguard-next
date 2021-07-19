import { RedirectRpcClient } from '@nimiq/rpc';

import {
    RequestBehavior,
    RedirectRequestBehavior,
    IFrameRequestBehavior,
    SwapIFrameRequestBehavior,
} from './RequestBehavior';

import { KeyguardCommand } from './KeyguardCommand';

import {
    CreateRequest,
    DeriveAddressRequest,
    DeriveAddressesRequest,
    EmptyRequest,
    ImportRequest,
    RedirectRequest,
    RemoveKeyRequest,
    ReleaseKeyRequest,
    ResetPasswordRequest,
    SignTransactionRequest,
    SignMessageRequest,
    SimpleRequest,
    IFrameRequest,
    ListLegacyResult,
    ListResult,
    SimpleResult,
    IFrameResult,
    RedirectResult,
    ExportRequest,
    DerivedAddress,
    ObjectType,
    ResultByCommand,
    SignBtcTransactionRequest,
    DeriveBtcXPubRequest,
    SignSwapRequest,
    SignSwapTransactionsRequest,
    SignSwapTransactionsResult,
} from './PublicRequest';

import Observable from './Observable';

export class KeyguardClient {
    // getter to help with tree-shaking
    private static get DEFAULT_ENDPOINT() {
        return window.location.origin === 'https://hub.nimiq.com' ? 'https://keyguard.nimiq.com'
        : window.location.origin === 'https://hub.nimiq-testnet.com' ? 'https://keyguard.nimiq-testnet.com'
        : `${location.protocol}//${location.hostname}:8000/src`;
    }

    private readonly _endpoint: string;
    private _redirectClient: RedirectRpcClient;
    private _observable: Observable;
    private _redirectBehavior: RedirectRequestBehavior;
    private _iframeBehavior: IFrameRequestBehavior;

    constructor(
        endpoint = KeyguardClient.DEFAULT_ENDPOINT,
        returnURL?: string,
        localState?: ObjectType|null,
        preserveRequests?: boolean,
        handleHistoryBack?: boolean,
    ) {
        this._endpoint = endpoint;
        this._redirectBehavior = new RedirectRequestBehavior(returnURL, localState, handleHistoryBack);
        this._iframeBehavior = new IFrameRequestBehavior();

        const allowedOrigin = RequestBehavior.getAllowedOrigin(this._endpoint);

        // Listen for response
        this._redirectClient = new RedirectRpcClient('', allowedOrigin, preserveRequests);
        this._redirectClient.onResponse('request', this._onResolve.bind(this), this._onReject.bind(this));

        this._observable = new Observable();
    }

    public init() {
        return this._redirectClient.init();
    }

    public on<T extends KeyguardCommand>(
        command: T,
        resolve: (result: ResultByCommand<T>, state?: ObjectType|null) => any,
        reject: (error: Error, state?: ObjectType|null) => any,
    ) {
        this._observable.on(`${command}-resolve`, resolve);
        this._observable.on(`${command}-reject`, reject);
    }

    /* TOP-LEVEL REQUESTS */

    public create(request: CreateRequest) {
        this._redirectRequest<CreateRequest> (KeyguardCommand.CREATE, request);
    }

    public remove(request: RemoveKeyRequest) {
        this._redirectRequest<RemoveKeyRequest>(KeyguardCommand.REMOVE, request);
    }

    public import(request: ImportRequest) {
        this._redirectRequest<ImportRequest>(KeyguardCommand.IMPORT, request);
    }

    public export(request: ExportRequest) {
        this._redirectRequest<ExportRequest>(KeyguardCommand.EXPORT, request);
    }

    public changePassword(request: SimpleRequest) {
        this._redirectRequest<SimpleRequest>(KeyguardCommand.CHANGE_PASSWORD, request);
    }

    public resetPassword(request: ResetPasswordRequest) {
        this._redirectRequest<ResetPasswordRequest>(KeyguardCommand.IMPORT, request);
    }

    public signTransaction(request: SignTransactionRequest) {
        this._redirectRequest<SignTransactionRequest>(KeyguardCommand.SIGN_TRANSACTION, request);
    }

    public deriveAddress(request: DeriveAddressRequest) {
        this._redirectRequest<DeriveAddressRequest>(KeyguardCommand.DERIVE_ADDRESS, request);
    }

    public signMessage(request: SignMessageRequest) {
        this._redirectRequest<SignMessageRequest>(KeyguardCommand.SIGN_MESSAGE, request);
    }

    public signBtcTransaction(request: SignBtcTransactionRequest) {
        this._redirectRequest<SignBtcTransactionRequest>(KeyguardCommand.SIGN_BTC_TRANSACTION, request);
    }

    public deriveBtcXPub(request: DeriveBtcXPubRequest) {
        this._redirectRequest<DeriveBtcXPubRequest>(KeyguardCommand.DERIVE_BTC_XPUB, request);
    }

    public signSwap(request: SignSwapRequest) {
        this._redirectRequest<SignSwapRequest>(KeyguardCommand.SIGN_SWAP, request);
    }

    /* IFRAME REQUESTS */

    public async list(): Promise<ListResult> {
        return this._iframeRequest<EmptyRequest, ListResult>(KeyguardCommand.LIST);
    }

    public async hasKeys(): Promise<SimpleResult> {
        return this._iframeRequest<EmptyRequest, SimpleResult>(KeyguardCommand.HAS_KEYS);
    }

    public async deriveAddresses(keyId: string, paths: string[]): Promise<DerivedAddress[]> {
        return this._iframeRequest<DeriveAddressesRequest, DerivedAddress[]>
            (KeyguardCommand.DERIVE_ADDRESSES, { keyId, paths });
    }

    public async releaseKey(keyId: string, shouldBeRemoved = false): Promise<SimpleResult> {
        return this._iframeRequest<ReleaseKeyRequest, SimpleResult>
            (KeyguardCommand.RELEASE_KEY, { keyId, shouldBeRemoved });
    }

    public async listLegacyAccounts(): Promise<ListLegacyResult> {
        return this._iframeRequest<EmptyRequest, ListLegacyResult>(KeyguardCommand.LIST_LEGACY_ACCOUNTS);
    }

    public async hasLegacyAccounts(): Promise<SimpleResult> {
        return this._iframeRequest<EmptyRequest, SimpleResult>(KeyguardCommand.HAS_LEGACY_ACCOUNTS);
    }

    public async migrateAccountsToKeys(): Promise<SimpleResult> {
        return this._iframeRequest<EmptyRequest, SimpleResult>(KeyguardCommand.MIGRATE_ACCOUNTS_TO_KEYS);
    }

    public async signSwapTransactions(request: SignSwapTransactionsRequest): Promise<SignSwapTransactionsResult> {
        return this._iframeRequest<SignSwapTransactionsRequest, SignSwapTransactionsResult>(
            KeyguardCommand.SIGN_SWAP_TRANSACTIONS,
            request,
        );
    }

    /* PRIVATE METHODS */

    private async _redirectRequest<T extends RedirectRequest>(
        command: KeyguardCommand,
        request: T,
    ) {
        this._redirectBehavior.request(this._endpoint, command, [ request ]);
        // return value of redirect call is received in _onResolve()
    }

    private async _iframeRequest<T1 extends IFrameRequest, T2 extends IFrameResult>(
        command: KeyguardCommand,
        request?: T1,
    ): Promise<T2> {
        const args = request ? [request] : [];

        const behavior = command === KeyguardCommand.SIGN_SWAP_TRANSACTIONS
            ? new SwapIFrameRequestBehavior()
            : this._iframeBehavior;

        return behavior.request(this._endpoint, command, args);
    }

    private _onReject(
        error: any,
        id?: number,
        state?: ObjectType|null,
     ) {
        const [parsedState, command] = this._parseState(state);
        this._observable.fire(`${command}-reject`, error, parsedState);
    }

    private _onResolve<T extends RedirectResult>(
        result: T,
        id?: number,
        state?: ObjectType|null,
    ) {
        const [parsedState, command] = this._parseState(state);
        this._observable.fire(`${command}-resolve`, result, parsedState);
    }

    private _parseState(state?: ObjectType|null) {
        if (state) {
            const command = state.__command;
            if (command) {
                delete state.__command;
                return [state, command];
            }
        }
        throw new Error('Invalid state after RPC request');
    }
}

import '../../src/lib/SignMessageConstants.js';

// tslint:disable-next-line:variable-name
export const MSG_PREFIX = window.__messageSigningPrefix.MSG_PREFIX;
