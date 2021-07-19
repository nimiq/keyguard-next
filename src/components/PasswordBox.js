/* global AnimationUtils */
/* global Nimiq */
/* global I18n */
/* global PasswordInput */
/* global TemplateTags */
/* global Key */

/**
 *  @typedef {{
 *      bgColor: string,
 *      hideInput: boolean,
 *      buttonI18nTag: string,
 *      minLength: number,
 *      showResetPassword: boolean,
 *  }} PasswordBoxOptions
 */

class PasswordBox extends Nimiq.Observable {
    // eslint-disable-next-line valid-jsdoc
    /**
     * @param {HTMLFormElement} [$el]
     * @param {Partial<PasswordBoxOptions>} [options]
     */
    constructor($el, options = {}) {
        const defaults = {
            bgColor: 'light-blue',
            hideInput: false,
            buttonI18nTag: 'passwordbox-confirm-tx',
            minLength: PasswordInput.DEFAULT_MIN_LENGTH,
            showResetPassword: false,
        };

        super();

        /** @type {PasswordBoxOptions} */
        this.options = Object.assign(defaults, options);

        this.$el = PasswordBox._createElement($el, this.options);

        this.$el.classList.toggle('hide-input', this.options.hideInput);

        this._passwordInput = new PasswordInput(this.$el.querySelector('[password-input]'));
        this._passwordInput.on(PasswordInput.Events.VALID, isValid => this._onInputChangeValidity(isValid));

        this.setMinLength(this.options.minLength);

        this._isInputValid = false;

        this.$el.addEventListener('submit', event => this._onSubmit(event));

        if (options.showResetPassword) {
            /** @type {HTMLAnchorElement} */
            (this.$el.querySelector('.skip')).addEventListener('click', /** @param {Event} event */ event => {
                event.preventDefault();
                this.fire(PasswordBox.Events.RESET_PASSWORD);
            });
        }
    }

