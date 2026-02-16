import { useEffect, useRef, useState } from 'react';
import type { FidelityModel } from '../state/use-fidelity-state';

type StripeCardElement = {
  mount: (element: HTMLElement) => void;
  unmount: () => void;
  destroy: () => void;
};

type StripeElements = {
  create: (type: 'card', options?: Record<string, string>) => StripeCardElement;
};

type StripeConfirmResult = {
  error?: {
    message?: string;
  };
  setupIntent?: {
    status?: string;
    payment_method?: string | null;
  };
};

type StripeInstance = {
  elements: () => StripeElements;
  confirmCardSetup: (
    clientSecret: string,
    payload: {
      payment_method: {
        card: StripeCardElement;
        billing_details: {
          name: string;
          email: string;
        };
      };
    }
  ) => Promise<StripeConfirmResult>;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

let stripeScriptPromise: Promise<void> | null = null;

function loadStripeScript(): Promise<void> {
  if (stripeScriptPromise) {
    return stripeScriptPromise;
  }

  stripeScriptPromise = new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Stripe.js'));
    document.head.appendChild(script);
  });

  return stripeScriptPromise;
}

export function Sheets({ model }: { model: FidelityModel }) {
  const {
    sheet,
    selectedProduct,
    setSheet,
    payWithFiat,
    checkoutForm,
    updateCheckoutField,
    checkoutError,
    checkoutProcessing,
    checkoutUseCoinDiscount,
    checkoutMode,
    toggleCoinDiscount,
    canUseCoinDiscount,
    coinPolicy,
    billingProfile,
    billingLoading,
    billingError,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    saveForFuture,
    setSaveForFuture,
    profileSavedCardsEnabled,
    openCardSetup,
    closeCardSetup,
    stripePublishableKey,
    cardSetupClientSecret,
    cardSetupLoading,
    cardSetupError,
    setCardSetupError,
    onCardSetupSuccess,
    refreshPaymentMethods,
    setDefaultSavedMethod,
    removeSavedMethod
  } = model;

  const [checkoutImageError, setCheckoutImageError] = useState(false);
  const [setupProcessing, setSetupProcessing] = useState(false);

  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeInstanceRef = useRef<StripeInstance | null>(null);
  const cardElementRef = useRef<StripeCardElement | null>(null);

  useEffect(() => {
    setCheckoutImageError(false);
  }, [selectedProduct.id]);

  useEffect(() => {
    if (sheet !== 'cardSetup') {
      return;
    }
    if (!stripePublishableKey || !cardSetupClientSecret || !cardContainerRef.current) {
      return;
    }

    let cancelled = false;

    async function initStripe() {
      try {
        await loadStripeScript();
        if (cancelled || !window.Stripe || !cardContainerRef.current) {
          return;
        }

        const stripe = window.Stripe(stripePublishableKey);
        stripeInstanceRef.current = stripe;
        const elements = stripe.elements();
        const card = elements.create('card', {
          hidePostalCode: 'true'
        });
        cardElementRef.current = card;
        card.mount(cardContainerRef.current);
      } catch {
        setCardSetupError('No se pudo inicializar Stripe en este momento.');
      }
    }

    initStripe();

    return () => {
      cancelled = true;
      if (cardElementRef.current) {
        cardElementRef.current.unmount();
        cardElementRef.current.destroy();
        cardElementRef.current = null;
      }
      stripeInstanceRef.current = null;
    };
  }, [cardSetupClientSecret, setCardSetupError, sheet, stripePublishableKey]);

  const serviceFee = Number((selectedProduct.fiatPrice * 0.05).toFixed(2));
  const shipping = selectedProduct.fiatPrice >= 40 ? 0 : 4.9;
  const discount = checkoutUseCoinDiscount ? coinPolicy.discountValueEur : 0;
  const total = Number((selectedProduct.fiatPrice + serviceFee + shipping - discount).toFixed(2));
  const isEurOnly = selectedProduct.purchaseType === 'eur_only';
  const checkoutIsCoin = checkoutMode === 'coin' && !isEurOnly;
  const canRedeemWithCoins = checkoutIsCoin && selectedProduct.belakoCoinCost != null && model.belakoCoins >= selectedProduct.belakoCoinCost;

  const fieldError = {
    fullName: checkoutForm.fullName.trim().length > 0 && checkoutForm.fullName.trim().length < 3,
    email: checkoutForm.email.length > 0 && !checkoutForm.email.includes('@'),
    address: checkoutForm.address.trim().length > 0 && checkoutForm.address.trim().length < 5
  };

  if (sheet === 'none') {
    return null;
  }

  if (sheet === 'cardSetup') {
    return (
      <section className="sheet checkout-sheet" role="dialog" aria-label="Añadir tarjeta">
        <h3>Añadir tarjeta</h3>
        <p>Guarda una tarjeta para pagar más rápido en próximos checkouts.</p>

        {cardSetupLoading ? <p className="hint">Preparando formulario seguro...</p> : null}
        {cardSetupError ? <p className="error-text" role="alert">{cardSetupError}</p> : null}

        <div className="card-mount" ref={cardContainerRef} />

        <div className="checkout-actions">
          <button
            className="primary"
            disabled={setupProcessing || cardSetupLoading || !cardSetupClientSecret}
            onClick={async () => {
              if (!stripeInstanceRef.current || !cardElementRef.current || !cardSetupClientSecret) {
                setCardSetupError('Stripe no está listo todavía.');
                return;
              }

              setSetupProcessing(true);
              setCardSetupError('');

              const result = await stripeInstanceRef.current.confirmCardSetup(cardSetupClientSecret, {
                payment_method: {
                  card: cardElementRef.current,
                  billing_details: {
                    name: checkoutForm.fullName,
                    email: checkoutForm.email
                  }
                }
              });

              if (result.error) {
                setCardSetupError(result.error.message || 'No se pudo guardar la tarjeta.');
                setSetupProcessing(false);
                return;
              }

              if (result.setupIntent?.status !== 'succeeded') {
                setCardSetupError('La confirmación de tarjeta no se completó.');
                setSetupProcessing(false);
                return;
              }

              await onCardSetupSuccess(result.setupIntent.payment_method || undefined);
              setSetupProcessing(false);
            }}
          >
            {setupProcessing ? 'Guardando tarjeta...' : 'Guardar tarjeta'}
          </button>

          <button className="ghost" onClick={closeCardSetup}>Volver al checkout</button>
        </div>
      </section>
    );
  }

  if (sheet === 'checkout') {
    return (
      <section className="sheet checkout-sheet" role="dialog" aria-label="Checkout">
        <h3>{checkoutIsCoin ? 'Canje de recompensa' : 'Checkout Belako'}</h3>
        <p>{selectedProduct.name}</p>

        {checkoutImageError ? (
          <div className="product-image-fallback">Belako Merch</div>
        ) : (
          <img
            className="product-image"
            src={selectedProduct.imageUrl}
            alt={`Merch Belako - ${selectedProduct.name}`}
            onError={() => setCheckoutImageError(true)}
            loading="lazy"
          />
        )}

        <p>{checkoutIsCoin ? 'Canjea este item usando Belako Coin.' : 'Pago exclusivo en euros con tarjeta.'}</p>
        <small className="checkout-trust">Pago seguro procesado por Stripe. Datos cifrados de extremo a extremo.</small>

        <div className="sheet-grid">
          <label className={fieldError.fullName ? 'input-error' : ''}>
            Nombre y apellidos
            <input value={checkoutForm.fullName} autoComplete="name" onChange={(e) => updateCheckoutField('fullName', e.target.value)} />
          </label>
          <label className={fieldError.email ? 'input-error' : ''}>
            Email
            <input type="email" value={checkoutForm.email} autoComplete="email" onChange={(e) => updateCheckoutField('email', e.target.value)} />
          </label>
          <label className={fieldError.address ? 'input-error' : ''}>
            Direccion
            <input value={checkoutForm.address} autoComplete="street-address" onChange={(e) => updateCheckoutField('address', e.target.value)} />
          </label>
          <div className="row checkout-row">
            <label>
              Ciudad
              <input value={checkoutForm.city} autoComplete="address-level2" onChange={(e) => updateCheckoutField('city', e.target.value)} />
            </label>
            <label>
              CP
              <input value={checkoutForm.postalCode} autoComplete="postal-code" inputMode="numeric" onChange={(e) => updateCheckoutField('postalCode', e.target.value)} />
            </label>
          </div>
          <label>
            Pais
            <input value={checkoutForm.country} autoComplete="country-name" onChange={(e) => updateCheckoutField('country', e.target.value)} />
          </label>
        </div>

        {!checkoutIsCoin && profileSavedCardsEnabled ? (
          <article className="summary-box">
            <div className="row actions-row">
              <strong>Métodos de pago guardados</strong>
              <button className="ghost" onClick={refreshPaymentMethods} disabled={billingLoading}>Actualizar</button>
            </div>

            {billingLoading ? <p className="hint">Cargando tarjetas...</p> : null}
            {billingError ? <p className="error-text" role="alert">{billingError}</p> : null}

            {!billingLoading && !billingError && billingProfile?.methods.length ? (
              <div className="saved-methods">
                {billingProfile.methods.map((method) => (
                  <label key={method.id} className="saved-method-item">
                    <input
                      type="radio"
                      name="saved-payment"
                      checked={selectedPaymentMethodId === method.id}
                      onChange={() => setSelectedPaymentMethodId(method.id)}
                    />
                    <span>{method.brand.toUpperCase()} •••• {method.last4} · {method.expMonth}/{method.expYear}</span>
                    {method.isDefault ? <span className="store-badge">Default</span> : null}
                    <div className="method-actions">
                      {!method.isDefault ? <button className="ghost" onClick={() => setDefaultSavedMethod(method.id)}>Default</button> : null}
                      <button className="ghost" onClick={() => removeSavedMethod(method.id)}>Eliminar</button>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}

            {!billingLoading && !billingProfile?.methods.length ? (
              <p className="hint">No tienes tarjetas guardadas todavía.</p>
            ) : null}

            <button className="ghost" onClick={openCardSetup}>Añadir tarjeta</button>

            {!selectedPaymentMethodId ? (
              <label className="checkbox-line">
                <input type="checkbox" checked={saveForFuture} onChange={(e) => setSaveForFuture(e.target.checked)} />
                Guardar tarjeta automáticamente tras pago en Stripe Checkout.
              </label>
            ) : null}
          </article>
        ) : null}

        {checkoutIsCoin ? (
          <div className="summary-box">
            <p>Precio recompensa: {selectedProduct.belakoCoinCost ?? 0} BEL</p>
            <p>Saldo actual: {model.belakoCoins} BEL</p>
            <p><strong>Total canje: {selectedProduct.belakoCoinCost ?? 0} BEL</strong></p>
          </div>
        ) : (
          <div className="summary-box">
            <p>Precio base: €{selectedProduct.fiatPrice.toFixed(2)}</p>
            <p>Fee plataforma (5%): €{serviceFee.toFixed(2)}</p>
            <p>Envio: {shipping === 0 ? 'Gratis' : `€${shipping.toFixed(2)}`}</p>
            <p>Descuento BEL: -€{discount.toFixed(2)}</p>
            <p><strong>Total tarjeta: €{total.toFixed(2)}</strong></p>
          </div>
        )}

        {!checkoutIsCoin ? (
          <>
            <button className={checkoutUseCoinDiscount ? 'primary' : 'ghost'} onClick={toggleCoinDiscount}>
              {checkoutUseCoinDiscount ? 'Descuento BEL aplicado' : `Aplicar -€${coinPolicy.discountValueEur} (${coinPolicy.discountCost} BEL)`}
            </button>
            {!canUseCoinDiscount && !checkoutUseCoinDiscount ? <p className="hint">No tienes BEL suficiente para descuento.</p> : null}
          </>
        ) : !canRedeemWithCoins ? (
          <p className="error-text">No tienes BEL suficiente para este canje.</p>
        ) : null}

        <label className="checkbox-line">
          <input type="checkbox" checked={checkoutForm.acceptedPolicy} onChange={(e) => updateCheckoutField('acceptedPolicy', e.target.checked)} />
          Acepto politica de compra, devoluciones y tiempos de envio.
        </label>

        <details>
          <summary>Politica y FAQ compra</summary>
          <p>Envios 2-5 días laborales en peninsula.</p>
          <p>Cambios y devoluciones en 14 días para productos no personalizados.</p>
          <p>Soporte: support@belako.app (mock).</p>
        </details>

        {checkoutError ? <p className="error-text">{checkoutError}</p> : null}

        <div className="checkout-actions">
          <button className="primary" onClick={payWithFiat} disabled={checkoutProcessing || (checkoutIsCoin && !canRedeemWithCoins)}>
            {checkoutProcessing
              ? checkoutIsCoin
                ? 'Procesando canje...'
                : 'Procesando pago...'
              : checkoutIsCoin
                ? `Confirmar canje (${selectedProduct.belakoCoinCost ?? 0} BEL)`
                : selectedPaymentMethodId
                  ? 'Pagar con tarjeta guardada'
                  : 'Pagar con Stripe'}
          </button>
          <button className="ghost" onClick={() => setSheet('none')}>Cancelar</button>
        </div>
      </section>
    );
  }

  return (
    <section className="sheet" role="dialog" aria-label="Recompensa">
      <h3>Recompensa desbloqueada</h3>
      <p>Tu recompensa ya está disponible en tu progreso de fan.</p>
      <button onClick={() => setSheet('none')}>Listo</button>
    </section>
  );
}
