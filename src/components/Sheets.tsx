import { useEffect, useState } from 'react';
import type { FidelityModel } from '../state/use-fidelity-state';

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
    coinPolicy
  } = model;
  const [checkoutImageError, setCheckoutImageError] = useState(false);

  useEffect(() => {
    setCheckoutImageError(false);
  }, [selectedProduct.id]);

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
            <input
              value={checkoutForm.fullName}
              autoComplete="name"
              onChange={(e) => updateCheckoutField('fullName', e.target.value)}
            />
          </label>
          <label className={fieldError.email ? 'input-error' : ''}>
            Email
            <input
              type="email"
              value={checkoutForm.email}
              autoComplete="email"
              onChange={(e) => updateCheckoutField('email', e.target.value)}
            />
          </label>
          <label className={fieldError.address ? 'input-error' : ''}>
            Direccion
            <input
              value={checkoutForm.address}
              autoComplete="street-address"
              onChange={(e) => updateCheckoutField('address', e.target.value)}
            />
          </label>
          <div className="row checkout-row">
            <label>
              Ciudad
              <input
                value={checkoutForm.city}
                autoComplete="address-level2"
                onChange={(e) => updateCheckoutField('city', e.target.value)}
              />
            </label>
            <label>
              CP
              <input
                value={checkoutForm.postalCode}
                autoComplete="postal-code"
                inputMode="numeric"
                onChange={(e) => updateCheckoutField('postalCode', e.target.value)}
              />
            </label>
          </div>
          <label>
            Pais
            <input
              value={checkoutForm.country}
              autoComplete="country-name"
              onChange={(e) => updateCheckoutField('country', e.target.value)}
            />
          </label>
        </div>

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
          <input
            type="checkbox"
            checked={checkoutForm.acceptedPolicy}
            onChange={(e) => updateCheckoutField('acceptedPolicy', e.target.checked)}
          />
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
          <button
            className="primary"
            onClick={payWithFiat}
            disabled={checkoutProcessing || (checkoutIsCoin && !canRedeemWithCoins)}
          >
            {checkoutProcessing
              ? checkoutIsCoin
                ? 'Procesando canje...'
                : 'Redirigiendo a Stripe...'
              : checkoutIsCoin
                ? `Confirmar canje (${selectedProduct.belakoCoinCost ?? 0} BEL)`
                : 'Pagar con Stripe'}
          </button>
          <button className="ghost" onClick={() => setSheet('none')}>
            Cancelar
          </button>
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
