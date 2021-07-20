/* global Nimiq */
/* global I18n */
/* global TemplateTags */
/* global BrowserDetection */

class PasswordInput extends Nimiq.Observable {
    /**
     * @param {?HTMLElement} $el
     * @param {number} [maxLength]
     * @param {string} [placeholder]
     */
    constructor($el, maxLength, placeholder = '••••••••') {
        super();
        this._minLength = PasswordInput.DEFAULT_MIN_LENGTH;
        this._maxLength = maxLength || Infinity;
        this.$el = PasswordInput._createElement($el);

        this.$input = /** @type {HTMLInputElement} */ (this.$el.querySelector('input.password'));
        this.$eyeButton = /** @type {HTMLElement} */ (this.$el.querySelector('.eye-button'));

        this.$input.placeholder = placeholder;

        this.$eyeButton.addEventListener('click', () => {
            this._changeVisibility();
            this.focus();
        });

        this._onInputChanged();
        this.$input.addEventListener('input', () => this._onInputChanged());

        // Scroll parent into view on mobile devices (except iOS) when input is focused and on 'input'
        // to prevent the submit button from being (partially) hidden behind the virtual keyboard
        if (BrowserDetection.isMobile() && BrowserDetection.isTouchDevice() && !BrowserDetection.isIOS()) {
            this.$input.addEventListener('focus', () => setTimeout(() => this.scrollParentIntoView(), 700));
            this.$input.addEventListener('input', () => this.scrollParentIntoView());
        }
    }

    /**
     * @param {?HTMLElement} [$el]
     * @returns {HTMLElement}
     */
    static _createElement($el) {
        $el = $el || document.createElement('form');
        $el.classList.add('password-input');

        /* eslint-disable max-len */
        $el.innerHTML = TemplateTags.noVars`
            <div class="input-container">
                <div class="input-wrapper">
                    <input class="nq-input password" type="password">
                </div>
                <svg class="nq-icon eye-button">
                    <use class="is-visible" xlink:href="../../../node_modules/@nimiq/style/nimiq-style.icons.svg#nq-view-off"/>
                    <use class="not-visible"  xlink:href="../../../node_modules/@nimiq/style/nimiq-style.icons.svg#nq-view"/>
                </svg>
            </div>
        `;
        /* eslint-enable max-len */

        I18n.translateDom($el);
        return $el;
    }

    /** @returns {HTMLElement} @deprecated */
    getElement() {
        return this.$el;
    }

    /** @type {HTMLElement} */
    get element() {
        return this.$el;
    }

    /** @type {HTMLInputElement} */
    get input() {
        return this.$input;
    }

    focus() {
        this.$input.focus();
    }

    reset() {
        this.$input.value = '';
        this._onInputChanged();
    }

    /** @param {boolean} [becomeVisible] */
    _changeVisibility(becomeVisible) {
        becomeVisible = typeof becomeVisible !== 'undefined'
            ? becomeVisible
            : this.$input.getAttribute('type') === 'password';
        this.$input.setAttribute('type', becomeVisible ? 'text' : 'password');
        this.$eyeButton.classList.toggle('visible', becomeVisible);
    }

    _onInputChanged() {
        const passwordLength = this.$input.value.length;
        this.valid = passwordLength >= this._minLength && passwordLength <= this._maxLength;

        this.fire(PasswordInput.Events.LENGTH, passwordLength);
        this.fire(PasswordInput.Events.VALID, this.valid);
    }

    /**
     * @returns {string}
     */
    get text() {
        return this.$input.value;
    }

    /**
     * @param {number} [minLength]
     */
    setMinLength(minLength) {
        this._minLength = minLength || PasswordInput.DEFAULT_MIN_LENGTH;
    }

    scrollParentIntoView() {
        const $parent = this.$el.parentElement;

        if (!$parent) return;

        $parent.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
        });
    }
}

PasswordInput.Events = {
    VALID: 'passwordinput-valid',
    LENGTH: 'passwordinput-length',
};

PasswordInput.DEFAULT_MIN_LENGTH = 8;
