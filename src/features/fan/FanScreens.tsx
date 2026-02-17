import { useEffect, useMemo, useState } from 'react';
import type { Address, ProfileSettings, StorePriceSort } from '../../lib/types';
import type { FidelityModel } from '../../state/use-fidelity-state';

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
const LIVE_EMBED_URL = 'https://www.youtube.com/embed/l7TlAz1HvSk?start=650&autoplay=1&rel=0';

function toEmbedUrl(url: string | undefined): string {
  if (!url) {
    return LIVE_EMBED_URL;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') && parsed.pathname === '/watch') {
      const videoId = parsed.searchParams.get('v');
      const start = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '0';
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?start=${String(start).replace(/s$/, '')}&autoplay=1&rel=0`;
      }
    }
  } catch {
    return LIVE_EMBED_URL;
  }
  return LIVE_EMBED_URL;
}

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
    registeredStreamIds,
    joinedLiveCount,
    concertTicketCount,
    merchPurchaseCount,
    setFanTab,
    joinLiveStream,
    registerStreamReminder,
    claimFullLiveReward,
    openConcertTicketCheckout,
    hasConcertTicket,
    fullLiveRewardUnlocked,
    fullLiveRewardClaimed,
    liveCatalog,
    storeCatalog,
    concertCatalog,
    dynamicRewards,
    xpActions,
    openCheckout,
    journeyXp,
    journeyTiers,
    currentJourneyTier,
    nextJourneyTier,
    journeyProgressPercent,
    conversion,
    progressLastSavedAt,
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
    logoutSession,
    deleteAccountSession
  } = model;
  const [storeSort, setStoreSort] = useState<StorePriceSort>('price_asc');
  const [productImageLoadErrors, setProductImageLoadErrors] = useState<Record<string, boolean>>({});
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileSettings>(profileSettings);
  const [avatarUploadError, setAvatarUploadError] = useState('');
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(emptyAddressDraft);
  const [addressError, setAddressError] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [showFullscreenLive, setShowFullscreenLive] = useState(false);
  const purchaseEntries = useMemo(
    () => purchases.slice(0, 10),
    [purchases]
  );

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
    return [...storeCatalog].sort((a, b) =>
      storeSort === 'price_desc'
        ? b.fiatPrice - a.fiatPrice
        : a.fiatPrice - b.fiatPrice
    );
  }, [storeSort, storeCatalog]);

  const homeFeedStreams = useMemo(() => {
    if (liveCatalog.length === 0) {
      return [];
    }
    const uniqueById = new Map<string, (typeof liveCatalog)[number]>();
    liveCatalog.forEach((stream) => {
      if (!uniqueById.has(stream.id)) {
        uniqueById.set(stream.id, stream);
      }
    });
    return Array.from(uniqueById.values())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .map((stream) => ({ stream, virtualId: stream.id }));
  }, [liveCatalog]);

  const nextScheduledStream = useMemo(() => {
    if (liveCatalog.length === 0) {
      return null;
    }
    const currentIndex = liveCatalog.findIndex((item) => item.id === activeStream.id);
    if (currentIndex < 0) {
      return liveCatalog[0];
    }
    return liveCatalog[(currentIndex + 1) % liveCatalog.length];
  }, [activeStream.id, liveCatalog]);

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
    setAvatarUploadError('');
    setProfileEditing(true);
  }

  function closeProfileEditor() {
    setProfileDraft(profileSettings);
    setAvatarUploadError('');
    setProfileEditing(false);
  }

  function handleAvatarFileSelected(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setAvatarUploadError('Selecciona una imagen válida (JPG, PNG, WEBP...).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadError('La imagen supera 5MB. Sube una versión más ligera.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setAvatarUploadError('No se pudo leer la imagen seleccionada.');
        return;
      }
      setAvatarUploadError('');
      setProfileDraft((prev) => ({ ...prev, avatarUrl: result }));
    };
    reader.onerror = () => {
      setAvatarUploadError('No se pudo procesar la imagen.');
    };
    reader.readAsDataURL(file);
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

  function isRegisteredForStream(streamId: string) {
    return registeredStreamIds.includes(streamId);
  }

  function openLiveFullscreen(streamId: string) {
    joinLiveStream(streamId);
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
                openLiveFullscreen(activeStream.id);
                return;
              }
              registerStreamReminder(activeStream.id);
            }}
            className={!isStreamLive(activeStream.startsAt) && isRegisteredForStream(activeStream.id) ? 'ghost' : 'primary'}
            disabled={!isStreamLive(activeStream.startsAt) && isRegisteredForStream(activeStream.id)}
          >
            {isStreamLive(activeStream.startsAt) ? 'Unirse' : isRegisteredForStream(activeStream.id) ? 'Registrado' : 'Registrarse'}
          </button>
          <small>
            {isStreamLive(activeStream.startsAt)
              ? 'Acceso directo al live, sin registro adicional.'
              : isRegisteredForStream(activeStream.id)
                ? 'Ya estás registrado para este concierto.'
                : `Empieza: ${formatStreamSchedule(activeStream.startsAt)}`}
          </small>
        </article>

        {liveCatalog.length === 0 ? (
          <article className="metric-card empty-state">
            <h3>No hay directos ahora mismo</h3>
            <p>Te avisaremos cuando Belako empiece el siguiente show.</p>
          </article>
        ) : (
          <>
            <h2>Descubrimiento</h2>
            <div className="home-feed" aria-label="Listado de directos ordenado">
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
                        openLiveFullscreen(stream.id);
                        return;
                      }
                      registerStreamReminder(stream.id);
                    }}
                    className={!isStreamLive(stream.startsAt) && isRegisteredForStream(stream.id) ? 'ghost' : 'primary'}
                    disabled={!isStreamLive(stream.startsAt) && isRegisteredForStream(stream.id)}
                  >
                    {isStreamLive(stream.startsAt) ? 'Unirse' : isRegisteredForStream(stream.id) ? 'Registrado' : 'Registrarse'}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}

        <article className="metric-card">
          <p>Resumen rapido</p>
          <small>Asistencia {attendanceCount} directos | Gasto €{spend.toFixed(2)}</small>
          <small>XP: directos vistos {joinedLiveCount} | compras merch {merchPurchaseCount} | entradas {concertTicketCount}</small>
          <small>Compra segura en euros con Stripe.</small>
        </article>

        {showFullscreenLive ? (
          <article className="live-fullscreen" role="dialog" aria-modal="true" aria-label="Directo de Belako en pantalla completa">
            <div className="live-fullscreen-top">
              <span className="badge">EN DIRECTO</span>
              <button className="ghost" onClick={() => setShowFullscreenLive(false)}>Cerrar</button>
            </div>
            <iframe
              src={toEmbedUrl(activeStream.youtubeUrl)}
              title="Belako Live Fullscreen"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </article>
        ) : null}
      </section>
    );
  }

  if (fanTab === 'live') {
    return (
      <section className="stack">
        <article className="guide-card">
          <h3>Conciertos Belako</h3>
          <p>Explora próximos conciertos y compra tus entradas desde aquí.</p>
        </article>

        <article className="metric-card">
          <p>Próximos conciertos</p>
          <div className="xp-action-list">
            {concertCatalog.map((ticket) => {
              const purchased = hasConcertTicket(ticket.id);
              const isExternal = ticket.ticketingMode === 'external';
              return (
                <article key={ticket.id} className="xp-action-item">
                  <strong>{ticket.title}</strong>
                  <small>{formatStreamSchedule(ticket.startsAt)} · {ticket.venue} ({ticket.city})</small>
                  <div className="ticketing-meta">
                    <span className={`ticketing-badge ${isExternal ? 'is-external' : 'is-belako'}`}>
                      {isExternal ? 'Evento externo' : 'Ticketing Belako'}
                    </span>
                    <small>{isExternal ? 'Pago fuera de la app' : 'Pago en app'}</small>
                  </div>
                  <div className="row actions-row">
                    <span className="store-badge">€{ticket.priceEur.toFixed(2)}</span>
                    <button
                      className={isExternal ? 'ghost' : purchased ? 'ghost' : 'primary buy-ticket-cta'}
                      onClick={() => openConcertTicketCheckout(ticket.id)}
                      disabled={!isExternal && purchased}
                    >
                      {isExternal ? 'Ir a ticketing externo' : purchased ? 'Entrada comprada' : 'Comprar entrada'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </article>
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
          <p>Cómo ganar experiencia</p>
          <div className="xp-action-list">
            {xpActions.map((action) => (
              <div className="xp-action-item" key={action.code}>
                <strong>{action.label}</strong>
                <small>+{action.xpValue} XP</small>
                <span className="store-badge">
                  {action.code === 'join_live' ? `${joinedLiveCount} completados` : null}
                  {action.code === 'buy_merch' ? `${merchPurchaseCount} compras` : null}
                  {action.code === 'buy_ticket' ? `${concertTicketCount} entradas` : null}
                  {action.code === 'watch_full_live' ? `${attendanceCount} directos completos` : null}
                </span>
              </div>
            ))}
          </div>
        </article>

        {dynamicRewards.length ? (
          <article className="metric-card">
            <p>Recompensas activas</p>
            <div className="xp-action-list">
              {dynamicRewards.map((reward) => (
                <div className="xp-action-item" key={reward.id}>
                  <strong>{reward.title}</strong>
                  <small>{reward.description}</small>
                  <span className="store-badge">Bonus XP: +{reward.xpBonus}</span>
                </div>
              ))}
            </div>
          </article>
        ) : null}

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
            <article className="summary-box">
              <p>Avatar</p>
              <img className="profile-avatar" src={profileDraft.avatarUrl} alt={`Preview avatar ${profileDraft.displayName || profileDraft.username || 'fan'}`} />
              <label className="ghost ghost-link">
                Subir foto (móvil/desktop)
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={(e) => handleAvatarFileSelected(e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
              <small className="hint">Formatos: JPG, PNG, WEBP. Máximo 5MB.</small>
              {avatarUploadError ? <small className="error-text">{avatarUploadError}</small> : null}
            </article>
            <label>Ubicación
              <input value={profileDraft.location} onChange={(e) => setProfileDraft((prev) => ({ ...prev, location: e.target.value }))} />
            </label>
            <label>Web
              <input value={profileDraft.website} onChange={(e) => setProfileDraft((prev) => ({ ...prev, website: e.target.value }))} />
            </label>
            <label>Email
              <input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft((prev) => ({ ...prev, email: e.target.value }))} />
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
          <small>Idioma: {profileSettings.language.toUpperCase()}</small>
          <small>Privacidad: {profileSettings.isPrivateProfile ? 'Privado' : 'Público'}</small>
          <small>DM: {profileSettings.allowDm ? 'Permitidos' : 'Bloqueados'}</small>
          <small>Progreso guardado: XP {journeyXp} · Conversión {conversion}%</small>
          <small>Última actualización: {progressLastSavedAt || 'Pendiente'}</small>
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
                    <small><strong>Factura:</strong> {purchase.stripePaymentIntentId || 'Pendiente de sincronizar con Stripe'}</small>
                    <small><strong>Cliente:</strong> {purchase.customerName || 'Pendiente'}</small>
                    <small><strong>Email:</strong> {purchase.customerEmail || 'Pendiente'}</small>
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
        <small>Inicio de sesión gestionado con Google SSO. No se usan contraseñas locales en la app.</small>
      </article>

      <div className="row actions-row">
        <button className="ghost" onClick={logoutSession}>Cerrar sesión</button>
        <button
          className="ghost danger-btn"
          onClick={() => {
            const confirmed = window.confirm('Esta acción borrará tu cuenta y no se puede deshacer. ¿Quieres continuar?');
            if (!confirmed) {
              return;
            }
            void deleteAccountSession();
          }}
        >
          Borrar cuenta
        </button>
      </div>
    </section>
  );
}
