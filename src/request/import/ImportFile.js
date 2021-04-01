/* global Constants */
/* global Nimiq */
/* global Key */
/* global ImportWords */
/* global FileImporter */
/* global PasswordBox */
/* global ImportApi */
/* global Errors */
/* global TopLevelApi */
/* global Utf8Tools */
/* global KeyStore */
/* global BitcoinKey */
/* global QrVideoScanner */

/**
 * @callback ImportFile.resolve
 * @param {KeyguardRequest.KeyResult} result
 */

class ImportFile {
    /**
     * @param {Parsed<KeyguardRequest.ImportRequest>} request
     * @param {ImportFile.resolve} resolve
     * @param {reject} reject
     */
    constructor(request, resolve, reject) {
        this._request = request;
        this._resolve = resolve;
        this._reject = reject;

        this._encryptedKey = new Nimiq.SerialBuffer(0);
        this._flags = {
            hasPin: false,
        };

        this.importWordsHandler = new ImportWords(request, resolve, reject);

        /** @type {HTMLElement} */
        this.$importFilePage = (document.getElementById(ImportFile.Pages.IMPORT_FILE));
        /** @type {HTMLElement} */
        this.$unlockAccountPage = (document.getElementById(ImportFile.Pages.UNLOCK_ACCOUNT));

        if (request.isKeyLost) {
            /** @type {HTMLElement} */
            (this.$importFilePage.querySelector('.login-to-continue')).classList.remove('display-none');
        }

        /** @type {HTMLLabelElement} */
        const $fileImport = (this.$importFilePage.querySelector('.file-import'));
        const fileImport = new FileImporter($fileImport, false);

        /** @type {HTMLButtonElement} */
        const $qrVideoButton = (this.$importFilePage.querySelector('.qr-video-button'));

        /** @type {HTMLDivElement} */
        this.$qrVideoScanner = (this.$importFilePage.querySelector('.qr-video-scanner'));
        this.qrVideoScanner = new QrVideoScanner(this.$qrVideoScanner);

        /** @type {HTMLElement} */
        const $gotoWords = (this.$importFilePage.querySelector('#goto-words'));
        $gotoWords.addEventListener('click', () => { this.importWordsHandler.run(); });

        const $gotoCreate = this.$importFilePage.querySelector('#goto-create');
        if ($gotoCreate) {
            $gotoCreate.addEventListener('click', this._goToCreate.bind(this));
        }

        /** @type {HTMLImageElement} */
        this.$loginFileImage = (this.$unlockAccountPage.querySelector('.loginfile-image'));

        /** @type {HTMLFormElement} */
        const $passwordBox = (this.$unlockAccountPage.querySelector('.password-box'));
        this.passwordBox = new PasswordBox(
            $passwordBox,
            { buttonI18nTag: 'passwordbox-log-in' },
        );
        fileImport.on(FileImporter.Events.IMPORT, this._onFileImported.bind(this));
        this.passwordBox.on(PasswordBox.Events.SUBMIT, this._onPasswordEntered.bind(this));

        this.qrVideoScanner.on(QrVideoScanner.Events.RESULT, result => {
            this._onFileImported(result);
            this._stopQrVideo();
        });
        this.qrVideoScanner.on(QrVideoScanner.Events.CANCEL, this._stopQrVideo.bind(this));

        $qrVideoButton.addEventListener('click', this._startQrVideo.bind(this));

        if (request.enableBackArrow) {
            /** @type {HTMLElement} */
            (this.$importFilePage.querySelector('.page-header-back-button')).classList.remove('display-none');
        }
    }

    run() {
        window.location.hash = ImportFile.Pages.IMPORT_FILE;
    }

