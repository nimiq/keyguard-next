class BrowserDetection { // eslint-disable-line no-unused-vars
    /**
     * @returns {boolean}
     */
    static isDesktopSafari() {
        // see https://stackoverflow.com/a/23522755
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !/mobile/i.test(navigator.userAgent);
    }

    /**
     * @returns {boolean}
     */
    static isSafari() {
        return !!navigator.userAgent.match(/Version\/[\d.]+.*Safari/);
    }

    /**
     * @returns {boolean}
     */
    static isIOS() {
        // @ts-ignore (MSStream is not on window)
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    /**
     * @returns {number[]}
     */
    static iOSVersion() {
        if (BrowserDetection.isIOS()) {
            const v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
            if (v) {
                return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || '0', 10)];
            }
        }

        throw new Error('No iOS version detected');
    }

    /**
     * @returns {boolean}
     */
    static isBadIOS() {
        const version = this.iOSVersion();
        return version[0] < 11 || (version[0] === 11 && version[1] === 2); // Only 11.2 has the WASM bug
    }

    /**
     * @returns {boolean}
     */
    static isMobile() {
        return window.matchMedia('only screen and (max-width: 760px)').matches;
    }

    /**
     * @returns {boolean}
     */
    static isTouchDevice() {
        return (('ontouchstart' in window)
            || (navigator.maxTouchPoints > 0)
            || (navigator.msMaxTouchPoints > 0));
    }
}
