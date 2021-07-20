/** @type KeyguardRequest.KeyguardError */
const ErrorConstants = {
    Types: {
        // used for request parsing errors.
        INVALID_REQUEST: 'InvalidRequest',
        // used for errors thrown from core methods
        CORE: 'Core',
        // used for other internal keyguard Errors.
        KEYGUARD: 'Keyguard',
        // used for errors caused by the browser and its configuration
        BROWSER: 'Browser',
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
        // when the browser prevents access to LocalStorage or SessionStorage (because of privacy settings)
        NO_STORAGE_ACCESS: 'Cannot access browser storage because of privacy settings',
    },
};

// 'export' to client via side effects
window.__keyguardErrorContainer = {
    ErrorConstants,
};
