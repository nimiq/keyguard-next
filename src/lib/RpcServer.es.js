/* global JsonUtils */

/**
 * This file was generated from the @nimiq/rpc package source, with `RpcServer` being the only target.
 *
 * HOWTO:
 * - Remove `export * from './RpcClient';` from @nimiq/rpc/src/main.ts
 * - Run `yarn build` in the @nimiq/rpc directory
 * - @nimiq/rpc/dist/rpc.es.js is the wanted module file
 * - The following changes where made to this file afterwards:
 *   https://github.com/nimiq/keyguard/commits/master/src/lib/RpcServer.es.js
 */

/**
 * @typedef {'ok' | 'error'} ResponseStatus
 * @typedef {{origin: string, data: object}} Message
 * @typedef {{data: {id: number, status: ResponseStatus, result: any}}} ResponseMessage extends Message
 * @typedef {{source: string}} PostMessage extends Message
 * @typedef {{origin: string, data: {id: number, command: string, args: any[]}, returnURL: string}} RedirectRequest
 */

const ResponseStatus = {
    OK: /** @type {'ok'} */ ('ok'),
    ERROR: /** @type {'error'} */ ('error'),
};

class UrlRpcEncoder {
    /**
     * @param {Location} location
     * @returns {RedirectRequest?}
     */
    static receiveRedirectCommand(location) {
        const url = new URL(location.href);

        // Need referrer for origin check
        if (!document.referrer) return null;
        const referrer = new URL(document.referrer);

        // Parse query
        const params = new URLSearchParams(url.search);
        const fragment = new URLSearchParams(url.hash.substring(1));

        // Ignore messages without an ID
        if (!fragment.has('id')) return null;
        const id = parseInt(/** @type {string} */(fragment.get('id')), 10);
        fragment.delete('id');
        params.set(UrlRpcEncoder.URL_SEARCHPARAM_NAME, id.toString());

        // Ignore messages without a command
        if (!fragment.has('command')) return null;
        const command = /** @type {string} */ (fragment.get('command'));

        // Ignore messages without a valid return path
        if (!fragment.has('returnURL')) return null;
        const returnURL = /** @type {string} */ (fragment.get('returnURL'));
        // Only allow returning to same origin
        if (new URL(returnURL).origin !== referrer.origin) return null;

        // Parse args
        let args = [];
        if (fragment.has('args')) {
            try {
                args = JsonUtils.parse(/** @type {string} */ (fragment.get('args')));
            } catch (e) {
                // Do nothing
            }
        }
        args = Array.isArray(args) ? args : [];

        url.hash = '';
        url.search = params.toString();
        window.history.replaceState(window.history.state, '', url.href);

        return {
            origin: referrer.origin,
            data: {
                id,
                command,
                args,
            },
            returnURL,
        };
    }

    /**
     * @param {RpcState} state
     * @param {ResponseStatus} status
     * @param {any} result
     * @returns {string}
     */
    static prepareRedirectReply(state, status, result) {
        const returnUrl = new URL(/** @type {string} */ (state.returnURL));
        const fragment = new URLSearchParams(returnUrl.hash.substring(1));
        fragment.set('id', state.id.toString());
        fragment.set('status', status);
        fragment.set('result', JsonUtils.stringify(result));

        returnUrl.hash = fragment.toString();

        return returnUrl.href;
    }
}
UrlRpcEncoder.URL_SEARCHPARAM_NAME = 'rpcId';

class RpcState {
    /** @type {number} */
    get id() {
        return this._id;
    }

    /** @type {string} */
    get origin() {
        return this._origin;
    }

    /** @type {{command: string, args: any[], id: number}} */
    get data() {
        return this._data;
    }

    /** @type {string?} */
    get returnURL() {
        return this._returnURL;
    }

    /** @type {Window | null} */
    get source() {
        return this._source;
    }

    /**
     * @param {MessageEvent | RedirectRequest } message
     */
    constructor(message) {
        if (!message.data.id) throw Error('Missing id');
        this._origin = message.origin;
        this._id = message.data.id;
        this._postMessage = 'source' in message && !('returnURL' in message);
        this._returnURL = 'returnURL' in message ? message.returnURL : null;
        this._data = message.data;
        this._source = 'source' in message ? /** @type {Window} */ (message.source) : null;
    }

    /**
     * @param {ResponseStatus} status
     * @param {any} result
     */
    reply(status, result) {
        console.debug('RpcServer REPLY', result);
        if (status === ResponseStatus.ERROR) {
            // serialize error objects
            result = typeof result === 'object'
                ? { message: result.message, stack: result.stack, name: result.name }
                : { message: result };
        }
        if (this._postMessage) {
            // Send via postMessage (e.g., popup)
            let target;
            // If source is given, use it
            if (this._source) {
                target = this._source;
            } else {
                target = window.parent;
            }
            target.postMessage({
                status,
                result,
                id: this.id,
            }, this.origin);
        } else if (this._returnURL) {
            // Send via top-level navigation
            window.location.href = UrlRpcEncoder.prepareRedirectReply(this, status, result);
        }
    }

