import { RedirectRpcClient, PostMessageRpcClient } from '@nimiq/rpc';
import { KeyguardCommand } from './KeyguardCommand';
import { ObjectType } from './PublicRequest';

enum BehaviorType {
    REDIRECT,
    IFRAME,
}

export class RequestBehavior {
    public static getAllowedOrigin(endpoint: string) {
        const url = new URL(endpoint);
        return url.origin;
    }

    private readonly _type: BehaviorType;

    constructor(type: BehaviorType) {
        this._type = type;
    }

    public async request(endpoint: string, command: KeyguardCommand, args: any[]): Promise<void> {
        throw new Error('Not implemented');
    }

    public get type() {
        return this._type;
    }
}

export class RedirectRequestBehavior extends RequestBehavior {
    public static getRequestUrl(endpoint: string, command: KeyguardCommand) {
        return `${endpoint}/request/${command}/`;
    }

    private readonly _returnUrl: string;
    private readonly _localState: ObjectType|null;
    private readonly _handleHistoryBack: boolean;

    constructor(returnUrl?: string, localState?: ObjectType|null, handleHistoryBack = false) {
        super(BehaviorType.REDIRECT);
        const location = window.location;
        this._returnUrl = returnUrl || `${location.origin}${location.pathname}`;
        this._localState = localState || {};
        this._handleHistoryBack = handleHistoryBack;

        // Reject local state with reserved property.
        if (typeof this._localState.__command !== 'undefined') {
            throw new Error('Invalid localState: Property \'__command\' is reserved');
        }
    }

    public async request(endpoint: string, command: KeyguardCommand, args: any[]): Promise<void> {
        const url = RedirectRequestBehavior.getRequestUrl(endpoint, command);
        const allowedOrigin = RequestBehavior.getAllowedOrigin(endpoint);

        const client = new RedirectRpcClient(url, allowedOrigin);

        const state = Object.assign({ __command: command }, this._localState);
        client.callAndSaveLocalState(this._returnUrl, state, 'request', this._handleHistoryBack, ...args);
    }
}

export class IFrameRequestBehavior extends RequestBehavior {
    private _iframe: HTMLIFrameElement | null;
    private _client: PostMessageRpcClient | null;

    protected get IFRAME_PATH_SUFFIX() {
        return '/request/iframe/';
    }

    constructor() {
        super(BehaviorType.IFRAME);
        this._iframe = null;
        this._client = null;
    }

    public async request(endpoint: string, command: KeyguardCommand, args: any[]): Promise<any> {
        if (this._iframe && this._iframe.src !== `${endpoint}${this.IFRAME_PATH_SUFFIX}`) {
            throw new Error('Keyguard iframe is already opened with another endpoint');
        }

        const origin = RequestBehavior.getAllowedOrigin(endpoint);

        if (!this._iframe) {
            this._iframe = await this.createIFrame(endpoint);
        }
        if (!this._iframe.contentWindow) {
            throw new Error(`IFrame contentWindow is ${typeof this._iframe.contentWindow}`);
        }

        if (!this._client) {
            this._client = new PostMessageRpcClient(this._iframe.contentWindow, origin);
            await this._client.init();
        }

        return await this._client.call(command, ...args);
    }

    public async createIFrame(endpoint: string): Promise<HTMLIFrameElement> {
        return new Promise((resolve, reject) => {
            const $iframe = document.createElement('iframe');
            $iframe.name = 'NimiqKeyguardIFrame';
            $iframe.style.display = 'none';
            document.body.appendChild($iframe);
            $iframe.src = `${endpoint}${this.IFRAME_PATH_SUFFIX}`;
            $iframe.onload = () => resolve($iframe);
            $iframe.onerror = reject;
        }) as Promise<HTMLIFrameElement>;
    }
}

export class SwapIFrameRequestBehavior extends IFrameRequestBehavior {
    protected get IFRAME_PATH_SUFFIX() {
        return '/request/swap-iframe/';
    }
}
