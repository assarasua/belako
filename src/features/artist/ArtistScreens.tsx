import { products } from '../../lib/mock-data';
import type { FidelityModel } from '../../state/use-fidelity-state';

export function ArtistScreens({ model }: { model: FidelityModel }) {
  const {
    artistTab,
    activeStream,
    conversion,
    spend,
    artistOnboardingDone,
    artistLive,
    artistSocialConnected,
    startArtistOnboarding,
    completeArtistOnboarding,
    artistStreamTitle,
    setArtistStreamTitle,
    artistPinnedItem,
    setArtistPinnedItem,
    toggleArtistLive,
    setSheet,
    openCheckout,
    artistModerationOpen,
    setArtistModerationOpen,
    attendanceCount,
    tiers
  } = model;

  if (artistTab === 'dashboard') {
    return (
      <section className="stack">
        <h2>Panel de Belako</h2>
        <article className="metric-card">
          <p>Viewers en directo</p>
          <h3>{activeStream.viewers}</h3>
        </article>
        <article className="metric-card">
          <p>Conversion a superfan</p>
          <h3>{conversion}%</h3>
        </article>
        <article className="metric-card">
          <p>GMV merch</p>
          <h3>€{spend * 22}</h3>
        </article>
        <article className="metric-card">
          <p>Checklist</p>
          <small>{artistOnboardingDone ? 'Onboarding completado' : 'Completar onboarding'}</small>
          <small>{artistLive ? 'Directo activo' : 'Directo inactivo'}</small>
        </article>
      </section>
    );
  }

  if (artistTab === 'golive') {
    return (
      <section className="stack">
        <h2>Emitir en directo</h2>

        <article className="metric-card">
          <p>Onboarding equipo</p>
          <div className="row">
            <button onClick={startArtistOnboarding} disabled={artistSocialConnected}>
              {artistSocialConnected ? 'Redes conectadas' : 'Conectar TikTok + IG'}
            </button>
            <button onClick={completeArtistOnboarding} disabled={!artistSocialConnected || artistOnboardingDone}>
              {artistOnboardingDone ? 'Setup listo' : 'Finalizar niveles'}
            </button>
          </div>
        </article>

        <article className="metric-card">
          <label className="input-label" htmlFor="streamTitle">
            Titulo del directo
          </label>
          <input id="streamTitle" value={artistStreamTitle} onChange={(e) => setArtistStreamTitle(e.target.value)} />
          <label className="input-label" htmlFor="pinnedItem">
            Producto/subasta fijada
          </label>
          <input id="pinnedItem" value={artistPinnedItem} onChange={(e) => setArtistPinnedItem(e.target.value)} />
          <p>Regla: 3 directos -&gt; slot Meet and Greet</p>
          <button className="primary" onClick={toggleArtistLive} disabled={!artistOnboardingDone && !artistLive}>
            {artistLive ? 'Finalizar directo' : 'Iniciar directo'}
          </button>
        </article>

        {artistLive ? (
          <article className="metric-card">
            <p>Controles en vivo</p>
            <div className="row">
              <button onClick={() => setSheet('auction')}>Iniciar subasta</button>
              <button onClick={() => openCheckout(products[1])}>Fijar producto</button>
            </div>
            <button className="ghost" onClick={() => setArtistModerationOpen((v) => !v)}>
              {artistModerationOpen ? 'Ocultar moderacion' : 'Abrir moderacion'}
            </button>
            {artistModerationOpen ? (
              <div className="event-list">
                <p>@spamfan silenciado 10 minutos</p>
                <p>Chat solo para seguidores activado</p>
                <p>Cola de revision: 2 mensajes</p>
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    );
  }

  if (artistTab === 'orders') {
    return (
      <section className="stack">
        <h2>Pedidos</h2>
        <article className="metric-card">
          <p>#2481 Pua firmada Belako</p>
          <small>Pagado | Preparando envio</small>
        </article>
        <article className="metric-card">
          <p>#2480 Camiseta Gira Belako</p>
          <small>Pagado | Etiqueta creada</small>
        </article>
        <article className="metric-card">
          <p>#2479 Fanzine backstage</p>
          <small>Reembolso solicitado | Requiere revision</small>
        </article>
      </section>
    );
  }

  if (artistTab === 'fans') {
    return (
      <section className="stack">
        <h2>Segmentos de fans</h2>
        <article className="metric-card">
          <p>Fan casual</p>
          <h3>6420</h3>
        </article>
        <article className="metric-card">
          <p>Nivel 1 y Nivel 2</p>
          <h3>{attendanceCount * 22}</h3>
        </article>
        <article className="metric-card">
          <p>Superfan Belako</p>
          <h3>{tiers[2].unlocked ? 214 : 126}</h3>
        </article>
      </section>
    );
  }

  return (
    <section className="stack">
      <h2>Perfil de Belako</h2>
      <article className="metric-card">
        <p>Plan</p>
        <h3>€9.99/mes</h3>
      </article>
      <article className="metric-card">
        <p>Fee por transaccion</p>
        <h3>5%</h3>
      </article>
      <article className="metric-card">
        <p>Integraciones</p>
        <small>Stripe, WalletConnect, Twilio Video (mock)</small>
      </article>
    </section>
  );
}