    /**
     * @param {string} decoded
     * @param {string} [src]
     */
    _onFileImported(decoded, src) {
        if (decoded.substr(0, 2) === '#2') {
            // Imported file is a PIN-encrypted account Access File
            decoded = decoded.substr(2);
            this._flags.hasPin = true;
        }

        this._encryptedKey = Nimiq.BufferUtils.fromBase64(decoded);

        // Prepare next page
        if (src) {
            this.$loginFileImage.src = src;
        }
        const version = this._encryptedKey.readUint8();
        // eslint-disable-next-line no-nested-ternary
        this.passwordBox.setMinLength(this._flags.hasPin ? Key.PIN_LENGTH : version < 3 ? 10 : undefined);
        this.passwordBox.reset();
        this.$unlockAccountPage.classList.remove('animate');

        // Go to next page
        window.location.hash = ImportFile.Pages.UNLOCK_ACCOUNT;
        setTimeout(() => this.$unlockAccountPage.classList.add('animate'), 0);

        TopLevelApi.focusPasswordBox();
    }

    _startQrVideo() {
        this.qrVideoScanner.start();
        this.qrVideoScanner.repositionOverlay();
        this.$qrVideoScanner.classList.add('active');
    }

    _stopQrVideo() {
        this.$qrVideoScanner.classList.remove('active');
        window.setTimeout(() => this.qrVideoScanner.stop(), 1000);
    }

    /**
     * @param {string} password
     * @returns {Promise<void>}
     */
    async _onPasswordEntered(password) {
        /** @type {Key?} */
        let key;

        try {
            key = await this._decryptAndStoreKey(password);
        } catch (error) {
            this.passwordBox.onPasswordIncorrect();
            return;
        }

        if (!key) {
            this.passwordBox.onPasswordIncorrect();
            return;
        }

        /** @type {{keyPath: string, address: Uint8Array}[]} */
        const addresses = [];

        /** @type {string | undefined} */
        let bitcoinXPub;

        if (key.secret instanceof Nimiq.PrivateKey) {
            addresses.push({
                keyPath: Constants.LEGACY_DERIVATION_PATH,
                address: key.deriveAddress('').serialize(),
            });
        } else if (key.secret instanceof Nimiq.Entropy) {
            /** @type {KeyguardRequest.ImportRequest} */
            (this._request).requestedKeyPaths.forEach(keyPath => {
                addresses.push({
                    keyPath,
                    address: /** @type {Key} */(key).deriveAddress(keyPath).serialize(),
                });
            });

            bitcoinXPub = new BitcoinKey(key).deriveExtendedPublicKey(this._request.bitcoinXPubPath);

            // Store entropy in SessionStorage so addresses can be derived in the KeyguardIframe
            const secretString = Nimiq.BufferUtils.toBase64(key.secret.serialize());
            sessionStorage.setItem(ImportApi.SESSION_STORAGE_KEY_PREFIX + key.id, secretString);
        } else {
            this._reject(new Errors.KeyguardError(`Unkown key type ${key.type}`));
            return;
        }

        /** @type {KeyguardRequest.KeyResult} */
        const result = [{
            keyId: key.id,
            keyType: key.type,
            addresses,

            // Backup warnings should not be shown for imported accounts, only for newly created accounts.
            // Therefore we set both flags to true.
            fileExported: true,
            wordsExported: true,
            bitcoinXPub,
        }];

        this._resolve(result);
    }

    /**
     * @param {string} password
     * @returns {Promise<Key?>}
     */
    async _decryptAndStoreKey(password) {
        TopLevelApi.setLoading(true);
        try {
            const encryptionKey = Utf8Tools.stringToUtf8ByteArray(password);

            // Make sure read position is at 0 even after a wrong password
            this._encryptedKey.reset();

            const secret = await Nimiq.Secret.fromEncrypted(this._encryptedKey, encryptionKey);

            // If this code runs, the password was correct and the request returns
            /** @type {HTMLElement} */
            (this.$unlockAccountPage.querySelector('.lock')).classList.add('unlocked');

            // TODO expectedKeyId check if it gets used in the future.
            const key = new Key(secret, this._flags.hasPin);
            await KeyStore.instance.put(key, encryptionKey);
            return key;
        } catch (event) {
            console.error(event);
            TopLevelApi.setLoading(false);
            return null; // Triggers onPasswordIncorrect above
        }
    }

    /**
     * @param {Event} event
     */
    _goToCreate(event) {
        event.preventDefault();
        this._reject(new Errors.GoToCreate());
    }
}

ImportFile.Pages = {
    IMPORT_FILE: 'import-file',
    UNLOCK_ACCOUNT: 'unlock-account',
};
