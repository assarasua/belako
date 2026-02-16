import { useEffect, useRef, useState } from 'react';
import type { FidelityModel } from '../state/use-fidelity-state';

type StripeCardElement = {
  mount: (element: HTMLElement) => void;
  unmount: () => void;
  destroy: () => void;
};

type StripeElements = {
  create: (type: 'card', options?: Record<string, unknown>) => StripeCardElement;
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
    Stripe?: (publishableKey: string) => StripeInstance | null;
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

        const normalizedKey = stripePublishableKey.trim();
        if (!/^pk_(test|live)_/.test(normalizedKey)) {
          throw new Error('La clave pública de Stripe no es válida.');
        }

        const isSecureOrigin =
          window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1';
        if (!isSecureOrigin) {
          throw new Error(`Stripe requiere HTTPS en este origen: ${window.location.origin}`);
        }

        const stripe = window.Stripe(normalizedKey);
        if (!stripe) {
          throw new Error('Stripe no devolvió una instancia válida.');
        }
        stripeInstanceRef.current = stripe;
        const elements = stripe.elements();
        const card = elements.create('card', {
          hidePostalCode: true,
          style: {
            base: {
              color: '#ff9bd3',
              fontFamily: '"Space Grotesk", system-ui, -apple-system, Segoe UI, sans-serif',
              fontSize: '16px',
              lineHeight: '24px',
              '::placeholder': {
                color: '#e7bfd8'
              }
            },
            invalid: {
              color: '#ff7fb0',
              iconColor: '#ff7fb0'
            }
          }
        });
        cardElementRef.current = card;
        card.mount(cardContainerRef.current);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo inicializar Stripe en este momento.';
        setCardSetupError(message);
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
  const total = Number((selectedProduct.fiatPrice + serviceFee + shipping).toFixed(2));
  const canSubmitCardSetup =
    Boolean(cardSetupClientSecret) &&
    checkoutForm.fullName.trim().length >= 3 &&
    checkoutForm.email.includes('@');

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
        <header className="card-setup-header">
          <span className="store-badge">Stripe Secure</span>
          <h3>Añadir tarjeta</h3>
          <p>Guarda tu tarjeta para checkout en un toque en próximas compras.</p>
        </header>

        {cardSetupLoading ? <p className="hint">Preparando formulario seguro...</p> : null}
        {cardSetupError ? <p className="error-text" role="alert">{cardSetupError}</p> : null}

        <article className="summary-box card-setup-billing">
          <p>Datos de facturación</p>
          <small><strong>Nombre:</strong> {checkoutForm.fullName || 'Pendiente de completar'}</small>
          <small><strong>Email:</strong> {checkoutForm.email || 'Pendiente de completar'}</small>
        </article>

        <section className="card-mount-shell">
          <p className="card-mount-title">Datos de tarjeta</p>
          <div className="card-mount" ref={cardContainerRef} />
          <small className="card-setup-footnote">
            Tus datos viajan cifrados y se guardan en Stripe. Belako SuperFan App no almacena PAN ni CVC.
          </small>
        </section>

        <div className="checkout-actions">
          <button
            className="primary"
            disabled={setupProcessing || cardSetupLoading || !canSubmitCardSetup}
            onClick={async () => {
              if (!checkoutForm.fullName.trim() || !checkoutForm.email.includes('@')) {
                setCardSetupError('Completa nombre y email válidos antes de guardar la tarjeta.');
                return;
              }

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

          <button className="ghost" onClick={closeCardSetup}>Cancelar</button>
        </div>
      </section>
    );
  }

  if (sheet === 'checkout') {
    return (
      <section className="sheet checkout-sheet" role="dialog" aria-label="Checkout">
        <h3>Checkout Belako</h3>
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

        <p>Pago exclusivo en euros con tarjeta.</p>
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

        {profileSavedCardsEnabled ? (
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
                    {method.isDefault ? <span className="store-badge">Por defecto</span> : null}
                    <div className="method-actions">
                      {!method.isDefault ? <button className="ghost" onClick={() => setDefaultSavedMethod(method.id)}>Usar por defecto</button> : null}
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

        <div className="summary-box">
          <p>Precio base: €{selectedProduct.fiatPrice.toFixed(2)}</p>
          <p>Fee plataforma (5%): €{serviceFee.toFixed(2)}</p>
          <p>Envio: {shipping === 0 ? 'Gratis' : `€${shipping.toFixed(2)}`}</p>
          <p><strong>Total tarjeta: €{total.toFixed(2)}</strong></p>
        </div>

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
          <button className="primary" onClick={payWithFiat} disabled={checkoutProcessing}>
            {checkoutProcessing
              ? 'Procesando pago...'
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