    /**
     * Only return an object when the request is via redirect,
     * because for iframe requests the request does not need
     * to be stored.
     *
     * @returns {RedirectRequest?}
     */
    toRequestObject() {
        if (!this._returnURL) return null;
        return {
            origin: this._origin,
            data: this._data,
            returnURL: this._returnURL,
        };
    }
}

class RpcServer { // eslint-disable-line no-unused-vars
    /**
     * @param {RpcState} state
     * @param {any} result
     */
    static _ok(state, result) {
        state.reply(ResponseStatus.OK, result);
    }

    /**
     * @param {RpcState} state
     * @param {Error} error
     */
    static _error(state, error) {
        state.reply(ResponseStatus.ERROR, error);
    }

    /**
     * @param {string} allowedOrigin
     */
    constructor(allowedOrigin) {
        this._allowedOrigin = allowedOrigin;
        this._responseHandlers = new Map();
        this._responseHandlers.set('ping', () => 'pong');
        this._receiveListener = this._receive.bind(this);
    }

    /**
     * @param {string} command
     * @param {Function} fn
     */
    onRequest(command, fn) {
        this._responseHandlers.set(command, fn);
    }

    /**
     * @returns {boolean} Whether a redirect request was handled
     */
    init() {
        window.addEventListener('message', this._receiveListener);
        return this._receiveRedirect();
    }

    close() {
        window.removeEventListener('message', this._receiveListener);
    }

    /**
     * @returns {boolean} Whether a redirect request was handled
     */
    _receiveRedirect() {
        // Check for a request in the URL (also removes params)
        const urlRequest = UrlRpcEncoder.receiveRedirectCommand(window.location);
        if (urlRequest) {
            return this._receive(urlRequest);
        }

        // Check for a stored request referenced by a URL 'id' parameter
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.has(UrlRpcEncoder.URL_SEARCHPARAM_NAME)) {
            try {
                const storedRequest = window.sessionStorage.getItem(
                    `request-${searchParams.get(UrlRpcEncoder.URL_SEARCHPARAM_NAME)}`,
                );
                if (storedRequest) {
                    return this._receive(JsonUtils.parse(storedRequest), false);
                }
            } catch (error) {
                // Ignore SessionStorage access error
            }
        }

        return false;
    }

    /**
     * @param {MessageEvent | RedirectRequest} message
     * @param {boolean} [persistMessage]
     * @returns {boolean} Whether a redirect request was handled
     */
    _receive(message, persistMessage = true) {
        let _state = null;
        try {
            _state = new RpcState(message);
            const state = _state;

            // Cannot reply to a message that has no source window or return URL
            if (!('source' in message) && !('returnURL' in message)) return false;
            // Ignore messages without a command
            if (!('command' in state.data)) return false;
            if (this._allowedOrigin !== '*' && message.origin !== this._allowedOrigin) {
                throw new Error('Unauthorized');
            }
            const args = message.data.args && Array.isArray(message.data.args) ? message.data.args : [];
            // Test if request calls a valid handler with the correct number of arguments
            if (!this._responseHandlers.has(state.data.command)) {
                throw new Error(`Unknown command: ${state.data.command}`);
            }
            const requestedMethod = this._responseHandlers.get(state.data.command);
            // Do not include state argument
            if (Math.max(requestedMethod.length - 1, 0) < args.length) {
                throw new Error(`Too many arguments passed: ${JSON.stringify(message)}`);
            }
            console.debug('RpcServer ACCEPT', state.data);

            if (persistMessage) {
                try {
                    sessionStorage.setItem(`request-${state.data.id}`, JsonUtils.stringify(state.toRequestObject()));
                } catch (error) {
                    // Ignore SessionStorage access error
                }
            }

            // Call method
            const result = requestedMethod(state, ...args);
            // If a value is returned, we take care of the reply,
            // otherwise we assume the handler to do the reply when appropriate.
            if (result instanceof Promise) {
                result
                    .then(finalResult => {
                        if (finalResult !== undefined) {
                            RpcServer._ok(state, finalResult);
                        }
                    })
                    .catch(error => RpcServer._error(state, error));
            } else if (result !== undefined) {
                RpcServer._ok(state, result);
            }
            return true;
        } catch (error) {
            if (_state) {
                RpcServer._error(_state, error);
            }
            return false;
        }
    }
}
