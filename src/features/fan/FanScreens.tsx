import { useEffect, useMemo, useRef, useState } from 'react';
import { products, streams } from '../../lib/mock-data';
import type { Address, StorePriceSort } from '../../lib/types';
import type { FidelityModel } from '../../state/use-fidelity-state';
import { liveBadgeText } from '../../state/use-fidelity-state';

type AddressDraft = {
  label: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
};

const emptyAddressDraft: AddressDraft = {
  label: '',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  country: 'España'
};

function toAddressDraft(address: Address): AddressDraft {
  return {
    label: address.label,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 || '',
    city: address.city,
    postalCode: address.postalCode,
    country: address.country
  };
}

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
    coinPolicy,
    canUseCoinDiscount,
    rewardHistory,
    seasonPass,
    seasonTiers,
    seasonMissions,
    claimSeasonPassTier,
    claimSeasonMission,
    profileSettings,
    profileSummary,
    updateProfileField,
    toggleNotification,
    addresses,
    addAddress,
    editAddress,
    removeAddress,
    billingProfile,
    billingLoading,
    billingError,
    openCardSetup,
    refreshPaymentMethods,
    setDefaultSavedMethod,
    removeSavedMethod,
    logoutSession
  } = model;
  const [storeSort, setStoreSort] = useState<StorePriceSort>('price_asc');
  const [homeFeedCount, setHomeFeedCount] = useState(6);
  const [productImageLoadErrors, setProductImageLoadErrors] = useState<Record<string, boolean>>({});
  const [profileEditing, setProfileEditing] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddressDraft);
  const [addressError, setAddressError] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const purchaseEntries = useMemo(
    () => rewardHistory.filter((entry) => entry.type === 'purchase').slice(0, 6),
    [rewardHistory]
  );

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

  function resetAddressEditor() {
    setEditingAddressId(null);
    setShowAddressForm(false);
    setAddressDraft(emptyAddressDraft);
    setAddressError('');
  }

  async function shareProfile() {
    const profileUrl = `${window.location.origin}${window.location.pathname}#@${profileSummary.username}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Belako Superfan',
          text: `Perfil fan de @${profileSummary.username}`,
          url: profileUrl
        });
      } else {
        await navigator.clipboard.writeText(profileUrl);
      }
      track('EVT_profile_shared', 'Perfil compartido');
    } catch {
      // user cancelled share flow
    }
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
                  <button onClick={() => openCheckout(product, 'fiat')}>Comprar merch (€)</button>
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
      <article className="profile-hero-card profile-cover">
        <div className="profile-cover-glow" aria-hidden="true" />
        <img className="profile-avatar" src={profileSettings.avatarUrl} alt={`Avatar ${profileSummary.displayName}`} />
        <div className="profile-hero-copy">
          <p className="hero-kicker">SUPERFAN PROFILE</p>
          <h2>{profileSummary.displayName}</h2>
          <p>@{profileSummary.username}</p>
          <small>{profileSettings.bio}</small>
          <small>{profileSettings.location} · {profileSettings.website}</small>
        </div>
        <div className="profile-hero-actions">
          <button className="ghost" onClick={() => setProfileEditing((prev) => !prev)}>{profileEditing ? 'Cerrar edición' : 'Editar perfil'}</button>
          <button className="ghost" onClick={shareProfile}>Compartir perfil</button>
        </div>
      </article>

      <article className="profile-kpi-grid">
        <div className="profile-kpi-card">
          <small>BEL Coin</small>
          <strong>{belakoCoins}</strong>
        </div>
        <div className="profile-kpi-card">
          <small>Asistencia</small>
          <strong>{attendanceCount} directos</strong>
        </div>
        <div className="profile-kpi-card">
          <small>Gasto total</small>
          <strong>€{spend.toFixed(2)}</strong>
        </div>
      </article>

      <article className="metric-card profile-card fan-prime-card">
        <p className="profile-section-title">Resumen fan</p>
        <h3>{tiers[2].unlocked ? 'Superfan Belako' : tiers[1].unlocked ? 'Fan premium' : tiers[0].unlocked ? 'Fan activo' : 'Fan en progreso'}</h3>
        <small>Nivel temporada: {seasonPass.currentLevel} · XP {seasonPass.currentXp}/{seasonPass.nextLevelXp}</small>
        <div className="progress-track" aria-hidden="true">
          <div
            className="progress-fill"
            style={{ width: `${Math.min((seasonPass.currentXp / Math.max(seasonPass.nextLevelXp, 1)) * 100, 100)}%` }}
          />
        </div>
        <small>Racha: {seasonPass.streakDays} días · Conversión fan: {conversion}%</small>
        <div className="row actions-row">
          <button onClick={() => setFanTab('rewards')}>Ver progreso</button>
        </div>
      </article>

      <article className="metric-card profile-card">
        <p className="profile-section-title">Configuración de cuenta</p>
        <div className="row actions-row">
          <span className="store-badge">{profileSettings.theme.toUpperCase()}</span>
        </div>

        {profileEditing ? (
          <div className="profile-form-grid">
            <label>Nombre
              <input value={profileSettings.displayName} onChange={(e) => updateProfileField('displayName', e.target.value)} />
            </label>
            <label>Usuario
              <input value={profileSettings.username} onChange={(e) => updateProfileField('username', e.target.value.replace(/\s+/g, ''))} />
            </label>
            <label>Bio
              <textarea value={profileSettings.bio} onChange={(e) => updateProfileField('bio', e.target.value)} rows={3} />
            </label>
            <label>Avatar URL
              <input value={profileSettings.avatarUrl} onChange={(e) => updateProfileField('avatarUrl', e.target.value)} />
            </label>
            <label>Ubicación
              <input value={profileSettings.location} onChange={(e) => updateProfileField('location', e.target.value)} />
            </label>
            <label>Website
              <input value={profileSettings.website} onChange={(e) => updateProfileField('website', e.target.value)} />
            </label>
            <label>Email
              <input type="email" value={profileSettings.email} onChange={(e) => updateProfileField('email', e.target.value)} />
            </label>
            <label>Teléfono
              <input value={profileSettings.phone || ''} onChange={(e) => updateProfileField('phone', e.target.value)} />
            </label>
            <label>Idioma
              <select value={profileSettings.language} onChange={(e) => updateProfileField('language', e.target.value as 'es' | 'en')}>
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>Tema
              <select value={profileSettings.theme} onChange={(e) => updateProfileField('theme', e.target.value as 'dark' | 'light')}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>

            <label className="checkbox-line">
              <input type="checkbox" checked={profileSettings.isPrivateProfile} onChange={() => updateProfileField('isPrivateProfile', !profileSettings.isPrivateProfile)} />
              Perfil privado
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileSettings.allowDm} onChange={() => updateProfileField('allowDm', !profileSettings.allowDm)} />
              Permitir mensajes directos
            </label>

            <p>Notificaciones</p>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileSettings.notifications.email} onChange={() => toggleNotification('email')} />
              Email
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileSettings.notifications.push} onChange={() => toggleNotification('push')} />
              Push
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileSettings.notifications.marketing} onChange={() => toggleNotification('marketing')} />
              Marketing
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileSettings.notifications.liveAlerts} onChange={() => toggleNotification('liveAlerts')} />
              Alertas live
            </label>
          </div>
        ) : (
          <div className="profile-summary-grid">
            <small>Email: {profileSettings.email || 'No configurado'}</small>
            <small>Teléfono: {profileSettings.phone || 'No configurado'}</small>
            <small>Idioma: {profileSettings.language.toUpperCase()}</small>
            <small>Privacidad: {profileSettings.isPrivateProfile ? 'Privado' : 'Público'}</small>
            <small>DM: {profileSettings.allowDm ? 'Permitidos' : 'Bloqueados'}</small>
          </div>
        )}
      </article>

      <article className="metric-card profile-card">
        <p className="profile-section-title">Métodos de pago</p>
        <div className="row actions-row">
          <div className="inline-actions">
            <button className="ghost" onClick={refreshPaymentMethods} disabled={billingLoading}>Actualizar</button>
            <button className="ghost" onClick={openCardSetup}>Añadir tarjeta</button>
          </div>
        </div>

        {billingLoading ? <p className="hint">Cargando métodos de pago...</p> : null}
        {billingError ? <p className="error-text">{billingError}</p> : null}

        {!billingLoading && !billingProfile?.methods.length ? (
          <p className="hint">No tienes tarjetas guardadas. Añade una para acelerar tu checkout.</p>
        ) : null}

        {!billingLoading && billingProfile?.methods.length ? (
          <div className="saved-methods">
            {billingProfile.methods.map((method) => (
              <article key={method.id} className="saved-method-item">
                <strong>{method.brand.toUpperCase()} •••• {method.last4}</strong>
                <small>Caduca {method.expMonth}/{method.expYear}</small>
                <div className="row actions-row">
                  {method.isDefault ? <span className="store-badge">Por defecto</span> : <button className="ghost" onClick={() => setDefaultSavedMethod(method.id)}>Hacer default</button>}
                  <button className="ghost" onClick={() => removeSavedMethod(method.id)}>Eliminar</button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>

      <article className="metric-card profile-card">
        <p className="profile-section-title">Direcciones</p>
        <div className="row actions-row">
          <small>
            Envío por defecto: {profileSummary.defaultShipping ? profileSummary.defaultShipping.label : 'No definido'}
          </small>
          <button
            className="ghost"
            onClick={() => {
              setEditingAddressId(null);
              setAddressDraft(emptyAddressDraft);
              setAddressError('');
              setShowAddressForm(true);
            }}
          >
            Nueva dirección
          </button>
        </div>

        <div className="address-list address-list-pro">
          {addresses.length === 0 ? <p className="hint">No hay direcciones guardadas.</p> : null}
          {addresses.map((address) => (
            <article key={address.id} className="address-card">
              <div className="address-card-top">
                <strong>{address.label}</strong>
                <div className="store-badges">
                  {address.isDefaultShipping ? <span className="store-badge">ENVÍO</span> : null}
                  {address.isDefaultBilling ? <span className="store-badge store-badge-reward">FACTURA</span> : null}
                </div>
              </div>
              <small>{address.fullName}</small>
              <small>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</small>
              <small>{address.city} · {address.postalCode} · {address.country}</small>
              <div className="store-badges">
                <button className="ghost" onClick={() => {
                  setEditingAddressId(address.id);
                  setAddressDraft(toAddressDraft(address));
                  setAddressError('');
                  setShowAddressForm(true);
                }}>Editar</button>
                <button className="ghost" onClick={() => removeAddress(address.id)}>Eliminar</button>
              </div>
            </article>
          ))}
        </div>

        {showAddressForm ? (
          <article className="summary-box address-form-shell">
            <p>{editingAddressId ? 'Editar dirección' : 'Nueva dirección'}</p>
            <div className="profile-form-grid">
              <label>Etiqueta
                <input value={addressDraft.label} onChange={(e) => setAddressDraft((prev) => ({ ...prev, label: e.target.value }))} />
              </label>
              <label>Nombre completo
                <input value={addressDraft.fullName} onChange={(e) => setAddressDraft((prev) => ({ ...prev, fullName: e.target.value }))} />
              </label>
              <label>Dirección
                <input value={addressDraft.line1} onChange={(e) => setAddressDraft((prev) => ({ ...prev, line1: e.target.value }))} />
              </label>
              <label>Línea 2
                <input value={addressDraft.line2} onChange={(e) => setAddressDraft((prev) => ({ ...prev, line2: e.target.value }))} />
              </label>
              <div className="row">
                <label>Ciudad
                  <input value={addressDraft.city} onChange={(e) => setAddressDraft((prev) => ({ ...prev, city: e.target.value }))} />
                </label>
                <label>CP
                  <input value={addressDraft.postalCode} onChange={(e) => setAddressDraft((prev) => ({ ...prev, postalCode: e.target.value }))} />
                </label>
              </div>
              <label>País
                <input value={addressDraft.country} onChange={(e) => setAddressDraft((prev) => ({ ...prev, country: e.target.value }))} />
              </label>
            </div>
            {addressError ? <p className="error-text">{addressError}</p> : null}
            <div className="row actions-row">
              <button
                onClick={() => {
                  if (!addressDraft.label || !addressDraft.fullName || !addressDraft.line1 || !addressDraft.city || !addressDraft.postalCode) {
                    setAddressError('Completa los campos obligatorios: etiqueta, nombre, dirección, ciudad y CP.');
                    return;
                  }
                  if (editingAddressId) {
                    editAddress(editingAddressId, addressDraft);
                  } else {
                    addAddress(addressDraft);
                  }
                  resetAddressEditor();
                }}
              >
                {editingAddressId ? 'Guardar cambios' : 'Añadir dirección'}
              </button>
              <button className="ghost" onClick={resetAddressEditor}>Cancelar</button>
            </div>
          </article>
        ) : null}
      </article>

      <article className="metric-card profile-card">
        <p className="profile-section-title">Compras</p>
        {purchaseEntries.length === 0 ? (
          <p className="hint">Todavía no hay compras registradas.</p>
        ) : (
          <div className="event-list">
            {purchaseEntries.map((purchase) => (
              <article key={purchase.id} className="purchase-item">
                <strong>{purchase.label}</strong>
                <small>{purchase.at}</small>
                <button
                  className="ghost"
                  onClick={() => setOpenInvoiceId((prev) => (prev === purchase.id ? null : purchase.id))}
                >
                  {openInvoiceId === purchase.id ? 'Ocultar factura' : 'Ver factura'}
                </button>
                {openInvoiceId === purchase.id ? (
                  <div className="invoice-box">
                    <small><strong>Factura:</strong> INV-{purchase.id.slice(-6).toUpperCase()}</small>
                    <small><strong>Cliente:</strong> {profileSummary.displayName}</small>
                    <small><strong>Concepto:</strong> {purchase.label}</small>
                    <small><strong>Fecha:</strong> {purchase.at}</small>
                    <small><strong>Estado:</strong> Pagada</small>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
        <div className="row actions-row">
          <button onClick={() => setFanTab('store')}>Ir a tienda</button>
        </div>
      </article>

      <article className="metric-card profile-card">
        <p className="profile-section-title">Seguridad</p>
        <small>Mantén tu cuenta protegida en este dispositivo.</small>
        <div className="row actions-row security-actions">
          <button
            className="ghost"
            onClick={() => {
              setShowPasswordForm((prev) => !prev);
              setPasswordError('');
            }}
          >
            {showPasswordForm ? 'Cerrar gestión contraseña' : 'Gestionar contraseña'}
          </button>
        </div>
        {showPasswordForm ? (
          <article className="summary-box address-form-shell">
            <p>Cambiar contraseña</p>
            <div className="profile-form-grid">
              <label>Contraseña actual
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
                />
              </label>
              <label>Nueva contraseña
                <input
                  type="password"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                />
              </label>
              <label>Confirmar nueva contraseña
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                />
              </label>
            </div>
            {passwordError ? <p className="error-text">{passwordError}</p> : null}
            <div className="row actions-row">
              <button
                onClick={() => {
                  if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
                    setPasswordError('Completa todos los campos.');
                    return;
                  }
                  if (passwordForm.next.length < 8) {
                    setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.');
                    return;
                  }
                  if (passwordForm.next !== passwordForm.confirm) {
                    setPasswordError('La confirmación no coincide con la nueva contraseña.');
                    return;
                  }
                  setPasswordError('');
                  setPasswordForm({ current: '', next: '', confirm: '' });
                  setShowPasswordForm(false);
                  track('EVT_password_change_requested', 'Solicitud de cambio de contraseña desde perfil');
                }}
              >
                Guardar contraseña
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setPasswordForm({ current: '', next: '', confirm: '' });
                  setPasswordError('');
                }}
              >
                Limpiar
              </button>
            </div>
            <small>En MVP este cambio se registra localmente hasta conectar endpoint backend.</small>
          </article>
        ) : null}
      </article>

      <div className="row actions-row">
        <button className="ghost" onClick={logoutSession}>Cerrar sesión</button>
      </div>
    </section>
  );
}
