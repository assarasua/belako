import { useEffect, useMemo, useState } from 'react';
import {
  type ConcertItem,
  createConcert,
  createLive,
  createReward,
  createStoreItem,
  deleteConcert,
  deleteLive,
  deleteReward,
  deleteStoreItem,
  getConcerts,
  getLives,
  getRewardsConfig,
  getSession,
  getStoreItems,
  loginWithGoogle,
  logout,
  setTiers,
  setXpActions,
  updateReward,
  type LiveItem,
  type RewardConfigItem,
  type RewardsConfig,
  type StoreItem,
  type UserSession,
  type XpActionConfig
} from './api';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (input: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type Tab = 'store' | 'concerts' | 'lives' | 'rewards';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const emptyStoreDraft: Omit<StoreItem, 'id'> = {
  name: '',
  fiatPrice: 0,
  imageUrl: '',
  limited: false,
  isActive: true
};

const emptyConcertDraft: Omit<ConcertItem, 'id'> = {
  title: '',
  venue: '',
  city: '',
  startsAt: new Date().toISOString().slice(0, 16),
  priceEur: 0,
  ticketUrl: '',
  isActive: true
};

const emptyLiveDraft: Omit<LiveItem, 'id'> = {
  artist: 'Belako',
  title: '',
  startsAt: new Date().toISOString().slice(0, 16),
  viewers: 0,
  rewardHint: '',
  genre: 'Alternative',
  colorClass: 'stream-a',
  youtubeUrl: '',
  isActive: true
};

const emptyRewardDraft: Omit<RewardConfigItem, 'id'> = {
  title: '',
  description: '',
  triggerType: 'watch_full_live',
  xpBonus: 0,
  active: true
};

export function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<Tab>('store');
  const [status, setStatus] = useState('');

  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [concerts, setConcerts] = useState<ConcertItem[]>([]);
  const [lives, setLives] = useState<LiveItem[]>([]);
  const [rewardsConfig, setRewardsConfig] = useState<RewardsConfig | null>(null);

  const [storeDraft, setStoreDraft] = useState(emptyStoreDraft);
  const [concertDraft, setConcertDraft] = useState(emptyConcertDraft);
  const [liveDraft, setLiveDraft] = useState(emptyLiveDraft);
  const [rewardDraft, setRewardDraft] = useState(emptyRewardDraft);

  const artistDenied = session && session.role !== 'artist';

  async function refreshAll() {
    const [storeResult, concertResult, livesResult, rewardsResult] = await Promise.all([
      getStoreItems(),
      getConcerts(),
      getLives(),
      getRewardsConfig()
    ]);

    if (storeResult.ok && storeResult.data) {
      setStoreItems(storeResult.data);
    }
    if (concertResult.ok && concertResult.data) {
      setConcerts(concertResult.data);
    }
    if (livesResult.ok && livesResult.data) {
      setLives(livesResult.data);
    }
    if (rewardsResult.ok && rewardsResult.data) {
      setRewardsConfig(rewardsResult.data);
    }
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const sessionResult = await getSession();
      if (!active) {
        return;
      }
      if (sessionResult.ok && sessionResult.data) {
        setSession(sessionResult.data);
      }
      setAuthLoading(false);
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session || session.role !== 'artist') {
      return;
    }
    void refreshAll();
  }, [session]);

  function runGoogleLogin() {
    setAuthError('');
    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Falta VITE_GOOGLE_CLIENT_ID para iniciar sesión con Google.');
      return;
    }
    if (!window.google?.accounts?.id) {
      setAuthError('Google Identity script no disponible. Recarga la página.');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        const token = response.credential;
        if (!token) {
          setAuthError('No se recibió token de Google.');
          return;
        }
        const loginResult = await loginWithGoogle(token);
        if (!loginResult.ok || !loginResult.data) {
          setAuthError(loginResult.error || 'No se pudo iniciar sesión.');
          return;
        }
        setSession(loginResult.data);
      },
      ux_mode: 'popup'
    });
    window.google.accounts.id.prompt();
  }

  useEffect(() => {
    const scriptId = 'google-gsi-dashboard';
    if (document.getElementById(scriptId)) {
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.id = scriptId;
    document.head.appendChild(script);
  }, []);

  const sortedTiers = useMemo(
    () => [...(rewardsConfig?.tiers || [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [rewardsConfig?.tiers]
  );

  if (authLoading) {
    return <main className="dashboard-shell"><p>Cargando sesión...</p></main>;
  }

  if (!session) {
    return (
      <main className="dashboard-auth-shell">
        <section className="dashboard-auth-card">
          <p className="kicker">BELAKO DASHBOARD</p>
          <h1>Acceso banda</h1>
          <p>Gestiona tienda, conciertos, directos y recompensas dinámicas.</p>
          <button onClick={runGoogleLogin}>Entrar con Google</button>
          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  if (artistDenied) {
    return (
      <main className="dashboard-auth-shell">
        <section className="dashboard-auth-card">
          <h1>No autorizado</h1>
          <p>Tu cuenta ({session.email}) no está en la allowlist de banda.</p>
          <button
            className="ghost"
            onClick={() => {
              logout();
              setSession(null);
            }}
          >
            Cerrar sesión
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <div>
          <p className="kicker">BELAKO BAND CMS</p>
          <h1>dashboard.belako.bizkardolab.eu</h1>
          <small>{session.name || session.email}</small>
        </div>
        <div className="topbar-actions">
          <button className="ghost" onClick={() => void refreshAll()}>Actualizar</button>
          <button
            className="ghost"
            onClick={() => {
              logout();
              setSession(null);
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="dashboard-tabs">
        <button className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}>Tienda</button>
        <button className={tab === 'concerts' ? 'active' : ''} onClick={() => setTab('concerts')}>Conciertos</button>
        <button className={tab === 'lives' ? 'active' : ''} onClick={() => setTab('lives')}>Lives</button>
        <button className={tab === 'rewards' ? 'active' : ''} onClick={() => setTab('rewards')}>Recompensas</button>
      </nav>

      {status ? <p className="status">{status}</p> : null}

      {tab === 'store' ? (
        <section className="panel">
          <h2>Tienda</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Nuevo producto</h3>
              <input placeholder="Nombre" value={storeDraft.name} onChange={(e) => setStoreDraft((p) => ({ ...p, name: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Precio EUR" value={storeDraft.fiatPrice || ''} onChange={(e) => setStoreDraft((p) => ({ ...p, fiatPrice: Number(e.target.value) }))} />
              <input placeholder="Image URL" value={storeDraft.imageUrl} onChange={(e) => setStoreDraft((p) => ({ ...p, imageUrl: e.target.value }))} />
              <button onClick={async () => {
                const result = await createStoreItem(storeDraft);
                if (!result.ok) {
                  setStatus(result.error || 'No se pudo crear producto.');
                  return;
                }
                setStoreDraft(emptyStoreDraft);
                setStatus('Producto creado.');
                await refreshAll();
              }}>Añadir producto</button>
            </article>
            <article className="card">
              <h3>Productos activos ({storeItems.length})</h3>
              <div className="list">
                {storeItems.map((item) => (
                  <div className="row-item" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>€{item.fiatPrice.toFixed(2)}</small>
                    </div>
                    <button className="ghost" onClick={async () => {
                      const result = await deleteStoreItem(item.id);
                      if (!result.ok) {
                        setStatus(result.error || 'No se pudo eliminar producto.');
                        return;
                      }
                      setStatus('Producto eliminado.');
                      await refreshAll();
                    }}>Eliminar</button>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {tab === 'concerts' ? (
        <section className="panel">
          <h2>Conciertos</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Nuevo concierto</h3>
              <input placeholder="Título" value={concertDraft.title} onChange={(e) => setConcertDraft((p) => ({ ...p, title: e.target.value }))} />
              <input placeholder="Sala" value={concertDraft.venue} onChange={(e) => setConcertDraft((p) => ({ ...p, venue: e.target.value }))} />
              <input placeholder="Ciudad" value={concertDraft.city} onChange={(e) => setConcertDraft((p) => ({ ...p, city: e.target.value }))} />
              <input type="datetime-local" value={concertDraft.startsAt.slice(0, 16)} onChange={(e) => setConcertDraft((p) => ({ ...p, startsAt: new Date(e.target.value).toISOString() }))} />
              <input type="number" step="0.01" placeholder="Precio" value={concertDraft.priceEur || ''} onChange={(e) => setConcertDraft((p) => ({ ...p, priceEur: Number(e.target.value) }))} />
              <button onClick={async () => {
                const result = await createConcert(concertDraft);
                if (!result.ok) {
                  setStatus(result.error || 'No se pudo crear concierto.');
                  return;
                }
                setConcertDraft(emptyConcertDraft);
                setStatus('Concierto creado.');
                await refreshAll();
              }}>Añadir concierto</button>
            </article>
            <article className="card">
              <h3>Listado ({concerts.length})</h3>
              <div className="list">
                {concerts.map((item) => (
                  <div className="row-item" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{new Date(item.startsAt).toLocaleString('es-ES')}</small>
                    </div>
                    <button className="ghost" onClick={async () => {
                      const result = await deleteConcert(item.id);
                      if (!result.ok) {
                        setStatus(result.error || 'No se pudo eliminar concierto.');
                        return;
                      }
                      setStatus('Concierto eliminado.');
                      await refreshAll();
                    }}>Eliminar</button>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {tab === 'lives' ? (
        <section className="panel">
          <h2>Lives</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Nuevo live</h3>
              <input placeholder="Título" value={liveDraft.title} onChange={(e) => setLiveDraft((p) => ({ ...p, title: e.target.value }))} />
              <input placeholder="Género" value={liveDraft.genre} onChange={(e) => setLiveDraft((p) => ({ ...p, genre: e.target.value }))} />
              <input placeholder="Hint recompensa" value={liveDraft.rewardHint} onChange={(e) => setLiveDraft((p) => ({ ...p, rewardHint: e.target.value }))} />
              <input placeholder="Youtube URL" value={liveDraft.youtubeUrl || ''} onChange={(e) => setLiveDraft((p) => ({ ...p, youtubeUrl: e.target.value }))} />
              <input type="datetime-local" value={liveDraft.startsAt.slice(0, 16)} onChange={(e) => setLiveDraft((p) => ({ ...p, startsAt: new Date(e.target.value).toISOString() }))} />
              <button onClick={async () => {
                const result = await createLive(liveDraft);
                if (!result.ok) {
                  setStatus(result.error || 'No se pudo crear live.');
                  return;
                }
                setLiveDraft(emptyLiveDraft);
                setStatus('Live creado.');
                await refreshAll();
              }}>Añadir live</button>
            </article>
            <article className="card">
              <h3>Listado ({lives.length})</h3>
              <div className="list">
                {lives.map((item) => (
                  <div className="row-item" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{new Date(item.startsAt).toLocaleString('es-ES')}</small>
                    </div>
                    <button className="ghost" onClick={async () => {
                      const result = await deleteLive(item.id);
                      if (!result.ok) {
                        setStatus(result.error || 'No se pudo eliminar live.');
                        return;
                      }
                      setStatus('Live eliminado.');
                      await refreshAll();
                    }}>Eliminar</button>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {tab === 'rewards' ? (
        <section className="panel">
          <h2>Recompensas y XP</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Journey tiers</h3>
              {sortedTiers.map((tier, index) => (
                <div className="row-item" key={tier.id}>
                  <input value={tier.title} onChange={(e) => {
                    setRewardsConfig((prev) => prev ? {
                      ...prev,
                      tiers: prev.tiers.map((item) => item.id === tier.id ? { ...item, title: e.target.value } : item)
                    } : prev);
                  }} />
                  <input type="number" value={tier.requiredXp} onChange={(e) => {
                    setRewardsConfig((prev) => prev ? {
                      ...prev,
                      tiers: prev.tiers.map((item) => item.id === tier.id ? { ...item, requiredXp: Number(e.target.value), sortOrder: index + 1 } : item)
                    } : prev);
                  }} />
                </div>
              ))}
              <button onClick={async () => {
                if (!rewardsConfig) {
                  return;
                }
                const result = await setTiers(rewardsConfig.tiers);
                setStatus(result.ok ? 'Tiers guardados.' : (result.error || 'No se pudo guardar tiers.'));
                if (result.ok) {
                  await refreshAll();
                }
              }}>Guardar tiers</button>
            </article>

            <article className="card">
              <h3>Acciones XP</h3>
              {(rewardsConfig?.xpActions || []).map((action) => (
                <div className="row-item" key={action.code}>
                  <small>{action.label}</small>
                  <input type="number" value={action.xpValue} onChange={(e) => {
                    setRewardsConfig((prev) => prev ? {
                      ...prev,
                      xpActions: prev.xpActions.map((item) => item.code === action.code ? { ...item, xpValue: Number(e.target.value) } : item)
                    } : prev);
                  }} />
                </div>
              ))}
              <button onClick={async () => {
                const current = rewardsConfig?.xpActions;
                if (!current) {
                  return;
                }
                const result = await setXpActions(current as XpActionConfig[]);
                setStatus(result.ok ? 'XP actions guardadas.' : (result.error || 'No se pudo guardar XP actions.'));
                if (result.ok) {
                  await refreshAll();
                }
              }}>Guardar XP actions</button>
            </article>
          </div>

          <div className="grid-two">
            <article className="card">
              <h3>Nueva recompensa</h3>
              <input placeholder="Título" value={rewardDraft.title} onChange={(e) => setRewardDraft((p) => ({ ...p, title: e.target.value }))} />
              <textarea placeholder="Descripción" value={rewardDraft.description} onChange={(e) => setRewardDraft((p) => ({ ...p, description: e.target.value }))} />
              <select value={rewardDraft.triggerType} onChange={(e) => setRewardDraft((p) => ({ ...p, triggerType: e.target.value as RewardConfigItem['triggerType'] }))}>
                <option value="watch_full_live">Directo completo</option>
                <option value="xp_threshold">Umbral XP</option>
                <option value="purchase">Compra</option>
              </select>
              <input type="number" value={rewardDraft.xpBonus} onChange={(e) => setRewardDraft((p) => ({ ...p, xpBonus: Number(e.target.value) }))} />
              <button onClick={async () => {
                const result = await createReward(rewardDraft);
                if (!result.ok) {
                  setStatus(result.error || 'No se pudo crear recompensa.');
                  return;
                }
                setRewardDraft(emptyRewardDraft);
                setStatus('Recompensa creada.');
                await refreshAll();
              }}>Añadir recompensa</button>
            </article>

            <article className="card">
              <h3>Recompensas activas</h3>
              <div className="list">
                {(rewardsConfig?.rewards || []).map((reward) => (
                  <div className="row-item" key={reward.id}>
                    <div>
                      <strong>{reward.title}</strong>
                      <small>{reward.triggerType} · +{reward.xpBonus} XP</small>
                    </div>
                    <div className="topbar-actions">
                      <button className="ghost" onClick={async () => {
                        const nextTitle = window.prompt('Título de recompensa', reward.title);
                        if (nextTitle === null) {
                          return;
                        }
                        const nextDescription = window.prompt('Descripción', reward.description);
                        if (nextDescription === null) {
                          return;
                        }
                        const nextXpBonusRaw = window.prompt('Bonus XP', String(reward.xpBonus));
                        if (nextXpBonusRaw === null) {
                          return;
                        }
                        const nextXpBonus = Number(nextXpBonusRaw);
                        if (!Number.isFinite(nextXpBonus) || nextXpBonus < 0) {
                          setStatus('El bonus XP debe ser un número mayor o igual a 0.');
                          return;
                        }
                        const isActive = window.confirm('¿Dejar esta recompensa activa?');
                        const result = await updateReward(reward.id, {
                          title: nextTitle.trim() || reward.title,
                          description: nextDescription.trim() || reward.description,
                          xpBonus: Math.round(nextXpBonus),
                          active: isActive
                        });
                        if (!result.ok) {
                          setStatus(result.error || 'No se pudo actualizar recompensa.');
                          return;
                        }
                        setStatus('Recompensa actualizada.');
                        await refreshAll();
                      }}>Editar</button>
                      <button className="ghost" onClick={async () => {
                        const result = await deleteReward(reward.id);
                        if (!result.ok) {
                          setStatus(result.error || 'No se pudo eliminar recompensa.');
                          return;
                        }
                        setStatus('Recompensa eliminada.');
                        await refreshAll();
                      }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
