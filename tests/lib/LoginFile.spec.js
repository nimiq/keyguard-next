/* global Nimiq */
/* global Dummy */
/* global LoginFile */
/* global QrScanner */

describe('LoginFile', () => {

    beforeAll(() => {
        I18n.initialize(window.TRANSLATIONS, 'en');
    });

    it('can generate a Login File', async () => {
        const entropy = new Nimiq.Entropy(Dummy.keys[0]);

        self.NIMIQ_IQONS_SVG_PATH = '/base/src/assets/Iqons.min.svg';

        const loginFile = new LoginFile(entropy.toBase64());
        const dataUrl = await loginFile.toDataUrl();
        expect(typeof dataUrl === 'string' && dataUrl.length > 100).toBe(true);
    });

    it('can read a generated Login File', async () => {
        const entropy = new Nimiq.Entropy(Dummy.keys[0]);

        const serializedKey = entropy.toBase64();
        const loginFile = new LoginFile(serializedKey, 2);
        const dataUrl = await loginFile.toObjectUrl();

        /** @type {HTMLImageElement} */
        const $img = await new Promise(resolve => {
            const _$img = new Image();
            _$img.onload = () => resolve(_$img);
            _$img.src = dataUrl;
        });

        // const file = new File([await fetch(dataUrl).then(r => r.blob())], 'LoginFile.png');

        const qrPosition = LoginFile.calculateQrPosition();

        QrScanner.WORKER_PATH = '/base/src/lib/QrScannerWorker.js';
        const decoded = await QrScanner.scanImage($img, qrPosition, undefined, undefined, true);
        expect(decoded).toEqual(serializedKey);
    });
});
