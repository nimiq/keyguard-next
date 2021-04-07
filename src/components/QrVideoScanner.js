/* global Nimiq */
/* global I18n */
/* global QrScanner */
/* global TemplateTags */

class QrVideoScanner extends Nimiq.Observable {
    // eslint-disable-next-line valid-jsdoc
    /**
     * @param {HTMLDivElement} [$el]
     * @param {number} [reportFrequency = 7000]
     * @param {(result: string) => boolean} [validator]
     */
    constructor($el, reportFrequency = 7000, validator = /** @param {string} result */ result => !!result) {
        super();

        this._reportFrequency = reportFrequency;
        this._validator = validator;

        this._isRepositioningOverlay = false;
        this._cameraRetryTimer = 0;
        /** @type {string | undefined} */
        this._lastResult = undefined;
        this._lastResultTime = 0;

        this.$el = QrVideoScanner._createElement($el);

        /** @type {HTMLVideoElement} */
        const $video = (this.$el.querySelector('video'));

        /** @type {HTMLDivElement} */
        this.$overlay = (this.$el.querySelector('.overlay'));

        /** @type {HTMLButtonElement} */
        const $cancelButton = (this.$el.querySelector('.cancel-button'));

        this._scanner = new QrScanner($video, result => this._onResult(result));

        $cancelButton.addEventListener('click', () => this.fire(QrVideoScanner.Events.CANCEL));

        QrScanner.hasCamera().then(hasCamera => this.$el.classList.toggle('no-camera', !hasCamera));
    }

    /**
     * @returns {Promise<boolean>}
     */
    async start() {
        try {
            await this._scanner.start();
            this.$el.classList.remove('camera-issue');
            if (this._cameraRetryTimer) {
                window.clearInterval(this._cameraRetryTimer);
                this._cameraRetryTimer = 0;
            }
            return true;
        } catch (error) {
            this.$el.classList.add('camera-issue');
            this.fire(QrVideoScanner.Events.ERROR, typeof error === 'string' ? new Error(error) : error);
            if (!this._cameraRetryTimer) {
                this._cameraRetryTimer = window.setInterval(() => this.start(), 3000);
            }
            return false;
        }
    }

    /**
     * @param {string} result
     */
    _onResult(result) {
        if (
            (result === this._lastResult && Date.now() - this._lastResultTime < this._reportFrequency)
            || !this._validator(result)
        ) return;

        this._lastResult = result;
        this._lastResultTime = Date.now();
        this.fire(QrVideoScanner.Events.RESULT, result);
    }

    stop() {
        this._scanner.stop();
        if (this._cameraRetryTimer) {
            window.clearInterval(this._cameraRetryTimer);
            this._cameraRetryTimer = 0;
        }
    }

    repositionOverlay() {
        if (this._isRepositioningOverlay) return;
        this._isRepositioningOverlay = true;
        requestAnimationFrame(() => {
            const scannerHeight = this.$el.offsetHeight;
            const scannerWidth = this.$el.offsetWidth;

            const shorterSideLength = Math.min(scannerHeight, scannerWidth);
            if (!shorterSideLength) return; // component not visible or destroyed

            // not always the accurate size of the sourceRect for QR detection in QrScannerLib (e.g. if video is
            // landscape and screen portrait) but looks nicer in the UI.
            const overlaySize = Math.ceil(2 / 3 * shorterSideLength);

            this.$overlay.style.width = `${overlaySize}px`;
            this.$overlay.style.height = `${overlaySize}px`;
            this.$overlay.style.top = `${(scannerHeight - overlaySize) / 2}px`;
            this.$overlay.style.left = `${(scannerWidth - overlaySize) / 2}px`;

            this._isRepositioningOverlay = false;
        });
    }

    /**
     * @returns {HTMLDivElement}
     */
    getElement() {
        return this.$el;
    }

    /**
     * @param {HTMLDivElement} [$el]
     * @returns {HTMLDivElement}
     */
    static _createElement($el) {
        const $element = $el || document.createElement('div');
        $element.classList.add('qr-video-scanner', 'nq-blue-bg');

        /* eslint-disable max-len */
        $element.innerHTML = TemplateTags.noVars`
            <video muted autoplay playsinline width="600" height="600"></video>
            <div class="overlay">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 238 238">
                    <path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" d="M31.3 2H10a8 8 0 0 0-8 8v21.3M206.8 2H228a8 8 0 0 1 8 8v21.3m0 175.4V228a8 8 0 0 1-8 8h-21.3m-175.4 0H10a8 8 0 0 1-8-8v-21.3"/>
                </svg>
            </div>
            <button class="nq-button-s inverse cancel-button" data-i18n="qr-video-scanner-cancel">Cancel</button>

            <div class="camera-access-failed">
                <div class="camera-access-failed-warning no-camera" data-i18n="qr-video-scanner-no-camera">
                    Your device does not have an accessible camera.
                </div>
                <div class="camera-access-failed-warning unblock-camera" data-i18n="qr-video-scanner-enable-camera">
                    Unblock the camera for this website to scan QR codes.
                </div>
            </div>
        `;
        /* eslint-enable max-len */

        I18n.translateDom($element);

        return $element;
    }
}

QrVideoScanner.Events = {
    RESULT: 'qr-video-scanner-result',
    ERROR: 'qr-video-scanner-error',
    CANCEL: 'qr-video-scanner-cancel',
};
