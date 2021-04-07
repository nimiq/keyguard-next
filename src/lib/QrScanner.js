/* eslint-disable prefer-promise-reject-errors, no-throw-literal */
/* global BarcodeDetector */

/**
 * @typedef {{
 *     x?: number,
 *     y?: number,
 *     width?: number,
 *     height?: number,
 *     downScaledWidth?: number,
 *     downScaledHeight?: number,
 * }} RectArea
 */

class QrScanner {
    static async hasCamera() {
        if (!navigator.mediaDevices) return false;
        // note that enumerateDevices can always be called and does not prompt the user for permission. However, device
        // labels are only readable if served via https and an active media stream exists or permanent permission is
        // given. That doesn't matter for us though as we don't require labels.
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'videoinput');
        } catch (error) {
            return false;
        }
    }

    // eslint-disable-next-line valid-jsdoc
    /**
     * @param {HTMLVideoElement} video
     * @param {(result: string) => any} onDecode
     * @param {number | ((error: string) => any)} [canvasSizeOrOnDecodeError]
     * @param {number | ((video: HTMLVideoElement) => RectArea)} [canvasSizeOrCalculateScanRegion]
     * @param {'environment' | 'user'} [preferredFacingMode = 'environment']
     */
    constructor(
        video,
        onDecode,
        canvasSizeOrOnDecodeError,
        canvasSizeOrCalculateScanRegion,
        preferredFacingMode = 'environment',
    ) {
        this.$video = video;
        this.$canvas = document.createElement('canvas');
        this._onDecode = onDecode;
        this._legacyCanvasSize = QrScanner.DEFAULT_CANVAS_SIZE;
        this._preferredFacingMode = preferredFacingMode;
        this._active = false;
        this._paused = false;
        this._flashOn = false;

        if (typeof canvasSizeOrOnDecodeError === 'number') {
            // legacy function signature where the third argument is the canvas size
            this._legacyCanvasSize = canvasSizeOrOnDecodeError;
            console.warn('You\'re using a deprecated version of the QrScanner constructor which will be removed in '
                + 'the future');
        } else if (canvasSizeOrOnDecodeError) {
            this._onDecodeError = canvasSizeOrOnDecodeError;
        }

        if (typeof canvasSizeOrCalculateScanRegion === 'number') {
            // legacy function signature where the fourth argument is the canvas size
            this._legacyCanvasSize = canvasSizeOrCalculateScanRegion;
            console.warn('You\'re using a deprecated version of the QrScanner constructor which will be removed in '
                + 'the future');
        } else if (canvasSizeOrCalculateScanRegion) {
            this._calculateScanRegion = canvasSizeOrCalculateScanRegion;
        }

        this._scanRegion = this._calculateScanRegion(video);

        this._onPlay = this._onPlay.bind(this);
        this._onLoadedMetaData = this._onLoadedMetaData.bind(this);
        this._onVisibilityChange = this._onVisibilityChange.bind(this);

        // Allow inline playback on iPhone instead of requiring full screen playback,
        // see https://webkit.org/blog/6784/new-video-policies-for-ios/
        // @ts-ignore Property 'playsInline' does not exist on type 'HTMLVideoElement'
        this.$video.playsInline = true;
        // Allow play() on iPhone without requiring a user gesture. Should not really be needed as camera stream
        // includes no audio, but just to be safe.
        this.$video.muted = true;
        // @ts-ignore Property 'disablePictureInPicture' does not exist on type 'HTMLVideoElement'
        this.$video.disablePictureInPicture = true;
        this.$video.addEventListener('play', this._onPlay);
        this.$video.addEventListener('loadedmetadata', this._onLoadedMetaData);
        document.addEventListener('visibilitychange', this._onVisibilityChange);

        this._qrEnginePromise = QrScanner.createQrEngine();
    }

    /**
     * @returns {Promise<boolean>}
     */
    async hasFlash() {
        if (!('ImageCapture' in window)) return false;

        const track = this.$video.srcObject && this.$video.srcObject instanceof MediaStream
            ? this.$video.srcObject.getVideoTracks()[0]
            : null;

        if (!track) {
            throw 'Camera not started or not available';
        }

        try {
            // @ts-ignore Cannot find name 'ImageCapture'
            const imageCapture = new ImageCapture(track);
            const result = await imageCapture.getPhotoCapabilities();
            return result.fillLightMode.includes('flash');
        } catch (error) {
            console.warn(error);
            return false;
        }
    }

    isFlashOn() {
        return this._flashOn;
    }

    async toggleFlash() {
        return this._setFlash(!this._flashOn);
    }

    async turnFlashOff() {
        return this._setFlash(false);
    }

    async turnFlashOn() {
        return this._setFlash(true);
    }

    destroy() {
        this.$video.removeEventListener('loadedmetadata', this._onLoadedMetaData);
        this.$video.removeEventListener('play', this._onPlay);
        document.removeEventListener('visibilitychange', this._onVisibilityChange);

        this.stop();
        QrScanner._postWorkerMessage(this._qrEnginePromise, 'close');
    }

    async start() {
        if (this._active && !this._paused) return;

        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            // warn but try starting the camera anyways
            console.warn('The camera stream is only accessible if the page is transferred via https.');
        }
        this._active = true;
        this._paused = false;
        if (document.hidden) return; // camera will be started as soon as tab is in foreground

        window.clearTimeout(this._offTimeout);
        this._offTimeout = undefined;
        if (this.$video.srcObject) {
            // camera stream already/still set
            this.$video.play();
            return;
        }

        try {
            let facingMode = this._preferredFacingMode;
            /** @type {MediaStream} */
            let stream;
            try {
                stream = await this._getCameraStream(facingMode, true);
            } catch (error) {
                // We (probably) don't have a camera of the requested facing mode
                facingMode = facingMode === 'environment' ? 'user' : 'environment';
                stream = await this._getCameraStream(); // throws if camera is not accessible (e.g. due to not https)
            }

            // Try to determine the facing mode from the stream, otherwise use our guess. Note that the guess is not
            // always accurate as Safari returns cameras of different facing mode, even for exact constraints.
            facingMode = this._getFacingMode(stream) || facingMode;
            this.$video.srcObject = stream;
            this.$video.play();
            this._setVideoMirror(facingMode);
        } catch (error) {
            this._active = false;
            throw error;
        }
    }

    stop() {
        this.pause();
        this._active = false;
    }

    pause() {
        this._paused = true;
        if (!this._active) {
            return;
        }
        this.$video.pause();
        if (this._offTimeout) {
            return;
        }
        this._offTimeout = window.setTimeout(() => {
            const tracks = this.$video.srcObject && this.$video.srcObject instanceof MediaStream
                ? this.$video.srcObject.getTracks()
                : [];
            for (const track of tracks) {
                track.stop(); //  note that this will also automatically turn the flashlight off
            }
            this.$video.srcObject = null;
            this._offTimeout = undefined;
        }, 300);
    }

    /**
     * @param {HTMLImageElement | HTMLVideoElement | string} imageOrFileOrUrl
     * @param {RectArea} [scanRegion]
     * @param {Promise<Worker>} [givenEngine] // TODO: Or BarcodeDetector
     * @param {HTMLCanvasElement} [givenCanvas]
     * @param {boolean} [fixedCanvasSize = false]
     * @param {boolean} [alsoTryWithoutScanRegion = false]
     * @returns {Promise<string>}
     */
    static scanImage(
        imageOrFileOrUrl,
        scanRegion,
        givenEngine,
        givenCanvas,
        fixedCanvasSize = false,
        alsoTryWithoutScanRegion = false,
    ) {
        const qrEngine = givenEngine || QrScanner.createQrEngine();

        let promise = Promise.all([
            qrEngine,
            QrScanner._loadImage(imageOrFileOrUrl),
        ]).then(([engine, image]) => {
            const [canvas, canvasContext] = this._drawToCanvas(image, scanRegion, givenCanvas, fixedCanvasSize);

            if (engine instanceof Worker) {
                return new Promise((resolve, reject) => {
                    /** @type {(error: string | ErrorEvent) => any} */
                    let onError;

                    /** @type {number} */
                    let timeout;

                    /** @param {MessageEvent} event */
                    const onMessage = event => {
                        if (event.data.type !== 'qrResult') {
                            return;
                        }
                        engine.removeEventListener('message', onMessage);
                        engine.removeEventListener('error', onError);
                        window.clearTimeout(timeout);
                        if (event.data.data !== null) {
                            resolve(event.data.data);
                        } else {
                            reject(QrScanner.NO_QR_CODE_FOUND);
                        }
                    };

                    /** @param {string | ErrorEvent} e */
                    onError = e => {
                        engine.removeEventListener('message', onMessage);
                        engine.removeEventListener('error', onError);
                        window.clearTimeout(timeout);
                        const errorMessage = !e // eslint-disable-line no-nested-ternary
                            ? 'Unknown Error'
                            : (e instanceof Error ? e.message : e);
                        reject(`Scanner error: ${errorMessage}`);
                    };

                    engine.addEventListener('message', onMessage);
                    engine.addEventListener('error', onError);
                    timeout = window.setTimeout(() => onError('timeout'), 10000);

                    const imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
                    engine.postMessage({
                        type: 'decode',
                        data: imageData,
                    }, [imageData.data.buffer]);
                });
            }
            return new Promise((resolve, reject) => {
                /** @type {any} */ // TODO: BarcodeDetector
                const decoder = engine;

                const timeout = window.setTimeout(() => reject('Scanner error: timeout'), 10000);
                /** @param {string[]} scanResults */
                decoder.detect(canvas).then(/** @param {{rawValue: string}[]} scanResults */ scanResults => {
                    if (!scanResults.length) {
                        reject(QrScanner.NO_QR_CODE_FOUND);
                    } else {
                        resolve(scanResults[0].rawValue);
                    }
                })
                    .catch(/** @param {string | Error} e */ e => {
                        reject(`Scanner error: ${e instanceof Error ? e.message : e}`);
                    })
                    .finally(() => window.clearTimeout(timeout));
            });
        });

        if (scanRegion && alsoTryWithoutScanRegion) {
            promise = promise.catch(() => QrScanner.scanImage(
                imageOrFileOrUrl,
                undefined,
                givenEngine,
                givenCanvas,
                fixedCanvasSize,
                false,
            ));
        }

        promise = promise.finally(async () => {
            if (givenEngine) return;
            QrScanner._postWorkerMessage(qrEngine, 'close').catch(() => {});
        });

        return promise;
    }

    /**
     *
     * @param {string} [workerPath]
     * @returns {Promise<Worker>} // TODO: Or BarcodeDetector
     */
    static async createQrEngine(workerPath = QrScanner.WORKER_PATH) {
        // @ts-ignore Cannot find name 'BarcodeDetector'
        if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
            // @ts-ignore Cannot find name 'BarcodeDetector'
            return new BarcodeDetector({ formats: ['qr_code'] });
        }

        return new Worker(workerPath);
    }

    _onPlay() {
        this._scanRegion = this._calculateScanRegion(this.$video);
        this._scanFrame();
    }

    _onLoadedMetaData() {
        this._scanRegion = this._calculateScanRegion(this.$video);
    }

    _onVisibilityChange() {
        if (document.hidden) {
            this.pause();
        } else if (this._active) {
            this.start();
        }
    }

    /**
     * @param {HTMLVideoElement} video
     * @returns {RectArea}
     */
    _calculateScanRegion(video) {
        // Default scan region calculation. Note that this can be overwritten in the constructor.
        const smallestDimension = Math.min(video.videoWidth, video.videoHeight);
        const scanRegionSize = Math.round(2 / 3 * smallestDimension);
        return {
            x: (video.videoWidth - scanRegionSize) / 2,
            y: (video.videoHeight - scanRegionSize) / 2,
            width: scanRegionSize,
            height: scanRegionSize,
            downScaledWidth: this._legacyCanvasSize,
            downScaledHeight: this._legacyCanvasSize,
        };
    }

    _scanFrame() {
        if (!this._active || this.$video.paused || this.$video.ended) return;
        // using requestAnimationFrame to avoid scanning if tab is in background
        requestAnimationFrame(async () => {
            if (this.$video.readyState <= 1) {
                // Skip scans until the video is ready as drawImage() only works correctly on a video with readyState
                // > 1, see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage#Notes.
                // This also avoids false positives for videos paused after a successful scan which remains visible on
                // the canvas until the video is started again and ready.
                this._scanFrame();
                return;
            }
            /** @type {string | undefined} */
            let result;
            try {
                result = await QrScanner.scanImage(
                    this.$video,
                    this._scanRegion,
                    this._qrEnginePromise,
                    this.$canvas,
                    /* fixedCanvasSize */ true,
                    /* alsoTryWitoutScanRegion */ false,
                );
            } catch (error) {
                if (!this._active) return;
                const errorMessage = error.message || error;
                if (errorMessage.includes('service unavailable')) {
                    // When the native BarcodeDetector crashed, create a new one
                    this._qrEnginePromise = QrScanner.createQrEngine();
                }
                this._onDecodeError(error);
            }

            if (result) {
                this._onDecode(result);
            }

            this._scanFrame();
        });
    }

    /**
     * @param {string} error
     */
    _onDecodeError(error) {
        // default error handler; can be overwritten in the constructor
        if (error === QrScanner.NO_QR_CODE_FOUND) return;
        console.log(error);
    }

    /**
     * @param {'environment' | 'user'} [facingMode]
     * @param {boolean} [exact = false]
     * @returns {Promise<MediaStream>}
     */
    _getCameraStream(facingMode, exact = false) {
        /** @type {MediaTrackConstraints[]} */
        const constraintsToTry = [{
            width: { min: 1024 },
        }, {
            width: { min: 768 },
        }, {}];

        if (facingMode) {
            if (exact) {
                const exactFacingMode = { exact: facingMode };
                constraintsToTry.forEach(constraint => {
                    constraint.facingMode = exactFacingMode;
                });
            } else {
                constraintsToTry.forEach(constraint => {
                    constraint.facingMode = facingMode;
                });
            }
        }
        return this._getMatchingCameraStream(constraintsToTry);
    }

    /**
     *
     * @param {MediaTrackConstraints[]} constraintsToTry
     * @returns {Promise<MediaStream>}
     */
    _getMatchingCameraStream(constraintsToTry) {
        if (!navigator.mediaDevices || constraintsToTry.length === 0) {
            return Promise.reject('Camera not found.');
        }
        return navigator.mediaDevices.getUserMedia({
            video: constraintsToTry.shift(),
        }).catch(() => this._getMatchingCameraStream(constraintsToTry));
    }

    /**
     * @param {boolean} on
     * @returns {Promise<void>}
     */
    async _setFlash(on) {
        const hasFlash = await this.hasFlash();

        if (!hasFlash) throw 'No flash available';

        // Note that the video track is guaranteed to exist at this point
        await /** @type {MediaStream} */ (this.$video.srcObject).getVideoTracks()[0].applyConstraints({
            // @ts-ignore Type '{ torch: boolean; }' is not assignable to type 'MediaTrackConstraintSet'
            advanced: [{ torch: on }],
        });

        this._flashOn = on;
    }

    /**
     * @param {'environment' | 'user'} facingMode
     */
    _setVideoMirror(facingMode) {
        // in user facing mode mirror the video to make it easier for the user to position the QR code
        const scaleFactor = facingMode === 'user' ? -1 : 1;
        this.$video.style.transform = `scaleX(${scaleFactor})`;
    }

    /**
     * @param {MediaStream} videoStream
     * @returns {'environment' | 'user' | null}
     */
    _getFacingMode(videoStream) {
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return null; // unknown
        // inspired by https://github.com/JodusNodus/react-qr-reader/blob/master/src/getDeviceId.js#L13
        if (/rear|back|environment/i.test(videoTrack.label)) return 'environment';
        if (/front|user|face/i.test(videoTrack.label)) return 'user';
        return null; // unknown
    }

    /**
     * @param {HTMLImageElement | HTMLVideoElement} image
     * @param {RectArea?} scanRegion
     * @param {HTMLCanvasElement?} canvas
     * @param {boolean} [fixedCanvasSize = false]
     * @returns {[HTMLCanvasElement, CanvasRenderingContext2D]}
     */
    static _drawToCanvas(image, scanRegion = null, canvas = null, fixedCanvasSize = false) {
        canvas = canvas || document.createElement('canvas');
        const scanRegionX = scanRegion && scanRegion.x ? scanRegion.x : 0;
        const scanRegionY = scanRegion && scanRegion.y ? scanRegion.y : 0;
        const scanRegionWidth = scanRegion && scanRegion.width
            ? scanRegion.width
            : image.width || /** @type {HTMLVideoElement} */ (image).videoWidth;
        const scanRegionHeight = scanRegion && scanRegion.height
            ? scanRegion.height
            : image.height || /** @type {HTMLVideoElement} */ (image).videoHeight;
        if (!fixedCanvasSize) {
            canvas.width = scanRegion && scanRegion.downScaledWidth
                ? scanRegion.downScaledWidth
                : scanRegionWidth;
            canvas.height = scanRegion && scanRegion.downScaledHeight
                ? scanRegion.downScaledHeight
                : scanRegionHeight;
        }
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw 'Unable to get canvas context';
        context.imageSmoothingEnabled = false; // gives less blurry images
        context.drawImage(
            image,
            scanRegionX, scanRegionY, scanRegionWidth, scanRegionHeight,
            0, 0, canvas.width, canvas.height,
        );
        return [canvas, context];
    }

    /**
     * @param {HTMLImageElement | HTMLVideoElement | string} imageOrVideoOrUrl
     * @returns {Promise<HTMLImageElement | HTMLVideoElement>}
     */
    static async _loadImage(imageOrVideoOrUrl) {
        if (imageOrVideoOrUrl instanceof HTMLVideoElement) {
            return imageOrVideoOrUrl;
        }

        /** @type {HTMLImageElement} */
        let image;
        if (imageOrVideoOrUrl instanceof HTMLImageElement) {
            image = imageOrVideoOrUrl;
        } else {
            image = new Image();
            image.src = imageOrVideoOrUrl;
        }
        await QrScanner._awaitImageLoad(image);
        return image;
    }

    /**
     * @param {HTMLImageElement} image
     * @returns {Promise<void>}
     */
    static async _awaitImageLoad(image) {
        if (image.complete && image.naturalWidth !== 0) {
            // already loaded
            return;
        }
        await new Promise((resolve, reject) => {
            /** @type {EventListener} */
            let onError;
            const onLoad = () => { // eslint-disable-line require-jsdoc-except/require-jsdoc
                image.removeEventListener('load', onLoad);
                image.removeEventListener('error', onError);
                resolve(undefined);
            };
            onError = () => {
                image.removeEventListener('load', onLoad);
                image.removeEventListener('error', onError);
                reject('Image load error');
            };
            image.addEventListener('load', onLoad);
            image.addEventListener('error', onError);
        });
    }

    /**
     * @param {Worker | Promise<Worker>} qrEngineOrQrEnginePromise
     * @param {string} type
     * @param {any} [data]
     * @returns {Promise<void>}
     */
    static async _postWorkerMessage(qrEngineOrQrEnginePromise, type, data) {
        const qrEngine = await qrEngineOrQrEnginePromise;
        if (!(qrEngine instanceof Worker)) return;
        qrEngine.postMessage({ type, data });
    }
}
QrScanner.DEFAULT_CANVAS_SIZE = 400;
QrScanner.NO_QR_CODE_FOUND = 'No QR code found';
QrScanner.WORKER_PATH = '../../lib/QrScannerWorker.js';
