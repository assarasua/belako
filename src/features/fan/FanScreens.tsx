import { useMemo, useState } from 'react';
import { products, streams } from '../../lib/mock-data';
import type { FidelityModel } from '../../state/use-fidelity-state';
import { liveBadgeText } from '../../state/use-fidelity-state';

export function FanScreens({ model }: { model: FidelityModel }) {
  const {
    fanTab,
    activeStream,
    belakoCoins,
    attendanceCount,
    spend,
    setFanTab,
    track,
    liveState,
    watchMinute,
    setSheet,
    openCheckout,
    toggleReconnectState,
    endStream,
    nextStream,
    tiers,
    claimTierReward,
    claimedTierIds,
    conversion,
    events,
    coinPolicy,
    canUseCoinDiscount,
    rewardHistory,
    ownedNfts,
    nftAssets,
    nftImageLoadErrors,
    markNftImageError,
    notifications,
    clearNotifications
  } = model;
  const [storeFilter, setStoreFilter] = useState<'all' | 'buy' | 'redeem'>('all');

  const sortedStoreProducts = useMemo(() => {
    const enriched = products.map((product) => ({
      product,
      canRedeem: belakoCoins >= product.belakoCoinCost
    }));

    const filtered = enriched.filter((entry) => {
      if (storeFilter === 'buy') {
        return true;
      }
      if (storeFilter === 'redeem') {
        return entry.canRedeem;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (a.canRedeem !== b.canRedeem) {
        return a.canRedeem ? -1 : 1;
      }
      return a.product.fiatPrice - b.product.fiatPrice;
    });
  }, [belakoCoins, storeFilter]);

  if (fanTab === 'home') {
    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Paso 1: descubre y entra a un directo</h3>
          <p>Desliza entre shows, abre uno y gana BEL por asistencia.</p>
        </article>

        {streams.length === 0 ? (
          <article className="metric-card empty-state">
            <h3>No hay directos ahora mismo</h3>
            <p>Te avisaremos cuando Belako empiece el siguiente show.</p>
          </article>
        ) : (
          <>
            <h2>Descubrimiento</h2>
            <article className={`stream-card ${activeStream.colorClass} live-pulse`}>
              <div className="live-top">
                <p className="badge">EN DIRECTO</p>
                <span className="token-chip">{activeStream.viewers} viendo</span>
              </div>
              <h3>{activeStream.artist}</h3>
              <p>{activeStream.title}</p>
              <small>{activeStream.genre}</small>
              <p className="hint">{activeStream.rewardHint}</p>
              <div className="row">
                <button
                  onClick={() => {
                    setFanTab('live');
                    track('EVT_stream_join', `Entró al directo de ${activeStream.artist}`);
                  }}
                >
                  Entrar
                </button>
                <button className="ghost" onClick={nextStream}>
                  Deslizar
                </button>
              </div>
            </article>
          </>
        )}

        <article className="metric-card">
          <p>Resumen rapido</p>
          <small>Belako Coin {belakoCoins} BEL | Asistencia {attendanceCount} | Gasto €{spend.toFixed(2)}</small>
          <small>Canje activo: -€{coinPolicy.discountValueEur} por {coinPolicy.discountCost} BEL</small>
        </article>
      </section>
    );
  }

  if (fanTab === 'live') {
    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Paso 2: interactúa en directo</h3>
          <p>Mira 1 minuto para sumar BEL, participa en pujas y compra merch desde el live.</p>
        </article>

        <article className={`live-room ${activeStream.colorClass}`}>
          <div className="live-top">
            <p className="badge">{liveBadgeText(liveState)}</p>
            <span className="token-chip">Asistencia {attendanceCount}/3</span>
          </div>
          <h2>{activeStream.artist}</h2>
          <p>{activeStream.title}</p>

          <div className="chat-box" aria-live="polite">
            <p>@ane: este drop es una locura</p>
            <p>@iker: subid la puja +5</p>
            <p>@june: insignia superfan desbloqueada</p>
          </div>

          <div className="row">
            <button onClick={watchMinute}>Ver 1 min (+{coinPolicy.watchReward} BEL)</button>
            <button onClick={() => setSheet('auction')}>Abrir puja</button>
          </div>
          <section className="live-embed" aria-label="Directo embebido de YouTube">
            <iframe
              src="https://www.youtube.com/embed/l7TlAz1HvSk?rel=0"
              title="Belako Live"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </section>
          <div className="row">
            <button onClick={() => openCheckout(products[0])}>Comprar merch</button>
            <button className="ghost" onClick={toggleReconnectState}>
              {liveState === 'live' ? 'Simular reconexion' : 'Volver al directo'}
            </button>
          </div>
          <button className="ghost" onClick={endStream}>
            Finalizar estado directo
          </button>
        </article>

        {liveState === 'ended' ? (
          <article className="metric-card">
            <p>El directo ha terminado.</p>
            <button onClick={nextStream}>Ir al siguiente directo</button>
          </article>
        ) : null}
      </section>
    );
  }

  if (fanTab === 'rewards') {
    const assetsById = new Map(nftAssets.map((asset) => [asset.id, asset]));

    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Paso 3: reclama y canjea</h3>
          <p>Desbloquea niveles, reclama NFTs y usa tus BEL para reducir el total en checkout.</p>
        </article>

        <h2>Niveles de fidelidad</h2>
        {tiers.map((tier) => (
          <article key={tier.id} className={`tier-card ${tier.unlocked ? 'unlocked' : ''}`}>
            <h3>{tier.title}</h3>
            <p>{tier.requirement}</p>
            <small>{tier.progress}</small>
            <small>Recompensa: {tier.reward}</small>
            <button onClick={() => claimTierReward(tier)} disabled={!tier.unlocked}>
              {claimedTierIds.includes(tier.id) ? 'Reclamada' : tier.unlocked ? 'Reclamar' : 'Bloqueada'}
            </button>
          </article>
        ))}

        <article className="metric-card">
          <p>Belako Coin</p>
          <small>Saldo actual: {belakoCoins} BEL</small>
          <small>Hitos: ver directo (+{coinPolicy.watchReward} BEL) | compra merch (+{coinPolicy.purchaseReward} BEL)</small>
          <small>Límite diario por visualización: {coinPolicy.dailyWatchCoinCap} BEL</small>
          <small>{canUseCoinDiscount ? 'Puedes usar descuento en checkout.' : 'Consigue más BEL para activar descuento.'}</small>
        </article>

        <article className="metric-card">
          <p>Tienda oficial y recompensas</p>
          <div className="store-filter-row">
            <button className={storeFilter === 'all' ? 'primary' : 'ghost'} onClick={() => setStoreFilter('all')}>
              Todo
            </button>
            <button className={storeFilter === 'buy' ? 'primary' : 'ghost'} onClick={() => setStoreFilter('buy')}>
              Solo comprables
            </button>
            <button className={storeFilter === 'redeem' ? 'primary' : 'ghost'} onClick={() => setStoreFilter('redeem')}>
              Solo canjeables
            </button>
          </div>
          <div className="product-list">
            {sortedStoreProducts.map(({ product, canRedeem }) => (
              <article key={product.id} className="product-card">
                <strong>{product.name}</strong>
                <div className="store-badges">
                  <span className="store-badge">MERCH</span>
                  <span className="store-badge store-badge-reward">REWARD</span>
                </div>
                <small>
                  Merch: €{product.fiatPrice.toFixed(2)} {product.limited ? '| Limitado' : ''}
                </small>
                <small>Canje recompensa: {product.belakoCoinCost} BEL</small>
                <div className="product-actions">
                  <button onClick={() => openCheckout(product, 'fiat')}>Comprar merch (€)</button>
                  <button className="ghost" onClick={() => openCheckout(product, 'coin')} disabled={!canRedeem}>
                    {!canRedeem ? 'BEL insuficiente' : 'Canjear con BEL'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="metric-card">
          <p>Colección NFT oficial de Belako</p>
          {ownedNfts.length === 0 ? (
            <p className="hint">Todavía no tienes NFTs. Reclama una recompensa para mintear el primero.</p>
          ) : (
            <div className="nft-grid">
              {ownedNfts.map((owned) => {
                const asset = assetsById.get(owned.assetId);
                if (!asset) {
                  return null;
                }

                const hasError = nftImageLoadErrors[asset.id];
                return (
                  <article key={owned.id} className="nft-card">
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
                      <small>Mint: {owned.mintedAt}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        <article className="metric-card">
          <p>Catálogo NFT disponible</p>
          <div className="nft-grid">
            {nftAssets.map((asset) => {
              const hasError = nftImageLoadErrors[asset.id];
              return (
                <article key={asset.id} className="nft-card">
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
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="metric-card">
          <p>Historial de recompensas</p>
          <div className="event-list">
            {rewardHistory.length === 0 ? <p>Aún no hay movimientos.</p> : rewardHistory.slice(0, 6).map((item) => <p key={item.id}>{item.label} ({item.at})</p>)}
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="stack">
      <article className="guide-card">
        <h3>Centro de control fan</h3>
        <p>Revisa notificaciones, progreso y acciones recomendadas para subir de nivel.</p>
      </article>

      <h2>Perfil fan</h2>
      <article className="metric-card">
        <p>Estado</p>
        <h3>{tiers[2].unlocked ? 'Superfan Belako' : tiers[0].unlocked ? 'Nivel 1 activo' : 'Fan casual'}</h3>
      </article>
      <article className="metric-card">
        <p>KPI principal</p>
        <h3>Conversion viewer a superfan {conversion}%</h3>
      </article>

      <article className="metric-card">
        <div className="row actions-row">
          <p>Notificaciones</p>
          <button className="ghost" onClick={clearNotifications}>Limpiar</button>
        </div>
        <div className="event-list">
          {notifications.length === 0 ? <p>Sin notificaciones.</p> : notifications.slice(0, 5).map((n) => <p key={n.id}><strong>{n.title}</strong> {n.message} ({n.at})</p>)}
        </div>
      </article>

      <article className="metric-card">
        <p>Eventos recientes</p>
        <div className="event-list">
          {events.slice(0, 6).map((event) => (
            <p key={`${event.code}-${event.at}`}>
              <strong>{event.code}</strong> {event.message} ({event.at})
            </p>
          ))}
        </div>
      </article>
    </section>
  );
}
