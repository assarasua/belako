import { useEffect, useMemo, useRef, useState } from 'react';
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
    watchFullLive,
    claimFullLiveReward,
    currentStreamFullyWatched,
    fullLiveRewardUnlocked,
    fullLiveRewardClaimed,
    openCheckout,
    toggleReconnectState,
    endStream,
    nextStream,
    tiers,
    claimTierReward,
    claimPendingNftGrant,
    claimedTierIds,
    conversion,
    events,
    coinPolicy,
    canUseCoinDiscount,
    rewardHistory,
    nftSyncing,
    nftGrants,
    nftClaimLoadingById,
    nftClaimErrorById,
    ownedNfts,
    nftAssets,
    nftImageLoadErrors,
    markNftImageError,
    meetGreetPass,
    meetGreetQrToken,
    meetGreetQrExpiresAt,
    meetGreetQrLoading,
    refreshMeetGreetPass,
    generateMeetGreetQr,
    notifications,
    clearNotifications
  } = model;
  const [storeFilter, setStoreFilter] = useState<'all' | 'buy' | 'redeem'>('all');
  const [homeFeedCount, setHomeFeedCount] = useState(6);
  const homeSentinelRef = useRef<HTMLDivElement | null>(null);

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

  const homeFeedStreams = useMemo(() => {
    if (streams.length === 0) {
      return [];
    }
    return Array.from({ length: homeFeedCount }, (_, index) => {
      const stream = streams[index % streams.length];
      return {
        stream,
        virtualId: `${stream.id}-${index}`
      };
    });
  }, [homeFeedCount]);

  useEffect(() => {
    if (fanTab !== 'home' || streams.length === 0) {
      return;
    }
    const sentinel = homeSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) {
          return;
        }
        setHomeFeedCount((prev) => prev + 4);
      },
      { root: null, rootMargin: '180px 0px', threshold: 0.05 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fanTab, homeFeedStreams.length]);

  function tierProgressPercent(tierId: 1 | 2 | 3): number {
    if (tierId === 1) {
      return Math.min((attendanceCount / 3) * 100, 100);
    }
    if (tierId === 2) {
      const attendanceProgress = Math.min((attendanceCount / 10) * 50, 50);
      const spendProgress = Math.min((spend / 50) * 50, 50);
      return attendanceProgress + spendProgress;
    }
    const attendanceProgress = Math.min((attendanceCount / 20) * 50, 50);
    const spendProgress = Math.min((spend / 150) * 50, 50);
    return attendanceProgress + spendProgress;
  }

  if (fanTab === 'home') {
    return (
      <section className="stack">
        <article className={`hero-card belako-hero ${activeStream.colorClass}`}>
          <p className="hero-kicker">BELAKO SUPERFAN</p>
          <h2>Hoy en directo</h2>
          <h3>{activeStream.title}</h3>
          <p>{activeStream.rewardHint}</p>
          <button
            onClick={() => {
              setFanTab('live');
              track('EVT_stream_join', `Entró al directo de ${activeStream.artist}`);
            }}
          >
            Entrar ahora
          </button>
        </article>

        {streams.length === 0 ? (
          <article className="metric-card empty-state">
            <h3>No hay directos ahora mismo</h3>
            <p>Te avisaremos cuando Belako empiece el siguiente show.</p>
          </article>
        ) : (
          <>
            <h2>Descubrimiento</h2>
            <div className="home-feed" aria-label="Feed infinito de directos">
              {homeFeedStreams.map(({ stream, virtualId }) => (
                <article key={virtualId} className={`stream-card ${stream.colorClass} live-pulse`}>
                  <div className="live-top">
                    <p className="badge">EN DIRECTO</p>
                    <span className="token-chip">{stream.viewers} viendo</span>
                  </div>
                  <h3>{stream.artist}</h3>
                  <p>{stream.title}</p>
                  <small>{stream.genre}</small>
                  <p className="hint">{stream.rewardHint}</p>
                  <button
                    onClick={() => {
                      setFanTab('live');
                      track('EVT_stream_join', `Entró al directo de ${stream.artist}`);
                    }}
                  >
                    Entrar al live
                  </button>
                </article>
              ))}
              <div ref={homeSentinelRef} className="infinite-sentinel" aria-hidden="true">
                Cargando más directos...
              </div>
            </div>
          </>
        )}

        <article className="metric-card">
          <p>Resumen rapido</p>
          <small>BEL {belakoCoins} | Asistencia {attendanceCount} directos | Gasto €{spend.toFixed(2)}</small>
          <small>Canje activo: -€{coinPolicy.discountValueEur} por {coinPolicy.discountCost} BEL</small>
        </article>
      </section>
    );
  }

  if (fanTab === 'live') {
    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Live mission</h3>
          <p>Completa hitos durante el directo y compra merch sin salir del flujo.</p>
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
            <p>@iker: temazo en directo</p>
            <p>@june: insignia superfan desbloqueada</p>
          </div>

          <div className="row">
            <button onClick={watchMinute}>Ver 1 min (+{coinPolicy.watchReward} BEL)</button>
            <button className={currentStreamFullyWatched ? 'ghost' : 'primary'} onClick={watchFullLive}>
              {currentStreamFullyWatched ? 'Directo completo verificado' : 'Ver directo entero'}
            </button>
          </div>
          <small>{currentStreamFullyWatched ? 'Recompensa de directo completo desbloqueada.' : 'Ver directo entero para desbloquear recompensa.'}</small>
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
          <div className="row sticky-live-actions">
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

  if (fanTab === 'store') {
    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Tienda oficial Belako</h3>
          <p>Compra en euros con Stripe o canjea con BEL cuando desbloquees hitos.</p>
        </article>

        <article className="metric-card">
          <p>Catálogo</p>
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
                  <button onClick={() => openCheckout(product, 'fiat')}>
                    Comprar merch (€)
                  </button>
                  <button className="ghost" onClick={() => openCheckout(product, 'coin')} disabled={!canRedeem}>
                    {!canRedeem ? 'BEL insuficiente' : 'Canjear con BEL'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    );
  }

  if (fanTab === 'rewards') {
    const assetsById = new Map(nftAssets.map((asset) => [asset.id, asset]));

    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Progresión fan</h3>
          <p>Desbloquea niveles, reclama NFTs y maximiza tus BEL.</p>
        </article>

        <h2>Niveles de fidelidad</h2>
        {tiers.map((tier) => (
          <article key={tier.id} className={`tier-card ${tier.unlocked ? 'unlocked' : ''}`}>
            <h3>{tier.title}</h3>
            <p>{tier.requirement}</p>
            <small>{tier.progress}</small>
            <small>Recompensa: {tier.reward}</small>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${tierProgressPercent(tier.id)}%` }} />
            </div>
            <button onClick={() => claimTierReward(tier)} disabled={!tier.unlocked}>
              {claimedTierIds.includes(tier.id) ? 'Reclamada' : tier.unlocked ? 'Reclamar' : 'Bloqueada'}
            </button>
          </article>
        ))}

        <article className="metric-card">
          <p>Recompensa por directo completo</p>
          <small>Verifica un directo entero para desbloquear este bonus.</small>
          <button onClick={claimFullLiveReward} disabled={!fullLiveRewardUnlocked}>
            {fullLiveRewardClaimed ? 'Reclamada' : fullLiveRewardUnlocked ? 'Reclamar +25 BEL' : 'Bloqueada'}
          </button>
        </article>

        <article className="metric-card">
          <p>NFTs pendientes de reclamar</p>
          {nftSyncing ? <small>Sincronizando NFTs...</small> : null}
          {nftGrants.filter((grant) => grant.status === 'PENDING').length === 0 ? (
            <small>No tienes grants pendientes por ahora.</small>
          ) : (
            <div className="event-list">
              {nftGrants
                .filter((grant) => grant.status === 'PENDING')
                .map((grant) => {
                  const asset = nftAssets.find((item) => item.id === grant.assetId);
                  const loading = nftClaimLoadingById[grant.id];
                  const error = nftClaimErrorById[grant.id];
                  return (
                    <article key={grant.id} className="product-card">
                      <strong>{asset?.name || grant.assetId}</strong>
                      <small>Origen: {grant.originType} · {grant.originRef}</small>
                      <button onClick={() => claimPendingNftGrant(grant.id)} disabled={loading}>
                        {loading ? 'Minteando en Polygon...' : 'Reclamar NFT'}
                      </button>
                      {error ? <small className="hint">{error}</small> : null}
                    </article>
                  );
                })}
            </div>
          )}
        </article>

        <article className="metric-card">
          <div className="row actions-row">
            <p>Pase Meet & Greet Superfan</p>
            <button className="ghost" onClick={refreshMeetGreetPass}>Actualizar</button>
          </div>
          {meetGreetPass.status === 'LOCKED' ? (
            <>
              <small>Estado: Bloqueado</small>
              <small>Requisito: alcanzar Tier 3 Superfan y reclamar el NFT Pass.</small>
            </>
          ) : (
            <>
              <small>
                Estado: {meetGreetPass.status === 'VALID' ? 'Valido' : meetGreetPass.status === 'USED' ? 'Usado' : 'Expirado'}
              </small>
              <small>{meetGreetPass.event?.title || 'Evento por confirmar'}</small>
              <small>
                {meetGreetPass.event
                  ? `${new Date(meetGreetPass.event.date).toLocaleString()} · ${meetGreetPass.event.location}`
                  : 'Sin fecha activa'}
              </small>
              {meetGreetPass.status === 'VALID' ? (
                <>
                  <button onClick={generateMeetGreetQr} disabled={meetGreetQrLoading}>
                    {meetGreetQrLoading ? 'Generando QR...' : 'Generar QR de acceso'}
                  </button>
                  {meetGreetQrToken ? (
                    <div className="qr-card">
                      <img
                        className="qr-image"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(meetGreetQrToken)}`}
                        alt="QR de acceso Meet & Greet Belako"
                        loading="lazy"
                      />
                      <small>Expira: {new Date(meetGreetQrExpiresAt).toLocaleTimeString()}</small>
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </article>

        <article className="metric-card">
          <p>Belako Coin</p>
          <small>Saldo actual: {belakoCoins} BEL</small>
          <small>Hitos: ver directo (+{coinPolicy.watchReward} BEL) | compra merch (+{coinPolicy.purchaseReward} BEL)</small>
          <small>Límite diario por visualización: {coinPolicy.dailyWatchCoinCap} BEL</small>
          <small>{canUseCoinDiscount ? 'Puedes usar descuento en checkout.' : 'Consigue más BEL para activar descuento.'}</small>
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
        <p>Estado general de tu cuenta, notificaciones y eventos clave.</p>
      </article>

      <h2>Perfil fan</h2>
      <article className="metric-card">
        <p>Estado</p>
        <h3>{tiers[2].unlocked ? 'Superfan Belako' : tiers[0].unlocked ? 'Nivel 1 activo' : 'Fan casual'}</h3>
      </article>
      <article className="metric-card">
        <p>Pase Meet & Greet</p>
        <h3>
          {meetGreetPass.status === 'VALID'
            ? 'Pase valido'
            : meetGreetPass.status === 'USED'
              ? 'Pase usado'
              : meetGreetPass.status === 'EXPIRED'
                ? 'Pase expirado'
                : 'Bloqueado'}
        </h3>
        {meetGreetPass.event ? <small>{meetGreetPass.event.title}</small> : null}
        {meetGreetPass.event && meetGreetPass.status === 'VALID' ? (
          <small>
            Proxima fecha: {new Date(meetGreetPass.event.date).toLocaleString()} · {meetGreetPass.event.location}
          </small>
        ) : null}
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
