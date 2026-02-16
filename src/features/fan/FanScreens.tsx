import { useEffect, useMemo, useRef, useState } from 'react';
import { products, streams } from '../../lib/mock-data';
import type { Address, ProfileSettings, StorePriceSort } from '../../lib/types';
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
    attendanceCount,
    spend,
    setFanTab,
    track,
    liveState,
    watchFullLive,
    claimFullLiveReward,
    currentStreamFullyWatched,
    fullLiveRewardUnlocked,
    fullLiveRewardClaimed,
    openCheckout,
    nextStream,
    journeyXp,
    journeyTiers,
    currentJourneyTier,
    nextJourneyTier,
    journeyProgressPercent,
    conversion,
    purchases,
    lastCompletedPurchaseId,
    profileSettings,
    profileSummary,
    updateProfileField,
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
    syncPurchaseInvoice,
    logoutSession
  } = model;
  const [storeSort, setStoreSort] = useState<StorePriceSort>('price_asc');
  const [homeFeedCount, setHomeFeedCount] = useState(6);
  const [productImageLoadErrors, setProductImageLoadErrors] = useState<Record<string, boolean>>({});
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileSettings>(profileSettings);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddressDraft);
  const [addressError, setAddressError] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [showFullscreenLive, setShowFullscreenLive] = useState(false);
  const purchaseEntries = useMemo(
    () => purchases.slice(0, 10),
    [purchases]
  );

  const homeSentinelRef = useRef<HTMLDivElement | null>(null);

  function isStreamLive(streamStart: string) {
    const start = new Date(streamStart).getTime();
    const nowTs = Date.now();
    const liveWindowMs = 1000 * 60 * 120;
    return nowTs >= start && nowTs < start + liveWindowMs;
  }

  function formatStreamSchedule(streamStart: string) {
    const start = new Date(streamStart);
    return start.toLocaleString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const sortedStoreProducts = useMemo(() => {
    return [...products].sort((a, b) =>
      storeSort === 'price_desc'
        ? b.fiatPrice - a.fiatPrice
        : a.fiatPrice - b.fiatPrice
    );
  }, [storeSort]);

  const homeFeedStreams = useMemo(() => {
    if (streams.length === 0) {
      return [];
    }
    if (streams.length === 1) {
      return [];
    }
    return Array.from({ length: homeFeedCount }, (_, index) => {
      const stream = streams[(index + 1) % streams.length];
      return {
        stream,
        virtualId: `${stream.id}-${index}`
      };
    });
  }, [homeFeedCount]);

  const nextScheduledStream = useMemo(() => {
    if (streams.length === 0) {
      return null;
    }
    const currentIndex = streams.findIndex((item) => item.id === activeStream.id);
    if (currentIndex < 0) {
      return streams[0];
    }
    return streams[(currentIndex + 1) % streams.length];
  }, [activeStream.id]);

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

  useEffect(() => {
    if (fanTab !== 'profile' || !lastCompletedPurchaseId) {
      return;
    }
    setOpenInvoiceId(lastCompletedPurchaseId);
  }, [fanTab, lastCompletedPurchaseId]);

  function resetAddressEditor() {
    setEditingAddressId(null);
    setShowAddressForm(false);
    setAddressDraft(emptyAddressDraft);
    setAddressError('');
  }

  function openProfileEditor() {
    setProfileDraft(profileSettings);
    setProfileEditing(true);
  }

  function closeProfileEditor() {
    setProfileDraft(profileSettings);
    setProfileEditing(false);
  }

  function saveProfileEditor() {
    const fields: Array<keyof Omit<ProfileSettings, 'notifications'>> = [
      'displayName',
      'username',
      'bio',
      'avatarUrl',
      'location',
      'website',
      'email',
      'phone',
      'language',
      'theme',
      'isPrivateProfile',
      'allowDm'
    ];

    fields.forEach((field) => {
      if (profileSettings[field] !== profileDraft[field]) {
        updateProfileField(field, profileDraft[field]);
      }
    });

    if (
      profileSettings.notifications.email !== profileDraft.notifications.email ||
      profileSettings.notifications.push !== profileDraft.notifications.push ||
      profileSettings.notifications.marketing !== profileDraft.notifications.marketing ||
      profileSettings.notifications.liveAlerts !== profileDraft.notifications.liveAlerts
    ) {
      updateProfileField('notifications', profileDraft.notifications);
    }

    setProfileEditing(false);
  }

  function openFullscreenLive() {
    if (!currentStreamFullyWatched) {
      watchFullLive();
    }
    setShowFullscreenLive(true);
  }

  if (fanTab === 'home') {
    return (
      <section className="stack">
        <article className={`hero-card belako-hero ${activeStream.colorClass}`}>
          <p className="hero-kicker">BELAKO SUPERFAN</p>
          <h2>Hoy en directo</h2>
          <h3>{activeStream.title}</h3>
          <p>{activeStream.rewardHint}</p>
          {nextScheduledStream ? (
            <small>Siguiente directo: {nextScheduledStream.title} · {formatStreamSchedule(nextScheduledStream.startsAt)}</small>
          ) : null}
          <button
            onClick={() => {
              if (isStreamLive(activeStream.startsAt)) {
                setFanTab('live');
                track('EVT_stream_join', `Entró al directo de ${activeStream.artist}`);
                return;
              }
              track('EVT_stream_register', `Registro al próximo directo de ${activeStream.artist}`);
            }}
          >
            {isStreamLive(activeStream.startsAt) ? 'Unirse' : 'Registrarse'}
          </button>
          <small>{isStreamLive(activeStream.startsAt) ? 'Acceso directo al live, sin registro adicional.' : `Empieza: ${formatStreamSchedule(activeStream.startsAt)}`}</small>
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
                    <p className="badge">{isStreamLive(stream.startsAt) ? 'EN DIRECTO' : 'PRÓXIMO'}</p>
                    <span className="token-chip">{stream.viewers} viendo</span>
                  </div>
                  <h3>{stream.artist}</h3>
                  <p>{stream.title}</p>
                  <small>{stream.genre}</small>
                  <small>Horario: {formatStreamSchedule(stream.startsAt)}</small>
                  <p className="hint">{stream.rewardHint}</p>
                  <button
                    onClick={() => {
                      if (isStreamLive(stream.startsAt)) {
                        setFanTab('live');
                        track('EVT_stream_join', `Entró al directo de ${stream.artist}`);
                        return;
                      }
                      track('EVT_stream_register', `Registro al próximo directo de ${stream.artist}`);
                    }}
                  >
                    {isStreamLive(stream.startsAt) ? 'Unirse' : 'Registrarse'}
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
          <small>Asistencia {attendanceCount} directos | Gasto €{spend.toFixed(2)}</small>
          <small>Compra segura en euros con Stripe.</small>
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
          {nextScheduledStream ? <small>Siguiente directo: {nextScheduledStream.title} · {formatStreamSchedule(nextScheduledStream.startsAt)}</small> : null}

          <div className="chat-box" aria-live="polite">
            <p>@ane: este drop es una locura</p>
            <p>@iker: temazo en directo</p>
            <p>@june: insignia superfan desbloqueada</p>
          </div>

          <div className="row">
            <button className={currentStreamFullyWatched ? 'ghost' : 'primary'} onClick={openFullscreenLive}>
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
          </div>
        </article>

        {showFullscreenLive ? (
          <article className="live-fullscreen" role="dialog" aria-modal="true" aria-label="Directo de Belako en pantalla completa">
            <div className="live-fullscreen-top">
              <span className="badge">EN DIRECTO</span>
              <button className="ghost" onClick={() => setShowFullscreenLive(false)}>Cerrar</button>
            </div>
            <iframe
              src="https://www.youtube.com/embed/l7TlAz1HvSk?autoplay=1&rel=0"
              title="Belako Live Fullscreen"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </article>
        ) : null}

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
            {sortedStoreProducts.map((product) => (
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
                  <span className="store-badge store-badge-reward">EUR</span>
                </div>
                <small>
                  Merch: €{product.fiatPrice.toFixed(2)} {product.limited ? '| Limitado' : ''}
                </small>
                <div className="product-actions">
                  <button onClick={() => openCheckout(product)}>Comprar merch (€)</button>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    );
  }

  if (fanTab === 'rewards') {
    return (
      <section className="stack">
        <article className="metric-card journey-card">
          <p className="hero-kicker">JOURNEY FAN BELAKO</p>
          <h3>{currentJourneyTier.title}</h3>
          <p>
            XP actual: {journeyXp}
            {nextJourneyTier ? ` · Próximo tier en ${nextJourneyTier.requiredXp} XP` : ' · Tier máximo alcanzado'}
          </p>
          <div className="progress-track battle-track" aria-hidden="true">
            <div className="progress-fill battle-fill" style={{ width: `${journeyProgressPercent}%` }} />
          </div>
          <small>{nextJourneyTier ? `${journeyXp}/${nextJourneyTier.requiredXp} XP` : `${journeyXp} XP · MAX`}</small>
        </article>

        <article className="metric-card">
          <p>Tiers de usuario</p>
          <div className="journey-tier-grid">
            {journeyTiers.map((tier) => {
              const status = tier.current ? 'Actual' : tier.unlocked ? 'Desbloqueado' : 'Bloqueado';
              return (
                <article key={tier.id} className={`journey-tier-card ${tier.current ? 'current' : tier.unlocked ? 'unlocked' : ''}`}>
                  <div className="row actions-row">
                    <strong>{tier.title}</strong>
                    <span className="store-badge">{status}</span>
                  </div>
                  <small>Umbral: {tier.requiredXp} XP</small>
                  <small>{tier.perkLabel}</small>
                  <small>{tier.progressLabel}</small>
                </article>
              );
            })}
          </div>
        </article>

        <article className="metric-card">
          <p>Recompensa por directo completo</p>
          <small>Verifica un directo entero para desbloquear este bonus.</small>
          <button onClick={claimFullLiveReward} disabled={!fullLiveRewardUnlocked}>
            {fullLiveRewardClaimed ? 'Reclamada' : fullLiveRewardUnlocked ? 'Reclamar recompensa' : 'Bloqueada'}
          </button>
        </article>

      </section>
    );
  }

  return (
    <section className="stack">
      {profileEditing ? (
        <article className="metric-card profile-editor-shell">
          <div className="profile-editor-head">
            <p className="profile-section-title">Editar perfil</p>
            <span className="store-badge">Belako Perfil Studio</span>
          </div>
          <p className="hint">Edita tu perfil y guarda cuando esté listo.</p>
          <div className="profile-form-grid profile-form-pro">
            <label>Nombre
              <input value={profileDraft.displayName} onChange={(e) => setProfileDraft((prev) => ({ ...prev, displayName: e.target.value }))} />
            </label>
            <label>Usuario
              <input value={profileDraft.username} onChange={(e) => setProfileDraft((prev) => ({ ...prev, username: e.target.value.replace(/\s+/g, '') }))} />
            </label>
            <label>Bio
              <textarea value={profileDraft.bio} onChange={(e) => setProfileDraft((prev) => ({ ...prev, bio: e.target.value }))} rows={3} />
            </label>
            <label>Avatar URL
              <input value={profileDraft.avatarUrl} onChange={(e) => setProfileDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))} />
            </label>
            <label>Ubicación
              <input value={profileDraft.location} onChange={(e) => setProfileDraft((prev) => ({ ...prev, location: e.target.value }))} />
            </label>
            <label>Web
              <input value={profileDraft.website} onChange={(e) => setProfileDraft((prev) => ({ ...prev, website: e.target.value }))} />
            </label>
            <label>Email
              <input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label>Teléfono
              <input value={profileDraft.phone || ''} onChange={(e) => setProfileDraft((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label>Idioma
              <select value={profileDraft.language} onChange={(e) => setProfileDraft((prev) => ({ ...prev, language: e.target.value as 'es' | 'en' }))}>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileDraft.isPrivateProfile} onChange={() => setProfileDraft((prev) => ({ ...prev, isPrivateProfile: !prev.isPrivateProfile }))} />
              Perfil privado
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileDraft.allowDm} onChange={() => setProfileDraft((prev) => ({ ...prev, allowDm: !prev.allowDm }))} />
              Permitir mensajes directos
            </label>
            <p>Notificaciones</p>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileDraft.notifications.email} onChange={() => setProfileDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, email: !prev.notifications.email } }))} />
              Email
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileDraft.notifications.push} onChange={() => setProfileDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, push: !prev.notifications.push } }))} />
              Notificaciones push
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileDraft.notifications.marketing} onChange={() => setProfileDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, marketing: !prev.notifications.marketing } }))} />
              Marketing y promociones
            </label>
            <label className="checkbox-line">
              <input type="checkbox" checked={profileDraft.notifications.liveAlerts} onChange={() => setProfileDraft((prev) => ({ ...prev, notifications: { ...prev.notifications, liveAlerts: !prev.notifications.liveAlerts } }))} />
              Alertas de directos
            </label>
          </div>
          <div className="row actions-row">
            <button className="ghost" onClick={closeProfileEditor}>Cerrar editor</button>
            <button className="primary" onClick={saveProfileEditor}>Guardar cambios</button>
          </div>
        </article>
      ) : null}

      <article className="profile-hero-card profile-cover">
        <div className="profile-cover-glow" aria-hidden="true" />
        <img className="profile-avatar" src={profileSettings.avatarUrl} alt={`Avatar ${profileSummary.displayName}`} />
        <div className="profile-hero-copy">
          <p className="hero-kicker">PERFIL SUPERFAN</p>
          <h2>{profileSummary.displayName}</h2>
          <p>@{profileSummary.username}</p>
          <small>{profileSettings.bio}</small>
          <small>{profileSettings.location} · {profileSettings.website}</small>
        </div>
        <div className="profile-hero-actions">
          <button className="ghost" onClick={openProfileEditor}>Editar perfil</button>
        </div>
      </article>

      <article className="profile-kpi-grid">
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
        <h3>{currentJourneyTier.title}</h3>
        <small>
          XP {journeyXp}
          {nextJourneyTier ? ` / ${nextJourneyTier.requiredXp}` : ' · MAX'}
        </small>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${journeyProgressPercent}%` }} />
        </div>
        <small>Conversión fan: {conversion}%</small>
        <div className="row actions-row">
          <button onClick={() => setFanTab('rewards')}>Ver progreso</button>
        </div>
      </article>

      <article className="metric-card profile-card">
        <p className="profile-section-title">Configuración de cuenta</p>
        <div className="profile-summary-grid">
          <small>Email: {profileSettings.email || 'No configurado'}</small>
          <small>Teléfono: {profileSettings.phone || 'No configurado'}</small>
          <small>Idioma: {profileSettings.language.toUpperCase()}</small>
          <small>Privacidad: {profileSettings.isPrivateProfile ? 'Privado' : 'Público'}</small>
          <small>DM: {profileSettings.allowDm ? 'Permitidos' : 'Bloqueados'}</small>
        </div>
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
                  {method.isDefault ? <span className="store-badge">Por defecto</span> : <button className="ghost" onClick={() => setDefaultSavedMethod(method.id)}>Usar por defecto</button>}
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
                    <small><strong>Factura:</strong> {purchase.stripePaymentIntentId || `INV-${purchase.id.slice(-6).toUpperCase()}`}</small>
                    <small><strong>Cliente:</strong> {purchase.customerName || profileSummary.displayName}</small>
                    <small><strong>Email:</strong> {purchase.customerEmail || profileSettings.email}</small>
                    <small><strong>Concepto:</strong> {purchase.label}</small>
                    <small><strong>Fecha:</strong> {purchase.at}</small>
                    <small><strong>Importe:</strong> €{purchase.amountEur.toFixed(2)}</small>
                    <small><strong>Estado:</strong> {purchase.status === 'paid' ? 'Pagada' : purchase.status}</small>

                    {purchase.stripeReceiptUrl ? (
                      <a className="ghost ghost-link" href={purchase.stripeReceiptUrl} target="_blank" rel="noreferrer">
                        Ver recibo Stripe
                      </a>
                    ) : null}
                    {purchase.stripeInvoicePdfUrl ? (
                      <a className="ghost ghost-link" href={purchase.stripeInvoicePdfUrl} target="_blank" rel="noreferrer">
                        Descargar factura Stripe (PDF)
                      </a>
                    ) : null}
                    {purchase.stripeHostedInvoiceUrl ? (
                      <a className="ghost ghost-link" href={purchase.stripeHostedInvoiceUrl} target="_blank" rel="noreferrer">
                        Ver factura alojada
                      </a>
                    ) : null}

                    {!purchase.stripeReceiptUrl && !purchase.stripeInvoicePdfUrl && (purchase.stripeSessionId || purchase.stripePaymentIntentId) ? (
                      <button className="ghost" onClick={() => syncPurchaseInvoice(purchase.id)}>
                        Sincronizar factura real de Stripe
                      </button>
                    ) : null}
                    {purchase.invoiceError ? <small className="error-text">{purchase.invoiceError}</small> : null}
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
