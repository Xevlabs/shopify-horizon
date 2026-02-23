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
 * Enforces wine-specific quantity constraints (min quantity + lot size) on both
 * the product form's quantity selector and the direct add-to-cart buttons.
 *
 * @extends {Component<WineSelectorRefs>}
 */
export default class WineSelector extends Component {
  /** @type {AbortController | undefined} */
  #abortController;

  connectedCallback() {
    super.connectedCallback();

    const bestInput = this.refs.bestOfferInput;
    if (bestInput) {
      this.#selectVariant(bestInput);
    }
  }

  /**
   * Handles clicking "Ajouter au panier" on an alternative seller card.
   * Posts directly to the Cart API with the correct quantity (min_quantity),
   * then dispatches CartAddEvent.
   * @param {MouseEvent} event
   */
  addToCart(event) {
    const button = /** @type {HTMLButtonElement} */ (event.target);
    const variantId = button.dataset.variantId;
    if (!variantId) return;

    const minQuantity = Number(button.dataset.minQuantity) || 1;
    const lotSize = Number(button.dataset.lotSize) || 1;
    const quantity = Math.max(minQuantity, lotSize);

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = '…';

    const body = JSON.stringify({
      items: [{ id: Number(variantId), quantity }],
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
            button.textContent = originalText;
          }, 2000);
          return;
        }

        button.textContent = 'Ajouté !';
        setTimeout(() => {
          button.disabled = false;
          button.textContent = originalText;
        }, 1500);

        this.dispatchEvent(
          new CartAddEvent({}, this.id, {
            source: 'wine-selector',
            itemCount: quantity,
            productId: this.dataset.productId,
            variantId,
          })
        );
      })
      .catch(() => {
        button.disabled = false;
        button.textContent = originalText;
      });
  }

  /**
   * Selects a variant and applies wine quantity constraints to the product form's
   * quantity selector.
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

    // Apply wine quantity constraints to the product form's quantity selector
    this.#applyQuantityConstraints(input);
  }

  /**
   * Reads min_quantity / lot_size from the input's data attributes and applies
   * them to the nearest product-form's quantity selector.
   * @param {HTMLInputElement} input
   */
  #applyQuantityConstraints(input) {
    const minQuantity = Number(input.dataset.minQuantity) || 1;
    const lotSize = Number(input.dataset.lotSize) || 1;

    if (minQuantity <= 1 && lotSize <= 1) return;

    // Find the product-form-component in the same section
    const section = this.closest('.shopify-section') ?? this.closest('product-form-component')?.parentElement;
    /** @type {any} */
    const productForm = section?.querySelector('product-form-component');
    /** @type {any} */
    const quantitySelector = productForm?.refs?.quantitySelector;

    if (!quantitySelector?.updateConstraints) return;

    quantitySelector.updateConstraints(String(minQuantity), null, String(lotSize));
    quantitySelector.setValue(String(minQuantity));
    quantitySelector.updateButtonStates();
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

      // Re-apply constraints after variant update (product-form may have reset them)
      const bestInput = this.refs.bestOfferInput;
      if (bestInput) {
        this.#applyQuantityConstraints(bestInput);
      }
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
