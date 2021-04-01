/* global Nimiq */
/* global I18n */
/* global QrScanner */
/* global TemplateTags */

class QrVideoScanner extends Nimiq.Observable {
    /**
     * @param {HTMLDivElement} [$el]
     */
    constructor($el) {
        super();

        this._isRepositioningOverlay = false;

        this.$el = QrVideoScanner._createElement($el);

        /** @type {HTMLVideoElement} */
        const $video = (this.$el.querySelector('video'));

        /** @type {HTMLDivElement} */
        this.$overlay = (this.$el.querySelector('.overlay'));

        /** @type {HTMLButtonElement} */
        const $cancelButton = (this.$el.querySelector('.cancel-button'));

        // this.$el.addEventListener('click', () => this.copy());
        this._scanner = new QrScanner($video, result => this._onResult(result));

        $cancelButton.addEventListener('click', () => this.fire(QrVideoScanner.Events.CANCEL));
    }

    async start() {
        try {
            await this._scanner.start();
            // this.cameraAccessFailed = false;
            // if (this._cameraRetryTimer) {
            //     window.clearInterval(this._cameraRetryTimer);
            //     this._cameraRetryTimer = null;
            // }
        } catch (error) {
            // this.cameraAccessFailed = true;
            this.fire(QrVideoScanner.Events.ERROR, typeof error === 'string' ? new Error(error) : error);
            // if (!this._cameraRetryTimer) {
            //     this._cameraRetryTimer = window.setInterval(() => this.start(), 3000);
            // }
        }
        // return !this.cameraAccessFailed;
    }

    /**
     * @param {string} result
     */
    _onResult(result) {
        // if ((result === this._lastResult && Date.now() - this._lastResultTime < this.reportFrequency)
        //     || (this.validate && !this.validate(result))) return;
        // this._lastResult = result;
        // this._lastResultTime = Date.now();
        this.fire(QrVideoScanner.Events.RESULT, result);
    }

    stop() {
        this._scanner.stop();
        // if (this._cameraRetryTimer) {
        //     window.clearInterval(this._cameraRetryTimer);
        //     this._cameraRetryTimer = null;
        // }
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

    // copy() {
    //     ClipboardUtils.copy(this._text);

    //     window.clearTimeout(this._copiedResetTimeout);
    //     this.$el.classList.add('copied', 'show-tooltip');
    //     this._copiedResetTimeout = window.setTimeout(
    //         () => this.$el.classList.remove('copied', 'show-tooltip'),
    //         QrVideoScanner.DISPLAY_TIME,
    //     );
    // }

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