    /**
     * @param {HTMLFormElement} [$el]
     * @param {PasswordBoxOptions} options
     * @returns {HTMLFormElement}
     */
    static _createElement($el, options) {
        $el = $el || document.createElement('form');
        $el.classList.add('password-box', 'actionbox');
        if (!options.hideInput) $el.classList.add(`nq-${options.bgColor}-bg`);

        // To enable i18n validation with the dynamic nature of the password box's contents,
        // all possible i18n tags and texts have to be specified here in the below format to
        // enable the validator to find them with its regular expression.
        /* eslint-disable max-len */
        /** @type {{[i18nTag: string]: string}} */
        const buttonVersions = {
            'passwordbox-continue': '<button class="submit" data-i18n="passwordbox-continue">Continue</button>',
            'passwordbox-confirm': '<button class="submit" data-i18n="passwordbox-confirm">Confirm</button>',
            'passwordbox-log-in': '<button class="submit" data-i18n="passwordbox-log-in">Unlock</button>',
            'passwordbox-log-out': '<button class="submit" data-i18n="passwordbox-log-out">Confirm logout</button>',
            'passwordbox-confirm-tx': '<button class="submit" data-i18n="passwordbox-confirm-tx">Confirm transaction</button>',
            'passwordbox-create-cashlink': '<button class="submit" data-i18n="passwordbox-create-cashlink">Create cashlink</button>',
            'passwordbox-show-words': '<button class="submit" data-i18n="passwordbox-show-words">Show recovery words</button>',
            'passwordbox-sign-msg': '<button class="submit" data-i18n="passwordbox-sign-msg">Sign message</button>',
            'passwordbox-confirm-swap': '<button class="submit" data-i18n="passwordbox-confirm-swap">Confirm swap</button>',
        };

        const resetPasswordHtml = options.showResetPassword
            ? TemplateTags.noVars`
                <a href="#" class="skip nq-link">
                    <span data-i18n="passwordbox-reset-password">Reset with Recovery Words</span>
                    <svg class="nq-icon">
                        <use xlink:href="../../../node_modules/@nimiq/style/nimiq-style.icons.svg#nq-caret-right-small"/>
                    </svg>
                <a>`
            : '';

        /** @type {{[i18nTag: string]: string}} */
        const promptVersions = {
            'passwordbox-enter-password': '<div class="prompt nq-text-s" data-i18n="passwordbox-enter-password">Enter your password</div>',
            'passwordbox-enter-pin': '<div class="prompt nq-text-s" data-i18n="passwordbox-enter-pin">Enter your PIN</div>',
        };
        /* eslint-enable max-len */

        if (!buttonVersions[options.buttonI18nTag]) throw new Error('PasswordBox button i18n tag not defined');

        /* eslint-disable max-len */
        $el.innerHTML = TemplateTags.hasVars(3)`
            ${promptVersions[options.minLength === Key.PIN_LENGTH ? 'passwordbox-enter-pin' : 'passwordbox-enter-password']}
            <div password-input></div>
            ${buttonVersions[options.buttonI18nTag]}
            <!-- Loading spinner SVG -->
            <svg height="48" width="54" color="inherit" class="loading-spinner"><g>
                <path class="big-hex" d="M51.9,21.9L41.3,3.6c-0.8-1.3-2.2-2.1-3.7-2.1H16.4c-1.5,0-2.9,0.8-3.7,2.1L2.1,21.9c-0.8,1.3-0.8,2.9,0,4.2 l10.6,18.3c0.8,1.3,2.2,2.1,3.7,2.1h21.3c1.5,0,2.9-0.8,3.7-2.1l10.6-18.3C52.7,24.8,52.7,23.2,51.9,21.9z" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.4" stroke-dasharray="92.5 60"/>
                <path class="small-hex" d="M51.9,21.9L41.3,3.6c-0.8-1.3-2.2-2.1-3.7-2.1H16.4c-1.5,0-2.9,0.8-3.7,2.1L2.1,21.9c-0.8,1.3-0.8,2.9,0,4.2 l10.6,18.3c0.8,1.3,2.2,2.1,3.7,2.1h21.3c1.5,0,2.9-0.8,3.7-2.1l10.6-18.3C52.7,24.8,52.7,23.2,51.9,21.9z" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="47.5 105"/>
            </g></svg>
            ${resetPasswordHtml}
        `;
        /* eslint-enable max-len */

        /** @type {HTMLButtonElement} */
        ($el.querySelector('button.submit')).classList.add('nq-button', options.bgColor);
        if (!options.hideInput) {
            /** @type {HTMLButtonElement} */
            ($el.querySelector('button.submit')).classList.add('inverse');
        }

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

    focus() {
        if (!this.options.hideInput) {
            this._passwordInput.focus();
        }
    }

    reset() {
        this._passwordInput.reset();
    }

    /**
     * @param {number} [minLength]
     */
    setMinLength(minLength) {
        this._passwordInput.setMinLength(minLength);
    }

    /**
     * @returns {Promise<void>}
     */
    async onPasswordIncorrect() {
        await AnimationUtils.animate('shake', this.$el);
        this._passwordInput.reset();
        this._passwordInput.focus();
    }

    /**
     * @param {boolean} isValid
     */
    _onInputChangeValidity(isValid) {
        this._isInputValid = isValid;
        this.$el.classList.toggle('input-eligible', isValid);
    }

    /**
     * @param {Event} event
     */
    _onSubmit(event) {
        event.preventDefault();
        if (!this.options.hideInput && !this._isInputValid) return;

        const password = !this.options.hideInput ? this._passwordInput.text : undefined;
        this.fire(PasswordBox.Events.SUBMIT, password);
        this._passwordInput.reset();
    }

    /**
     * @param {boolean} hidden
     */
    hideInput(hidden) {
        this.options.hideInput = hidden;
        this.$el.classList.toggle('hide-input', hidden);
        this.$el.classList.toggle(`nq-${this.options.bgColor}-bg`, !hidden);
        /** @type {HTMLElement} */
        (this.$el.querySelector('button.submit')).classList.toggle('inverse', !hidden);
    }
}

PasswordBox.Events = {
    SUBMIT: 'passwordbox-submit',
    RESET_PASSWORD: 'passwordbox-reset-password',
};
