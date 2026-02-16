import { useEffect, useMemo, useRef, useState } from 'react';
import { products, streams } from '../../lib/mock-data';
import type { StorePriceSort } from '../../lib/types';
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
    claimedTierIds,
    conversion,
    events,
    coinPolicy,
    canUseCoinDiscount,
    rewardHistory,
    seasonPass,
    seasonTiers,
    seasonMissions,
    claimSeasonPassTier,
    claimSeasonMission,
    notifications,
    clearNotifications
  } = model;
  const [storeSort, setStoreSort] = useState<StorePriceSort>('price_asc');
  const [homeFeedCount, setHomeFeedCount] = useState(6);
  const [productImageLoadErrors, setProductImageLoadErrors] = useState<Record<string, boolean>>({});
  const homeSentinelRef = useRef<HTMLDivElement | null>(null);

  const sortedStoreProducts = useMemo(() => {
    const enriched = products.map((product) => ({
      product,
      canRedeem: product.purchaseType === 'eur_or_bel' && product.belakoCoinCost != null && belakoCoins >= product.belakoCoinCost
    }));
    return enriched.sort((a, b) =>
      storeSort === 'price_desc'
        ? b.product.fiatPrice - a.product.fiatPrice
        : a.product.fiatPrice - b.product.fiatPrice
    );
  }, [belakoCoins, storeSort]);

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
          <p>Compra de merch en euros con Stripe. Ordena por precio para encontrar drops rápido.</p>
        </article>

        <article className="metric-card">
          <p>Catálogo</p>
          <div className="store-sort-row">
            <button className={storeSort === 'price_asc' ? 'primary' : 'ghost'} onClick={() => setStoreSort('price_asc')}>
              Precio: menor a mayor
            </button>
            <button className={storeSort === 'price_desc' ? 'primary' : 'ghost'} onClick={() => setStoreSort('price_desc')}>
              Precio: mayor a menor
            </button>
          </div>
          <div className="product-list">
            {sortedStoreProducts.map(({ product, canRedeem }) => (
              <article key={product.id} className="product-card">
                {productImageLoadErrors[product.id] ? (
                  <div className="product-image-fallback">Belako Merch</div>
                ) : (
                  <img
                    className="product-image"
                    src={product.imageUrl}
                    alt={`Merch Belako - ${product.name}`}
                    loading="lazy"
                    onError={() => setProductImageLoadErrors((prev) => ({ ...prev, [product.id]: true }))}
                  />
                )}
                <strong>{product.name}</strong>
                <div className="store-badges">
                  <span className="store-badge">MERCH</span>
                  <span className="store-badge store-badge-reward">{product.purchaseType === 'eur_only' ? 'EUR' : 'EUR/BEL'}</span>
                </div>
                <small>
                  Merch: €{product.fiatPrice.toFixed(2)} {product.limited ? '| Limitado' : ''}
                </small>
                {product.purchaseType === 'eur_or_bel' && product.belakoCoinCost != null ? (
                  <small>Canje recompensa: {product.belakoCoinCost} BEL</small>
                ) : null}
                <div className="product-actions">
                  <button onClick={() => openCheckout(product, 'fiat')}>
                    Comprar merch (€)
                  </button>
                  {product.purchaseType === 'eur_or_bel' ? (
                    <button className="ghost" onClick={() => openCheckout(product, 'coin')} disabled={!canRedeem}>
                      {!canRedeem ? 'BEL insuficiente' : 'Canjear con BEL'}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    );
  }

  if (fanTab === 'rewards') {
    const seasonEnd = new Date(seasonPass.seasonEndsAt);
    const daysToSeasonEnd = Math.max(0, Math.ceil((seasonEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return (
      <section className="stack">
        <article className="battle-pass-card">
          <div className="battle-pass-top">
            <p className="hero-kicker">BATTLE PASS</p>
            <span className="token-chip">Temporada: {seasonPass.seasonName}</span>
          </div>
          <h3>Superfan progression</h3>
          <p>
            Nivel {seasonPass.currentLevel} · {seasonPass.currentXp} XP
            {seasonPass.nextLevelXp > seasonPass.currentXp ? ` / ${seasonPass.nextLevelXp} XP` : ' · MAX'}
          </p>
          <div className="progress-track battle-track" aria-hidden="true">
            <div
              className="progress-fill battle-fill"
              style={{
                width: `${Math.min((seasonPass.currentXp / Math.max(seasonPass.nextLevelXp, 1)) * 100, 100)}%`
              }}
            />
          </div>
          <div className="battle-pass-meta">
            <small>Racha activa: {seasonPass.streakDays} días</small>
            <small>Finaliza en {daysToSeasonEnd} días</small>
          </div>
        </article>

        <article className="metric-card">
          <p>Niveles Battle Pass</p>
          <div className="battle-tier-grid">
            {seasonTiers.map((tier) => {
              const unlocked = seasonPass.currentXp >= tier.requiredXp;
              return (
                <article key={tier.id} className={`battle-tier-card ${unlocked ? 'unlocked' : ''}`}>
                  <strong>{tier.title}</strong>
                  <small>{tier.requiredXp} XP</small>
                  <small>{tier.rewardLabel}</small>
                  <button onClick={() => claimSeasonPassTier(tier.id)} disabled={!unlocked || tier.claimed}>
                    {tier.claimed ? 'Reclamada' : unlocked ? 'Reclamar' : 'Bloqueada'}
                  </button>
                </article>
              );
            })}
          </div>
        </article>

        <article className="metric-card">
          <p>Misiones activas</p>
          <div className="mission-grid">
            {seasonMissions.length === 0 ? (
              <p className="hint">No hay misiones activas en este momento.</p>
            ) : (
              seasonMissions.map((mission) => (
                <article key={mission.id} className={`mission-card mission-${mission.status}`}>
                  <div className="row actions-row">
                    <strong>{mission.title}</strong>
                    <span className="mission-xp">+{mission.xpReward} XP</span>
                  </div>
                  <small>{mission.description}</small>
                  <div className="progress-track" aria-hidden="true">
                    <div className="progress-fill" style={{ width: `${Math.min((mission.progress / mission.goal) * 100, 100)}%` }} />
                  </div>
                  <small>{mission.progress}/{mission.goal}</small>
                  <button onClick={() => claimSeasonMission(mission.id)} disabled={mission.status !== 'completed'}>
                    {mission.status === 'claimed' ? 'Reclamada' : mission.status === 'completed' ? 'Reclamar' : 'Completar'}
                  </button>
                </article>
              ))
            )}
          </div>
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
          <p>Belako Coin</p>
          <small>Saldo actual: {belakoCoins} BEL</small>
          <small>Hitos: ver directo (+{coinPolicy.watchReward} BEL) | compra merch (+{coinPolicy.purchaseReward} BEL)</small>
          <small>Límite diario por visualización: {coinPolicy.dailyWatchCoinCap} BEL</small>
          <small>{canUseCoinDiscount ? 'Puedes usar descuento en checkout.' : 'Consigue más BEL para activar descuento.'}</small>
        </article>

        <article className="metric-card">
          <p>Historial de recompensas</p>
          <div className="event-list">
            {rewardHistory.length === 0 ? (
              <p>Aún no hay movimientos.</p>
            ) : (
              rewardHistory.slice(0, 8).map((item) => (
                <p key={item.id}>
                  <span className={`history-tag history-${item.type}`}>{item.type.toUpperCase()}</span> {item.label} ({item.at})
                </p>
              ))
            )}
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
