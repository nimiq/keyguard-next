/* global Nimiq */
/* global I18n */
/* global TemplateTags */

class TabWidthSelector extends Nimiq.Observable {
    /**
     * @param {?HTMLElement} $el
     */
    constructor($el) {
        super();

        this.$el = TabWidthSelector._createElement($el);

        // Load last used width from localStorage.
        try {
            /** @type {string} */
            this._tabWidth = localStorage.getItem(TabWidthSelector.LOCALSTORAGE_KEY) || '';
        } catch (error) {
            // Ignore
        }
        this._tabWidth = this._tabWidth || TabWidthSelector.DEFAULT_TAB_WIDTH;
        this._updateClasses();

        this.$width2Button = /** @type {HTMLButtonElement} */ (this.$el.querySelector('button[data-width="2"]'));
        this.$width4Button = /** @type {HTMLButtonElement} */ (this.$el.querySelector('button[data-width="4"]'));
        this.$width8Button = /** @type {HTMLButtonElement} */ (this.$el.querySelector('button[data-width="8"]'));

        this._onSelection = this._onSelection.bind(this);

        this.$width2Button.addEventListener('click', this._onSelection);
        this.$width4Button.addEventListener('click', this._onSelection);
        this.$width8Button.addEventListener('click', this._onSelection);
    }

    /**
     * @param {?HTMLElement} [$el]
     * @returns {HTMLElement}
     */
    static _createElement($el) {
        $el = $el || document.createElement('div');
        $el.classList.add('tab-width-selector');

        /* eslint-disable max-len */
        $el.innerHTML = TemplateTags.noVars`
            <span data-i18n="tab-width-selector-label">Tab Width</span>
            <button class="nq-button-s" data-width="2">2</button>
            <button class="nq-button-s" data-width="4">4</button>
            <button class="nq-button-s" data-width="8">8</button>
        `;
        /* eslint-enable max-len */

        I18n.translateDom($el);
        return $el;
    }

    get width() {
        return this._tabWidth;
    }

    /**
     * @param {Event} event
     */
    _onSelection(event) {
        if (!event.target) return;
        const width = /** @type {HTMLButtonElement} */ (event.target).dataset.width;
        if (!width) return; // For Typescript, as the width could be 'undefined' in the dataset
        this._updateWidth(width);
    }

    /**
     * @param {string} width
     */
    _updateWidth(width) {
        this._tabWidth = width;
        this._updateClasses();
        try {
            localStorage.setItem(TabWidthSelector.LOCALSTORAGE_KEY, this._tabWidth);
        } catch (error) {
            // Ignore
        }
        this.fire(TabWidthSelector.Events.INPUT, this._tabWidth);
    }

    _updateClasses() {
        this.$el.classList.remove('width-2', 'width-4', 'width-8');
        this.$el.classList.add(`width-${this._tabWidth}`);
    }
}

TabWidthSelector.LOCALSTORAGE_KEY = 'tab-width';
TabWidthSelector.DEFAULT_TAB_WIDTH = '4';

TabWidthSelector.Events = {
    INPUT: 'tabwidthselector-input',
};
