import { Component } from '@theme/component';
import { VariantSelectedEvent, VariantUpdateEvent } from '@theme/events';
import { morph, MORPH_OPTIONS } from '@theme/morph';

/**
 * @typedef {object} WineSelectorRefs
 * @property {HTMLInputElement[]} cards - The radio input elements for each seller card.
 */

/**
 * A custom element that manages a wine seller variant picker.
 * Each seller corresponds to a product variant. Clicking a seller card
 * selects that variant and dispatches the same events as the standard variant-picker.
 *
 * @extends {Component<WineSelectorRefs>}
 */
export default class WineSelector extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('change', this.#onSellerChanged);
  }

  /**
   * Handles a seller card being selected.
   * @param {Event} event
   */
  #onSellerChanged = (event) => {
    if (!(event.target instanceof HTMLInputElement)) return;

    const selectedInput = event.target;
    const optionValueId = selectedInput.dataset.optionValueId ?? '';

    this.dispatchEvent(new VariantSelectedEvent({ id: optionValueId }));

    this.#fetchUpdatedSection(optionValueId);

    const variantId = selectedInput.dataset.variantId;
    if (variantId && this.dataset.templateProductMatch === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variantId);
      if (url.href !== window.location.href) {
        history.replaceState({}, '', url.toString());
      }
    }
  };

  /**
   * Fetches updated section HTML and morphs the component.
   * @param {string} optionValueId - The selected option value ID.
   */
  async #fetchUpdatedSection(optionValueId) {
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    const productUrl = this.dataset.productUrl;
    const requestUrl = `${productUrl}?option_values=${optionValueId}`;

    try {
      const response = await fetch(requestUrl, { signal: this.#abortController.signal });
      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');

      const jsonScript = html.querySelector('wine-selector-component script[type="application/json"]');
      const textContent = jsonScript?.textContent;
      if (!textContent) return;

      const variant = JSON.parse(textContent);

      const newSource = html.querySelector('wine-selector-component');
      if (newSource) {
        this.dataset.productId = newSource instanceof HTMLElement ? newSource.dataset.productId : this.dataset.productId;
        this.dataset.productUrl = newSource instanceof HTMLElement ? newSource.dataset.productUrl : this.dataset.productUrl;

        morph(this, newSource, {
          ...MORPH_OPTIONS,
          getNodeKey: (node) => {
            if (!(node instanceof HTMLElement)) return undefined;
            return node.dataset.key;
          },
        });
      }

      this.dispatchEvent(
        new VariantUpdateEvent(variant, optionValueId, {
          html,
          productId: this.dataset.productId ?? '',
        })
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Fetch aborted');
      } else {
        console.error(error);
      }
    }
  }
}

if (!customElements.get('wine-selector-component')) {
  customElements.define('wine-selector-component', WineSelector);
}
