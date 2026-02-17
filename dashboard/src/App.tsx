import { useEffect, useMemo, useRef, useState } from 'react';
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
  getLiveSubscriptions,
  getRegisteredUsers,
  getRewardsConfig,
  getSalesOverview,
  getSession,
  getStoreItems,
  loginWithGoogle,
  logout,
  setTiers,
  setXpActions,
  updateConcert,
  updateLive,
  updateReward,
  updateStoreItem,
  type LiveItem,
  type LiveSubscriptionItem,
  type DashboardSalesOverview,
  type RegisteredUserItem,
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

type Tab = 'store' | 'concerts' | 'lives' | 'rewards' | 'sales' | 'audience';
type SalesScope = 'all' | 'store' | 'concert_sales' | 'concert_registrations';

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
  startsAt: new Date().toISOString(),
  priceEur: 0,
  ticketUrl: '',
  isActive: true
};

const emptyLiveDraft: Omit<LiveItem, 'id'> = {
  artist: 'Belako',
  title: '',
  startsAt: new Date().toISOString(),
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

const TITLE_MAX_CHARS = 56;
const SALES_PAGE_SIZE = 10;

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
  const [salesOverview, setSalesOverview] = useState<DashboardSalesOverview | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserItem[]>([]);
  const [liveSubscriptions, setLiveSubscriptions] = useState<LiveSubscriptionItem[]>([]);
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState('all');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState('all');
  const [salesScopeFilter, setSalesScopeFilter] = useState<SalesScope>('all');
  const [allSalesPage, setAllSalesPage] = useState(1);

  const [storeDraft, setStoreDraft] = useState(emptyStoreDraft);
  const [storeImageError, setStoreImageError] = useState('');
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [storeEditDraft, setStoreEditDraft] = useState<Omit<StoreItem, 'id'>>(emptyStoreDraft);
  const [storeEditImageError, setStoreEditImageError] = useState('');
  const storeEditRef = useRef<HTMLElement | null>(null);
  const [concertDraft, setConcertDraft] = useState(emptyConcertDraft);
  const [editingConcertId, setEditingConcertId] = useState<string | null>(null);
  const [concertEditDraft, setConcertEditDraft] = useState<Omit<ConcertItem, 'id'>>(emptyConcertDraft);
  const concertEditRef = useRef<HTMLElement | null>(null);
  const [liveDraft, setLiveDraft] = useState(emptyLiveDraft);
  const [editingLiveId, setEditingLiveId] = useState<string | null>(null);
  const [liveEditDraft, setLiveEditDraft] = useState<Omit<LiveItem, 'id'>>(emptyLiveDraft);
  const liveEditRef = useRef<HTMLElement | null>(null);
  const [rewardDraft, setRewardDraft] = useState(emptyRewardDraft);

  const artistDenied = session && session.role !== 'artist';

  function handleStoreImageUpload(
    file: File | undefined,
    onSuccess: (imageUrl: string) => void,
    onError: (message: string) => void
  ) {
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      onError('Selecciona una imagen válida (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError('La imagen supera 5MB. Usa una versión más ligera.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        onError('No se pudo leer la imagen.');
        return;
      }
      onError('');
      onSuccess(result);
    };
    reader.onerror = () => {
      onError('Error al procesar la imagen.');
    };
    reader.readAsDataURL(file);
  }

  async function refreshAll() {
    const [storeResult, concertResult, livesResult, rewardsResult, salesResult, usersResult, subscriptionsResult] = await Promise.all([
      getStoreItems(),
      getConcerts(),
      getLives(),
      getRewardsConfig(),
      getSalesOverview(),
      getRegisteredUsers(),
      getLiveSubscriptions()
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
    if (salesResult.ok && salesResult.data) {
      setSalesOverview(salesResult.data);
    }
    if (usersResult.ok && usersResult.data) {
      setRegisteredUsers(usersResult.data);
    }
    if (subscriptionsResult.ok && subscriptionsResult.data) {
      setLiveSubscriptions(subscriptionsResult.data);
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

  useEffect(() => {
    if (tab === 'store' && editingStoreId) {
      storeEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tab, editingStoreId]);

  useEffect(() => {
    if (tab === 'concerts' && editingConcertId) {
      concertEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tab, editingConcertId]);

  useEffect(() => {
    if (tab === 'lives' && editingLiveId) {
      liveEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tab, editingLiveId]);

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
  const allSales = useMemo(() => salesOverview?.sales || [], [salesOverview?.sales]);
  const salesStatusOptions = useMemo(
    () => ['all', ...Array.from(new Set(allSales.map((sale) => sale.status)))],
    [allSales]
  );
  const registrationStatusOptions = useMemo(
    () => ['all', ...Array.from(new Set((salesOverview?.concertRegistrations || []).map((item) => item.status)))],
    [salesOverview?.concertRegistrations]
  );
  const filteredSales = useMemo(
    () =>
      allSales.filter((sale) => {
        const createdAt = new Date(sale.createdAt);
        if (salesDateFrom) {
          const start = new Date(`${salesDateFrom}T00:00:00`);
          if (createdAt < start) {
            return false;
          }
        }
        if (salesDateTo) {
          const end = new Date(`${salesDateTo}T23:59:59`);
          if (createdAt > end) {
            return false;
          }
        }
        if (salesStatusFilter !== 'all' && sale.status !== salesStatusFilter) {
          return false;
        }
        return true;
      }),
    [allSales, salesDateFrom, salesDateTo, salesStatusFilter]
  );
  const storeSales = useMemo(() => filteredSales.filter((sale) => sale.itemType === 'merch'), [filteredSales]);
  const concertSales = useMemo(() => filteredSales.filter((sale) => sale.itemType === 'ticket'), [filteredSales]);
  const filteredRegistrations = useMemo(
    () =>
      (salesOverview?.concertRegistrations || []).filter((registration) => {
        const createdAt = new Date(registration.createdAt);
        if (salesDateFrom) {
          const start = new Date(`${salesDateFrom}T00:00:00`);
          if (createdAt < start) {
            return false;
          }
        }
        if (salesDateTo) {
          const end = new Date(`${salesDateTo}T23:59:59`);
          if (createdAt > end) {
            return false;
          }
        }
        if (registrationStatusFilter !== 'all' && registration.status !== registrationStatusFilter) {
          return false;
        }
        return true;
      }),
    [registrationStatusFilter, salesDateFrom, salesDateTo, salesOverview?.concertRegistrations]
  );
  const filteredRevenue = useMemo(
    () =>
      filteredSales
        .filter((sale) => sale.status === 'PAID')
        .reduce((sum, sale) => sum + sale.amountEur, 0),
    [filteredSales]
  );
  const salesScopeOptions: Array<{ value: SalesScope; label: string }> = [
    { value: 'all', label: 'Todo' },
    { value: 'store', label: 'Tienda' },
    { value: 'concert_sales', label: 'Conciertos (ventas)' },
    { value: 'concert_registrations', label: 'Registro de concierto' }
  ];
  const scopedAllSales = useMemo(() => {
    if (salesScopeFilter === 'store') {
      return storeSales;
    }
    if (salesScopeFilter === 'concert_sales') {
      return concertSales;
    }
    if (salesScopeFilter === 'concert_registrations') {
      return [];
    }
    return filteredSales;
  }, [concertSales, filteredSales, salesScopeFilter, storeSales]);

  useEffect(() => {
    setAllSalesPage(1);
  }, [salesDateFrom, salesDateTo, salesStatusFilter, registrationStatusFilter, salesScopeFilter]);

  const paginatedAllSales = useMemo(
    () => paginateList(scopedAllSales, allSalesPage, SALES_PAGE_SIZE),
    [scopedAllSales, allSalesPage]
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
        <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>Ventas</button>
        <button className={tab === 'audience' ? 'active' : ''} onClick={() => setTab('audience')}>Usuarios</button>
      </nav>

      {status ? <p className="status">{status}</p> : null}

      {tab === 'store' ? (
        <section className="panel">
          <h2>Tienda</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Nuevo producto</h3>
              <input maxLength={90} placeholder="Nombre" value={storeDraft.name} onChange={(e) => setStoreDraft((p) => ({ ...p, name: e.target.value }))} />
              <input type="number" step="0.01" placeholder="Precio EUR" value={storeDraft.fiatPrice || ''} onChange={(e) => setStoreDraft((p) => ({ ...p, fiatPrice: Number(e.target.value) }))} />
              <input placeholder="Image URL" value={storeDraft.imageUrl} onChange={(e) => setStoreDraft((p) => ({ ...p, imageUrl: e.target.value }))} />
              <label className="ghost">
                Subir imagen (móvil/desktop)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleStoreImageUpload(
                      e.target.files?.[0],
                      (imageUrl) => setStoreDraft((p) => ({ ...p, imageUrl })),
                      setStoreImageError
                    )
                  }
                />
              </label>
              {storeDraft.imageUrl ? <img src={storeDraft.imageUrl} alt="Preview producto" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8 }} /> : null}
              {storeImageError ? <p className="error">{storeImageError}</p> : null}
              <button onClick={async () => {
                if (!storeDraft.imageUrl) {
                  setStoreImageError('Añade una imagen por URL o subida.');
                  return;
                }
                const result = await createStoreItem(storeDraft);
                if (!result.ok) {
                  setStatus(result.error || 'No se pudo crear producto.');
                  return;
                }
                setStoreDraft(emptyStoreDraft);
                setStoreImageError('');
                setStatus('Producto creado.');
                await refreshAll();
              }}>Añadir producto</button>
            </article>
            <article className="card">
              <h3>Productos activos ({storeItems.length})</h3>
              <div className="list">
                {storeItems.map((item) => (
                  <div className="row-item" key={item.id}>
                    <div className="row-item-main">
                      <strong className="row-item-title" title={item.name}>{truncateText(item.name, TITLE_MAX_CHARS)}</strong>
                      <small>€{item.fiatPrice.toFixed(2)}</small>
                    </div>
                    <div className="topbar-actions">
                      <button
                        className="ghost btn-xs"
                        onClick={() => {
                          setEditingStoreId(item.id);
                          setStoreEditDraft({
                            name: item.name,
                            fiatPrice: item.fiatPrice,
                            imageUrl: item.imageUrl,
                            limited: item.limited,
                            isActive: item.isActive
                          });
                          setStoreEditImageError('');
                        }}
                      >
                        Editar
                      </button>
                      <button className="ghost btn-xs" onClick={async () => {
                        const result = await deleteStoreItem(item.id);
                        if (!result.ok) {
                          setStatus(result.error || 'No se pudo eliminar producto.');
                          return;
                        }
                        if (editingStoreId === item.id) {
                          setEditingStoreId(null);
                        }
                        setStatus('Producto eliminado.');
                        await refreshAll();
                      }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
          {editingStoreId ? (
            <article className="card" ref={storeEditRef}>
              <h3>Editar producto</h3>
              <input
                maxLength={90}
                placeholder="Nombre"
                value={storeEditDraft.name}
                onChange={(e) => setStoreEditDraft((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Precio EUR"
                value={storeEditDraft.fiatPrice || ''}
                onChange={(e) => setStoreEditDraft((p) => ({ ...p, fiatPrice: Number(e.target.value) }))}
              />
              <input
                placeholder="Image URL"
                value={storeEditDraft.imageUrl}
                onChange={(e) => setStoreEditDraft((p) => ({ ...p, imageUrl: e.target.value }))}
              />
              <label className="ghost">
                Subir imagen (móvil/desktop)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleStoreImageUpload(
                      e.target.files?.[0],
                      (imageUrl) => setStoreEditDraft((p) => ({ ...p, imageUrl })),
                      setStoreEditImageError
                    )
                  }
                />
              </label>
              {storeEditDraft.imageUrl ? <img src={storeEditDraft.imageUrl} alt="Preview edición producto" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8 }} /> : null}
              {storeEditImageError ? <p className="error">{storeEditImageError}</p> : null}
              <label>
                <input
                  type="checkbox"
                  checked={storeEditDraft.limited}
                  onChange={(e) => setStoreEditDraft((p) => ({ ...p, limited: e.target.checked }))}
                /> Producto limitado
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={storeEditDraft.isActive}
                  onChange={(e) => setStoreEditDraft((p) => ({ ...p, isActive: e.target.checked }))}
                /> Activo
              </label>
              <div className="topbar-actions">
                <button
                  onClick={async () => {
                    const result = await updateStoreItem(editingStoreId, {
                      name: storeEditDraft.name,
                      fiatPrice: storeEditDraft.fiatPrice,
                      imageUrl: storeEditDraft.imageUrl,
                      limited: storeEditDraft.limited,
                      isActive: storeEditDraft.isActive
                    });
                    if (!result.ok) {
                      setStatus(result.error || 'No se pudo actualizar producto.');
                      return;
                    }
                    setEditingStoreId(null);
                    setStoreEditImageError('');
                    setStatus('Producto actualizado.');
                    await refreshAll();
                  }}
                >
                  Guardar cambios
                </button>
                <button
                  className="ghost"
                  onClick={() => {
                    setEditingStoreId(null);
                    setStoreEditImageError('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {tab === 'concerts' ? (
        <section className="panel">
          <h2>Conciertos</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Nuevo concierto</h3>
              <input maxLength={100} placeholder="Título" value={concertDraft.title} onChange={(e) => setConcertDraft((p) => ({ ...p, title: e.target.value }))} />
              <input placeholder="Sala" value={concertDraft.venue} onChange={(e) => setConcertDraft((p) => ({ ...p, venue: e.target.value }))} />
              <input placeholder="Ciudad" value={concertDraft.city} onChange={(e) => setConcertDraft((p) => ({ ...p, city: e.target.value }))} />
              <input type="datetime-local" value={concertDraft.startsAt.slice(0, 16)} onChange={(e) => setConcertDraft((p) => ({ ...p, startsAt: new Date(e.target.value).toISOString() }))} />
              <input type="number" step="0.01" placeholder="Precio" value={concertDraft.priceEur || ''} onChange={(e) => setConcertDraft((p) => ({ ...p, priceEur: Number(e.target.value) }))} />
              <input placeholder="Ticket URL" value={concertDraft.ticketUrl || ''} onChange={(e) => setConcertDraft((p) => ({ ...p, ticketUrl: e.target.value }))} />
              <label>
                <input
                  type="checkbox"
                  checked={concertDraft.isActive}
                  onChange={(e) => setConcertDraft((p) => ({ ...p, isActive: e.target.checked }))}
                /> Activo
              </label>
              <button onClick={async () => {
                const result = await createConcert({
                  ...concertDraft,
                  startsAt: normalizeDateForApi(concertDraft.startsAt)
                });
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
                    <div className="row-item-main">
                      <strong className="row-item-title" title={item.title}>{truncateText(item.title, TITLE_MAX_CHARS)}</strong>
                      <small>{new Date(item.startsAt).toLocaleString('es-ES')}</small>
                    </div>
                    <div className="topbar-actions">
                      <button
                        className="ghost btn-xs"
                        onClick={() => {
                          setEditingConcertId(item.id);
                          setConcertEditDraft({
                            title: item.title,
                            venue: item.venue,
                            city: item.city,
                            startsAt: item.startsAt,
                            priceEur: item.priceEur,
                            ticketUrl: item.ticketUrl || '',
                            isActive: item.isActive
                          });
                        }}
                      >
                        Editar
                      </button>
                      <button className="ghost btn-xs" onClick={async () => {
                        const result = await deleteConcert(item.id);
                        if (!result.ok) {
                          setStatus(result.error || 'No se pudo eliminar concierto.');
                          return;
                        }
                        if (editingConcertId === item.id) {
                          setEditingConcertId(null);
                        }
                        setStatus('Concierto eliminado.');
                        await refreshAll();
                      }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
          {editingConcertId ? (
            <article className="card" ref={concertEditRef}>
              <h3>Editar concierto</h3>
              <input
                maxLength={100}
                placeholder="Título"
                value={concertEditDraft.title}
                onChange={(e) => setConcertEditDraft((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                placeholder="Sala"
                value={concertEditDraft.venue}
                onChange={(e) => setConcertEditDraft((p) => ({ ...p, venue: e.target.value }))}
              />
              <input
                placeholder="Ciudad"
                value={concertEditDraft.city}
                onChange={(e) => setConcertEditDraft((p) => ({ ...p, city: e.target.value }))}
              />
              <input
                type="datetime-local"
                value={toDateTimeLocalInput(concertEditDraft.startsAt)}
                onChange={(e) => setConcertEditDraft((p) => ({ ...p, startsAt: normalizeDateForApi(e.target.value) }))}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Precio"
                value={concertEditDraft.priceEur || ''}
                onChange={(e) => setConcertEditDraft((p) => ({ ...p, priceEur: Number(e.target.value) }))}
              />
              <input
                placeholder="Ticket URL"
                value={concertEditDraft.ticketUrl || ''}
                onChange={(e) => setConcertEditDraft((p) => ({ ...p, ticketUrl: e.target.value }))}
              />
              <label>
                <input
                  type="checkbox"
                  checked={concertEditDraft.isActive}
                  onChange={(e) => setConcertEditDraft((p) => ({ ...p, isActive: e.target.checked }))}
                /> Activo
              </label>
              <div className="topbar-actions">
                <button
                  onClick={async () => {
                    const result = await updateConcert(editingConcertId, {
                      title: concertEditDraft.title,
                      venue: concertEditDraft.venue,
                      city: concertEditDraft.city,
                      startsAt: normalizeDateForApi(concertEditDraft.startsAt),
                      priceEur: concertEditDraft.priceEur,
                      ticketUrl: concertEditDraft.ticketUrl || '',
                      isActive: concertEditDraft.isActive
                    });
                    if (!result.ok) {
                      setStatus(result.error || 'No se pudo actualizar concierto.');
                      return;
                    }
                    setEditingConcertId(null);
                    setStatus('Concierto actualizado.');
                    await refreshAll();
                  }}
                >
                  Guardar cambios
                </button>
                <button className="ghost" onClick={() => setEditingConcertId(null)}>Cancelar</button>
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {tab === 'lives' ? (
        <section className="panel">
          <h2>Lives</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Nuevo live</h3>
              <input placeholder="Artista" value={liveDraft.artist} onChange={(e) => setLiveDraft((p) => ({ ...p, artist: e.target.value }))} />
              <input maxLength={100} placeholder="Título" value={liveDraft.title} onChange={(e) => setLiveDraft((p) => ({ ...p, title: e.target.value }))} />
              <input placeholder="Género" value={liveDraft.genre} onChange={(e) => setLiveDraft((p) => ({ ...p, genre: e.target.value }))} />
              <input placeholder="Color class (stream-a...)" value={liveDraft.colorClass} onChange={(e) => setLiveDraft((p) => ({ ...p, colorClass: e.target.value }))} />
              <input type="number" placeholder="Viewers" value={liveDraft.viewers || 0} onChange={(e) => setLiveDraft((p) => ({ ...p, viewers: Number(e.target.value) }))} />
              <input placeholder="Hint recompensa" value={liveDraft.rewardHint} onChange={(e) => setLiveDraft((p) => ({ ...p, rewardHint: e.target.value }))} />
              <input placeholder="Youtube URL" value={liveDraft.youtubeUrl || ''} onChange={(e) => setLiveDraft((p) => ({ ...p, youtubeUrl: e.target.value }))} />
              <input type="datetime-local" value={liveDraft.startsAt.slice(0, 16)} onChange={(e) => setLiveDraft((p) => ({ ...p, startsAt: new Date(e.target.value).toISOString() }))} />
              <label>
                <input
                  type="checkbox"
                  checked={liveDraft.isActive}
                  onChange={(e) => setLiveDraft((p) => ({ ...p, isActive: e.target.checked }))}
                /> Activo
              </label>
              <button onClick={async () => {
                const result = await createLive({
                  ...liveDraft,
                  startsAt: normalizeDateForApi(liveDraft.startsAt)
                });
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
                    <div className="row-item-main">
                      <strong className="row-item-title" title={item.title}>{truncateText(item.title, TITLE_MAX_CHARS)}</strong>
                      <small>{new Date(item.startsAt).toLocaleString('es-ES')}</small>
                    </div>
                    <div className="topbar-actions">
                      <button
                        className="ghost btn-xs"
                        onClick={() => {
                          setEditingLiveId(item.id);
                          setLiveEditDraft({
                            artist: item.artist,
                            title: item.title,
                            startsAt: item.startsAt,
                            viewers: item.viewers,
                            rewardHint: item.rewardHint,
                            genre: item.genre,
                            colorClass: item.colorClass,
                            youtubeUrl: item.youtubeUrl || '',
                            isActive: item.isActive
                          });
                        }}
                      >
                        Editar
                      </button>
                      <button className="ghost btn-xs" onClick={async () => {
                        const result = await deleteLive(item.id);
                        if (!result.ok) {
                          setStatus(result.error || 'No se pudo eliminar live.');
                          return;
                        }
                        if (editingLiveId === item.id) {
                          setEditingLiveId(null);
                        }
                        setStatus('Live eliminado.');
                        await refreshAll();
                      }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
          {editingLiveId ? (
            <article className="card" ref={liveEditRef}>
              <h3>Editar live</h3>
              <input
                maxLength={100}
                placeholder="Artista"
                value={liveEditDraft.artist}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, artist: e.target.value }))}
              />
              <input
                placeholder="Título"
                value={liveEditDraft.title}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, title: e.target.value }))}
              />
              <input
                placeholder="Género"
                value={liveEditDraft.genre}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, genre: e.target.value }))}
              />
              <input
                placeholder="Color class (stream-a...)"
                value={liveEditDraft.colorClass}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, colorClass: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Viewers"
                value={liveEditDraft.viewers || 0}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, viewers: Number(e.target.value) }))}
              />
              <input
                placeholder="Hint recompensa"
                value={liveEditDraft.rewardHint}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, rewardHint: e.target.value }))}
              />
              <input
                placeholder="Youtube URL"
                value={liveEditDraft.youtubeUrl || ''}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, youtubeUrl: e.target.value }))}
              />
              <input
                type="datetime-local"
                value={toDateTimeLocalInput(liveEditDraft.startsAt)}
                onChange={(e) => setLiveEditDraft((p) => ({ ...p, startsAt: normalizeDateForApi(e.target.value) }))}
              />
              <label>
                <input
                  type="checkbox"
                  checked={liveEditDraft.isActive}
                  onChange={(e) => setLiveEditDraft((p) => ({ ...p, isActive: e.target.checked }))}
                /> Activo
              </label>
              <div className="topbar-actions">
                <button
                  onClick={async () => {
                    const result = await updateLive(editingLiveId, {
                      artist: liveEditDraft.artist,
                      title: liveEditDraft.title,
                      startsAt: normalizeDateForApi(liveEditDraft.startsAt),
                      viewers: liveEditDraft.viewers,
                      rewardHint: liveEditDraft.rewardHint,
                      genre: liveEditDraft.genre,
                      colorClass: liveEditDraft.colorClass,
                      youtubeUrl: liveEditDraft.youtubeUrl || '',
                      isActive: liveEditDraft.isActive
                    });
                    if (!result.ok) {
                      setStatus(result.error || 'No se pudo actualizar live.');
                      return;
                    }
                    setEditingLiveId(null);
                    setStatus('Live actualizado.');
                    await refreshAll();
                  }}
                >
                  Guardar cambios
                </button>
                <button className="ghost" onClick={() => setEditingLiveId(null)}>Cancelar</button>
              </div>
            </article>
          ) : null}
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

      {tab === 'sales' ? (
        <section className="panel">
          <h2>Ventas y registros de conciertos</h2>
          <article className="card">
            <h3>Filtros</h3>
            <div className="sales-filter-row">
              <label>
                Desde
                <input type="date" value={salesDateFrom} onChange={(e) => setSalesDateFrom(e.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" value={salesDateTo} onChange={(e) => setSalesDateTo(e.target.value)} />
              </label>
              <label>
                Estado venta
                <select value={salesStatusFilter} onChange={(e) => setSalesStatusFilter(e.target.value)}>
                  {salesStatusOptions.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>{statusOption === 'all' ? 'Todos' : statusOption}</option>
                  ))}
                </select>
              </label>
              <label>
                Estado registro concierto
                <select value={registrationStatusFilter} onChange={(e) => setRegistrationStatusFilter(e.target.value)}>
                  {registrationStatusOptions.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>{statusOption === 'all' ? 'Todos' : statusOption}</option>
                  ))}
                </select>
              </label>
              <label>
                Tipo de registro
                <select value={salesScopeFilter} onChange={(e) => setSalesScopeFilter(e.target.value as SalesScope)}>
                  {salesScopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                className="ghost btn-xs"
                onClick={() => {
                  setSalesDateFrom('');
                  setSalesDateTo('');
                  setSalesStatusFilter('all');
                  setRegistrationStatusFilter('all');
                  setSalesScopeFilter('all');
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </article>
          <div className="grid-two">
            <article className="card">
              <h3>Resumen filtrado</h3>
              <div className="list">
                <div className="row-item"><small>Ventas totales</small><strong>{filteredSales.length}</strong></div>
                <div className="row-item"><small>Ventas pagadas</small><strong>{filteredSales.filter((sale) => sale.status === 'PAID').length}</strong></div>
                <div className="row-item"><small>Ventas pendientes</small><strong>{filteredSales.filter((sale) => sale.status === 'PENDING').length}</strong></div>
                <div className="row-item"><small>Merch vendido</small><strong>{storeSales.length}</strong></div>
                <div className="row-item"><small>Entradas vendidas</small><strong>{concertSales.length}</strong></div>
                <div className="row-item"><small>Facturación</small><strong>€{filteredRevenue.toFixed(2)}</strong></div>
                <div className="row-item"><small>Registros a conciertos</small><strong>{filteredRegistrations.length}</strong></div>
              </div>
            </article>
            <article className="card">
              <small>El detalle por bloques (tienda/conciertos/registros) está oculto para simplificar esta vista.</small>
            </article>
          </div>

          <article className="card">
            <div className="section-head">
              <h3>Todas las transacciones ({scopedAllSales.length})</h3>
              <button
                className="ghost btn-xs"
                onClick={() =>
                  exportCsvFile(
                    'transacciones-filtradas.csv',
                    ['id', 'product', 'item_type', 'customer', 'amount_eur', 'status', 'payment_ref', 'created_at'],
                    scopedAllSales.map((sale) => [
                      sale.id,
                      sale.productName,
                      sale.itemType,
                      sale.customerName || sale.customerEmail,
                      sale.amountEur,
                      sale.status,
                      sale.paymentIntentId || sale.stripeSessionId,
                      sale.createdAt
                    ])
                  )
                }
              >
                Exportar CSV
              </button>
            </div>
            <div className="list">
              {paginatedAllSales.items.map((sale) => (
                <div className="row-item" key={sale.id}>
                  <div className="row-item-main">
                    <strong className="row-item-title" title={sale.productName}>{truncateText(sale.productName, TITLE_MAX_CHARS)}</strong>
                    <small>{sale.customerName || sale.customerEmail}</small>
                    <small>{new Date(sale.createdAt).toLocaleString('es-ES')}</small>
                  </div>
                  <div className="row-item-main">
                    <strong>€{sale.amountEur.toFixed(2)}</strong>
                    <small>{sale.itemType}</small>
                    <small>{sale.status}</small>
                  </div>
                </div>
              ))}
              {scopedAllSales.length === 0 ? <small>No hay transacciones para este tipo de filtro.</small> : null}
            </div>
            <div className="pagination-row">
              <button className="ghost btn-xs" disabled={paginatedAllSales.page <= 1} onClick={() => setAllSalesPage((p) => Math.max(1, p - 1))}>Anterior</button>
              <small>Página {paginatedAllSales.page} / {paginatedAllSales.totalPages}</small>
              <button className="ghost btn-xs" disabled={paginatedAllSales.page >= paginatedAllSales.totalPages} onClick={() => setAllSalesPage((p) => p + 1)}>Siguiente</button>
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'audience' ? (
        <section className="panel">
          <h2>Usuarios y suscripciones a lives</h2>
          <div className="grid-two">
            <article className="card">
              <h3>Registro de usuarios ({registeredUsers.length})</h3>
              <div className="list">
                {registeredUsers.map((user) => (
                  <div className="row-item" key={user.email}>
                    <div className="row-item-main">
                      <strong className="row-item-title" title={user.email}>{truncateText(user.email, TITLE_MAX_CHARS)}</strong>
                      <small>{user.authProvider} · onboarded: {user.onboardingCompleted ? 'sí' : 'no'}</small>
                      <small>Alta: {new Date(user.createdAt).toLocaleString('es-ES')}</small>
                    </div>
                    <div className="row-item-main">
                      <small>{user.role}</small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="card">
              <h3>Suscritos a lives ({liveSubscriptions.length})</h3>
              <div className="list">
                {liveSubscriptions.map((subscription) => (
                  <div className="row-item" key={subscription.id}>
                    <div className="row-item-main">
                      <strong className="row-item-title" title={subscription.liveTitle}>{truncateText(subscription.liveTitle, TITLE_MAX_CHARS)}</strong>
                      <small>{subscription.userName || subscription.userEmail}</small>
                      <small>{new Date(subscription.liveStartsAt).toLocaleString('es-ES')}</small>
                    </div>
                    <div className="row-item-main">
                      <small>{subscription.source}</small>
                      <small>Alta: {new Date(subscription.createdAt).toLocaleString('es-ES')}</small>
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
function normalizeDateForApi(input: string): string {
  if (!input) {
    return new Date().toISOString();
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function toDateTimeLocalInput(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  const timezoneOffset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function paginateList<T>(items: T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const startIndex = (page - 1) * pageSize;
  return {
    page,
    totalPages,
    items: items.slice(startIndex, startIndex + pageSize)
  };
}

function exportCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const serialize = (value: string | number | null) => {
    if (value === null) {
      return '';
    }
    const text = String(value).replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  };
  const csv = [headers.map(serialize).join(','), ...rows.map((row) => row.map(serialize).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars - 1)}...`;
}
