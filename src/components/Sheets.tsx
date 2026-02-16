import type { FidelityModel } from '../state/use-fidelity-state';

export function Sheets({ model }: { model: FidelityModel }) {
  const {
    sheet,
    selectedProduct,
    bidValue,
    placeBid,
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
    ownedNfts,
    nftAssets,
    nftImageLoadErrors,
    latestMintedNftId,
    markNftImageError
  } = model;

  const serviceFee = Number((selectedProduct.fiatPrice * 0.05).toFixed(2));
  const shipping = selectedProduct.fiatPrice >= 40 ? 0 : 4.9;
  const discount = checkoutUseCoinDiscount ? coinPolicy.discountValueEur : 0;
  const total = Number((selectedProduct.fiatPrice + serviceFee + shipping - discount).toFixed(2));
  const canRedeemWithCoins = model.belakoCoins >= selectedProduct.belakoCoinCost;

  if (sheet === 'none') {
    return null;
  }

  if (sheet === 'auction') {
    return (
      <section className="sheet" role="dialog" aria-label="Subasta">
        <h3>Subasta en directo</h3>
        <p>{selectedProduct.name}</p>
        <p>Puja actual: €{bidValue}</p>
        <div className="row">
          <button onClick={placeBid}>Subir +5</button>
          <button className="ghost" onClick={() => setSheet('none')}>
            Cerrar
          </button>
        </div>
      </section>
    );
  }

  if (sheet === 'checkout') {
    return (
      <section className="sheet checkout-sheet" role="dialog" aria-label="Checkout">
        <h3>{checkoutMode === 'coin' ? 'Canje de recompensa' : 'Checkout Belako'}</h3>
        <p>{selectedProduct.name}</p>
        <p>{checkoutMode === 'coin' ? 'Canjea este item usando Belako Coin.' : 'Pago exclusivo en euros con tarjeta.'}</p>

        <div className="sheet-grid">
          <label>
            Nombre y apellidos
            <input
              value={checkoutForm.fullName}
              autoComplete="name"
              onChange={(e) => updateCheckoutField('fullName', e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={checkoutForm.email}
              autoComplete="email"
              onChange={(e) => updateCheckoutField('email', e.target.value)}
            />
          </label>
          <label>
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

        {checkoutMode === 'coin' ? (
          <div className="summary-box">
            <p>Precio recompensa: {selectedProduct.belakoCoinCost} BEL</p>
            <p>Saldo actual: {model.belakoCoins} BEL</p>
            <p><strong>Total canje: {selectedProduct.belakoCoinCost} BEL</strong></p>
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

        {checkoutMode === 'fiat' ? (
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
            disabled={checkoutProcessing || (checkoutMode === 'coin' && !canRedeemWithCoins)}
          >
            {checkoutProcessing
              ? checkoutMode === 'coin'
                ? 'Procesando canje...'
                : 'Redirigiendo a Stripe...'
              : checkoutMode === 'coin'
                ? `Confirmar canje (${selectedProduct.belakoCoinCost} BEL)`
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
      <h3>NFT de Belako desbloqueado</h3>
      <p>NFT oficial de Belako añadido a tu colección.</p>
      {latestMintedNftId ? (
        (() => {
          const minted = ownedNfts.find((item) => item.id === latestMintedNftId);
          const asset = minted ? nftAssets.find((item) => item.id === minted.assetId) : undefined;
          if (!minted || !asset) {
            return null;
          }
          const hasError = nftImageLoadErrors[asset.id];
          return (
            <article className="nft-card nft-mini">
              {hasError ? (
                <div className="nft-image nft-fallback">NFT Belako</div>
              ) : (
                <img
                  className="nft-image"
                  src={asset.imageUrl}
                  alt={`NFT Belako - ${asset.name}`}
                  onError={() => markNftImageError(asset.id)}
                  loading="lazy"
                />
              )}
              <div className="nft-meta">
                <strong>{asset.name}</strong>
                <span className={`rarity-badge rarity-${asset.rarity}`}>{asset.rarity}</span>
                <small>{minted.mintedAt}</small>
              </div>
            </article>
          );
        })()
      ) : null}
      <button onClick={() => setSheet('none')}>Listo</button>
    </section>
  );
}
