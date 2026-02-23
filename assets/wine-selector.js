import { Component } from '@theme/component';
import { VariantSelectedEvent, VariantUpdateEvent, CartAddEvent } from '@theme/events';

/**
 * @typedef {object} WineSelectorRefs
 * @property {HTMLInputElement} bestOfferInput - The hidden radio for the best offer (auto-selected).
 * @property {HTMLElement} otherSellers - The details element wrapping other sellers.
 * @property {HTMLButtonElement[]} addToCartButtons - Add-to-cart buttons on alternative seller cards.
 */

/**
 * Wine seller variant picker component.
 *
 * Default state: the best offer variant is selected and the existing buy-buttons
 * block handles add-to-cart. A <details> toggle reveals other sellers, each with
 * their own add-to-cart button that posts directly to the Cart API.
 *
 * @extends {Component<WineSelectorRefs>}
 */
export default class WineSelector extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  connectedCallback() {
    super.connectedCallback();

    // Select the best-offer variant on first load so product-form picks it up
    const bestInput = this.refs.bestOfferInput;
    if (bestInput) {
      this.#selectVariant(bestInput);
    }
  }

  /**
   * Handles clicking "Ajouter au panier" on an alternative seller card.
   * Posts directly to the Cart API then dispatches CartAddEvent.
   * @param {MouseEvent} event
   */
  addToCart(event) {
    const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
    const variantId = button.dataset.variantId;
    if (!variantId) return;

    button.disabled = true;
    button.textContent = '…';

    const body = JSON.stringify({
      items: [{ id: Number(variantId), quantity: 1 }],
    });

    fetch(Theme.routes.cart_add_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    })
      .then((response) => response.json())
      .then((response) => {
        if (response.status) {
          button.textContent = 'Erreur';
          setTimeout(() => {
            button.disabled = false;
            button.textContent = 'Ajouter au panier';
          }, 2000);
          return;
        }

        button.textContent = 'Ajouté !';
        setTimeout(() => {
          button.disabled = false;
          button.textContent = 'Ajouter au panier';
        }, 1500);

        this.dispatchEvent(
          new CartAddEvent({}, this.id, {
            source: 'wine-selector',
            itemCount: 1,
            productId: this.dataset.productId,
            variantId,
          })
        );
      })
      .catch(() => {
        button.disabled = false;
        button.textContent = 'Ajouter au panier';
      });
  }

  /**
   * Selects a variant by dispatching events and fetching updated section HTML.
   * Used for the best-offer on initial load.
   * @param {HTMLInputElement} input
   */
  #selectVariant(input) {
    const optionValueId = input.dataset.optionValueId ?? '';

    this.dispatchEvent(new VariantSelectedEvent({ id: optionValueId }));
    this.#fetchUpdatedSection(optionValueId);

    const variantId = input.dataset.variantId;
    if (variantId && this.dataset.templateProductMatch === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variantId);
      if (url.href !== window.location.href) {
        history.replaceState({}, '', url.toString());
      }
    }
  }

  /**
   * Fetches updated section HTML and dispatches VariantUpdateEvent.
   * @param {string} optionValueId
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

      this.dispatchEvent(
        new VariantUpdateEvent(variant, optionValueId, {
          html,
          productId: this.dataset.productId ?? '',
        })
      );
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
      }
    }
  }
}

if (!customElements.get('wine-selector-component')) {
  customElements.define('wine-selector-component', WineSelector);
}
