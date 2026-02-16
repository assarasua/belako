import { useEffect, useMemo, useRef, useState } from 'react';
import { concertTickets, products, streams, nowLabel } from '../lib/mock-data';
import type {
  Address,
  BillingProfile,
  EventItem,
  FanTab,
  LiveState,
  NotificationItem,
  NotificationPreferenceKey,
  PurchaseRecord,
  ProfileSettings,
  Product,
  RewardHistoryItem,
  SheetState,
  Tier
} from '../lib/types';
import {
  bootstrapCustomer,
  clearStoredAuth,
  completeOnboarding,
  createSetupIntent,
  createStripeCheckoutSession,
  fetchAuthSession,
  fetchPaymentMethods,
  fetchStripeInvoice,
  fetchStripeConfig,
  loginWithGoogle,
  removePaymentMethod,
  setDefaultPaymentMethod
} from '../services/api-client';

export type FidelityModel = ReturnType<typeof useFidelityState>;

type CheckoutForm = {
  fullName: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  acceptedPolicy: boolean;
};

type AddressType = 'shipping' | 'billing';
type AddressInput = Omit<Address, 'id' | 'isDefaultShipping' | 'isDefaultBilling'>;

const AUTH_TOKEN_KEY = 'belako_fan_token';
const AUTH_EMAIL_KEY = 'belako_fan_email';
const PROFILE_STORAGE_KEY = 'belako_profile_settings_v1';
const LEGACY_ADDRESS_STORAGE_KEY = 'belako_addresses_v1';
const REWARD_HISTORY_STORAGE_KEY = 'belako_reward_history_v1';
const PURCHASES_STORAGE_KEY = 'belako_purchases_v1';

const defaultCheckoutForm: CheckoutForm = {
  fullName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'España',
  acceptedPolicy: false
};

const xpPolicy = {
  liveJoin: 20,
  fullLive: 50,
  purchase: 80,
  inPersonTicket: 120
};
const JOURNEY_THRESHOLDS = {
  fan: 0,
  super: 180,
  ultra: 420,
  god: 760
} as const;

const defaultProfileSettings: ProfileSettings = {
  displayName: '',
  username: '',
  bio: '',
  avatarUrl: 'https://www.gravatar.com/avatar/?d=mp&s=200',
  location: '',
  website: '',
  email: '',
  language: 'es',
  theme: 'dark',
  isPrivateProfile: false,
  allowDm: true,
  notifications: {
    email: true,
    push: true,
    marketing: false,
    liveAlerts: true
  }
};

const defaultAddresses: Address[] = [];

const defaultRewardHistory: RewardHistoryItem[] = [
  {
    id: 'h-initial-welcome',
    label: 'Cuenta fan creada. Empieza tu journey Belako.',
    at: nowLabel(),
    type: 'reward'
  }
];

const defaultPurchases: PurchaseRecord[] = [];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function userAddressStorageKey(email: string): string {
  return `belako_addresses_v2_${normalizeEmail(email)}`;
}

function safeReadProfileSettings(): ProfileSettings {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return defaultProfileSettings;
    }
    const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
    return {
      ...defaultProfileSettings,
      ...parsed,
      notifications: {
        ...defaultProfileSettings.notifications,
        ...(parsed.notifications || {})
      }
    };
  } catch {
    return defaultProfileSettings;
  }
}

function safeReadAddresses(email: string): Address[] {
  const key = userAddressStorageKey(email);
  try {
    const rawUser = localStorage.getItem(key);
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as Address[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    const rawLegacy = localStorage.getItem(LEGACY_ADDRESS_STORAGE_KEY);
    if (!rawLegacy) {
      return [];
    }
    const parsedLegacy = JSON.parse(rawLegacy) as Address[];
    if (!Array.isArray(parsedLegacy)) {
      return [];
    }
    localStorage.setItem(key, JSON.stringify(parsedLegacy));
    return parsedLegacy;
  } catch {
    return [];
  }
}

function safeReadRewardHistory(): RewardHistoryItem[] {
  try {
    const raw = localStorage.getItem(REWARD_HISTORY_STORAGE_KEY);
    if (!raw) {
      return defaultRewardHistory;
    }
    const parsed = JSON.parse(raw) as RewardHistoryItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultRewardHistory;
    }
    return parsed;
  } catch {
    return defaultRewardHistory;
  }
}

function safeReadPurchases(): PurchaseRecord[] {
  try {
    const raw = localStorage.getItem(PURCHASES_STORAGE_KEY);
    if (!raw) {
      return defaultPurchases;
    }
    const parsed = JSON.parse(raw) as PurchaseRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultPurchases;
    }
    return parsed;
  } catch {
    return defaultPurchases;
  }
}

export function useFidelityState() {
  const [fanTab, setFanTabState] = useState<FanTab>('home');

  const [authStatus, setAuthStatus] = useState<'logged_out' | 'logging_in' | 'logged_in'>('logged_out');
  const [authUserEmail, setAuthUserEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authProvider, setAuthProvider] = useState<'google' | 'email' | null>(null);

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDoneInSession, setOnboardingDoneInSession] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const [streamIndex, setStreamIndex] = useState(0);
  const [liveState, setLiveState] = useState<LiveState>('live');
  const [sheet, setSheet] = useState<SheetState>('none');

  const [attendanceCount, setAttendanceCount] = useState(1);
  const [spend, setSpend] = useState(26.95);
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [fullyWatchedStreamIds, setFullyWatchedStreamIds] = useState<string[]>([]);
  const [registeredStreamIds, setRegisteredStreamIds] = useState<string[]>([]);
  const [joinedLiveStreamIds, setJoinedLiveStreamIds] = useState<string[]>([]);
  const [purchasedConcertTicketIds, setPurchasedConcertTicketIds] = useState<string[]>([]);
  const [fullLiveRewardClaimed, setFullLiveRewardClaimed] = useState(false);
  const [statusText, setStatusText] = useState('');

  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(defaultCheckoutForm);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [saveForFuture, setSaveForFuture] = useState(true);

  const [events, setEvents] = useState<EventItem[]>([
    { code: 'EVT_app_open', message: 'App abierta en modo fans', at: nowLabel() }
  ]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: `n-${Date.now()}`,
      title: 'Bienvenida',
      message: 'Completa hitos y desbloquea recompensas de fan.',
      at: nowLabel()
    }
  ]);
  const notificationTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>(defaultRewardHistory);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>(defaultPurchases);
  const [lastCompletedPurchaseId, setLastCompletedPurchaseId] = useState<string | null>(null);

  const [profileSettings, setProfileSettings] = useState<ProfileSettings>(defaultProfileSettings);
  const [addresses, setAddresses] = useState<Address[]>(defaultAddresses);

  const [billingProfile, setBillingProfile] = useState<BillingProfile | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [profileSavedCardsEnabled] = useState(true);
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [cardSetupClientSecret, setCardSetupClientSecret] = useState('');
  const [cardSetupLoading, setCardSetupLoading] = useState(false);
  const [cardSetupError, setCardSetupError] = useState('');

  const [journeyXp, setJourneyXp] = useState(0);
  const [highestJourneyTierId, setHighestJourneyTierId] = useState<Tier['id']>('fan');

  const activeStream = streams[streamIndex];

  function pushHistory(item: Omit<RewardHistoryItem, 'id' | 'at'>) {
    setRewardHistory((prev) => [{ id: `h-${Date.now()}-${Math.random()}`, at: nowLabel(), ...item }, ...prev].slice(0, 20));
  }

  function addXp(amount: number, reason: string) {
    setJourneyXp((prev) => prev + amount);
    pushHistory({ label: `+${amount} XP · ${reason}`, type: 'xp' });
  }

  function track(code: string, message: string) {
    setEvents((prev) => [{ code, message, at: nowLabel() }, ...prev].slice(0, 15));
  }

  function notify(title: string, message: string) {
    setNotifications((prev) => [{ id: `n-${Date.now()}-${Math.random()}`, title, message, at: nowLabel() }, ...prev].slice(0, 12));
  }

  function clearNotifications() {
    Object.values(notificationTimeouts.current).forEach((timer) => clearTimeout(timer));
    notificationTimeouts.current = {};
    setNotifications([]);
  }

  useEffect(() => {
    let cancelled = false;
    setProfileSettings(safeReadProfileSettings());
    setAddresses(defaultAddresses);
    setRewardHistory(safeReadRewardHistory());
    setPurchases(safeReadPurchases());

    async function bootstrapSession() {
      const savedToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
      if (!savedToken) {
        if (!cancelled) {
          setAuthStatus('logged_out');
        }
        return;
      }

      const session = await fetchAuthSession();
      if (!session.ok || !session.data?.user?.email) {
        clearStoredAuth();
        if (!cancelled) {
          setAuthStatus('logged_out');
          setAuthUserEmail('');
          setAuthProvider(null);
          setOnboardingCompleted(false);
          setIsNewUser(false);
        }
        return;
      }

      const email = session.data.user.email.trim().toLowerCase();
      if (cancelled) {
        return;
      }
      setAuthStatus('logged_in');
      setAuthUserEmail(email);
      setAuthProvider(session.data.user.authProvider || 'email');
      setOnboardingCompleted(Boolean(session.data.user.onboardingCompleted));
      setIsNewUser(!Boolean(session.data.user.onboardingCompleted));
      setProfileSettings((prev) => ({
        ...prev,
        email,
        displayName: prev.displayName || session.data?.user?.name || '',
        username: prev.username || email.split('@')[0] || '',
        avatarUrl: session.data?.user?.picture || prev.avatarUrl
      }));
      setCheckoutForm((prev) => ({ ...prev, email }));
      try {
        localStorage.setItem(AUTH_EMAIL_KEY, email);
      } catch {
        // localStorage may be blocked
      }
    }

    void bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const shouldShowOnboarding = authStatus === 'logged_in' && !onboardingCompleted && !onboardingDoneInSession;

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileSettings));
      if (profileSettings.email && profileSettings.email.includes('@')) {
        localStorage.setItem(AUTH_EMAIL_KEY, profileSettings.email.trim().toLowerCase());
      }
    } catch {
      // localStorage may be blocked
    }
  }, [profileSettings]);

  useEffect(() => {
    if (authStatus !== 'logged_in' || !authUserEmail) {
      setAddresses([]);
      return;
    }
    setAddresses(safeReadAddresses(authUserEmail));
  }, [authStatus, authUserEmail]);

  useEffect(() => {
    if (authStatus !== 'logged_in' || !authUserEmail) {
      return;
    }
    try {
      localStorage.setItem(userAddressStorageKey(authUserEmail), JSON.stringify(addresses));
    } catch {
      // localStorage may be blocked
    }
  }, [addresses, authStatus, authUserEmail]);

  useEffect(() => {
    try {
      localStorage.setItem(REWARD_HISTORY_STORAGE_KEY, JSON.stringify(rewardHistory));
    } catch {
      // localStorage may be blocked
    }
  }, [rewardHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
    } catch {
      // localStorage may be blocked
    }
  }, [purchases]);

  useEffect(() => {
    if (!checkoutForm.email && profileSettings.email) {
      setCheckoutForm((prev) => ({ ...prev, email: profileSettings.email }));
    }
    if (!checkoutForm.fullName && profileSettings.displayName) {
      setCheckoutForm((prev) => ({ ...prev, fullName: profileSettings.displayName }));
    }
  }, [checkoutForm.email, checkoutForm.fullName, profileSettings.displayName, profileSettings.email]);

  useEffect(() => {
    notifications.forEach((notification) => {
      if (notificationTimeouts.current[notification.id]) {
        return;
      }
      notificationTimeouts.current[notification.id] = setTimeout(() => {
        setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
        delete notificationTimeouts.current[notification.id];
      }, 5000);
    });
  }, [notifications]);

  useEffect(() => {
    return () => {
      Object.values(notificationTimeouts.current).forEach((timer) => clearTimeout(timer));
      notificationTimeouts.current = {};
    };
  }, []);

  useEffect(() => {
    if (!statusText) {
      return;
    }
    const timer = setTimeout(() => setStatusText(''), 5000);
    return () => clearTimeout(timer);
  }, [statusText]);

  async function refreshPaymentMethods() {
    if (!profileSavedCardsEnabled || authStatus !== 'logged_in') {
      return;
    }
    setBillingLoading(true);
    setBillingError('');
    const response = await fetchPaymentMethods();
    if (!response.ok || !response.data) {
      setBillingLoading(false);
      setBillingError(response.error || 'No se pudieron cargar tarjetas guardadas.');
      return;
    }

    setBillingProfile(response.data);
    const defaultMethod = response.data.methods.find((method) => method.isDefault) || response.data.methods[0];
    setSelectedPaymentMethodId(defaultMethod?.id || '');
    setBillingLoading(false);
  }

  useEffect(() => {
    async function initializeBilling() {
      if (!profileSavedCardsEnabled || authStatus !== 'logged_in') {
        return;
      }

      const [configResponse, methodsResponse] = await Promise.all([fetchStripeConfig(), fetchPaymentMethods()]);

      if (configResponse.ok && configResponse.data?.publishableKey) {
        setStripePublishableKey(configResponse.data.publishableKey);
      }

      if (!methodsResponse.ok || !methodsResponse.data) {
        setBillingError(methodsResponse.error || 'No se pudieron cargar tarjetas guardadas.');
        return;
      }

      setBillingProfile(methodsResponse.data);
      const defaultMethod = methodsResponse.data.methods.find((method) => method.isDefault) || methodsResponse.data.methods[0];
      setSelectedPaymentMethodId(defaultMethod?.id || '');
    }

    initializeBilling();
  }, [authStatus, profileSavedCardsEnabled]);

  const currentJourneyTierId = useMemo<Tier['id']>(() => {
    if (journeyXp >= JOURNEY_THRESHOLDS.god) {
      return 'god';
    }
    if (journeyXp >= JOURNEY_THRESHOLDS.ultra) {
      return 'ultra';
    }
    if (journeyXp >= JOURNEY_THRESHOLDS.super) {
      return 'super';
    }
    return 'fan';
  }, [journeyXp]);

  const journeyTiers: Tier[] = useMemo(() => {
    return [
      {
        id: 'fan',
        title: 'Fan Belako',
        requiredXp: JOURNEY_THRESHOLDS.fan,
        unlocked: journeyXp >= JOURNEY_THRESHOLDS.fan,
        current: currentJourneyTierId === 'fan',
        progressLabel: `${journeyXp}/${JOURNEY_THRESHOLDS.super} XP`,
        perkLabel: 'Acceso base a recompensas fan'
      },
      {
        id: 'super',
        title: 'Super Fan Belako',
        requiredXp: JOURNEY_THRESHOLDS.super,
        unlocked: journeyXp >= JOURNEY_THRESHOLDS.super,
        current: currentJourneyTierId === 'super',
        progressLabel: `${journeyXp}/${JOURNEY_THRESHOLDS.ultra} XP`,
        perkLabel: 'Insignia Super Fan + prioridad en drops'
      },
      {
        id: 'ultra',
        title: 'Ultra Fan Belako',
        requiredXp: JOURNEY_THRESHOLDS.ultra,
        unlocked: journeyXp >= JOURNEY_THRESHOLDS.ultra,
        current: currentJourneyTierId === 'ultra',
        progressLabel: `${journeyXp}/${JOURNEY_THRESHOLDS.god} XP`,
        perkLabel: 'Acceso anticipado a experiencias exclusivas'
      },
      {
        id: 'god',
        title: 'God Fan Belako',
        requiredXp: JOURNEY_THRESHOLDS.god,
        unlocked: journeyXp >= JOURNEY_THRESHOLDS.god,
        current: currentJourneyTierId === 'god',
        progressLabel: `${journeyXp} XP · MAX`,
        perkLabel: 'Estado máximo de la comunidad Belako'
      }
    ];
  }, [currentJourneyTierId, journeyXp]);

  const currentJourneyTier = useMemo(
    () => journeyTiers.find((tier) => tier.id === currentJourneyTierId) || journeyTiers[0],
    [currentJourneyTierId, journeyTiers]
  );

  const nextJourneyTier = useMemo(
    () => journeyTiers.find((tier) => tier.requiredXp > journeyXp) || null,
    [journeyTiers, journeyXp]
  );

  const journeyProgressPercent = useMemo(() => {
    if (!nextJourneyTier) {
      return 100;
    }
    const previousThreshold = currentJourneyTier.requiredXp;
    const span = Math.max(nextJourneyTier.requiredXp - previousThreshold, 1);
    const within = Math.max(journeyXp - previousThreshold, 0);
    return Math.min((within / span) * 100, 100);
  }, [currentJourneyTier.requiredXp, journeyXp, nextJourneyTier]);

  const conversion = useMemo(() => {
    if (currentJourneyTierId === 'god') {
      return 80;
    }
    if (currentJourneyTierId === 'ultra') {
      return 65;
    }
    if (currentJourneyTierId === 'super') {
      return 45;
    }
    return 25;
  }, [currentJourneyTierId]);

  useEffect(() => {
    const rank: Record<Tier['id'], number> = {
      fan: 0,
      super: 1,
      ultra: 2,
      god: 3
    };
    if (rank[currentJourneyTierId] <= rank[highestJourneyTierId]) {
      return;
    }

    setHighestJourneyTierId(currentJourneyTierId);
    notify('Nuevo tier desbloqueado', `¡Has subido a ${currentJourneyTier.title}!`);
    track('EVT_journey_tier_upgraded', `Tier alcanzado: ${currentJourneyTier.title}`);
    pushHistory({ label: `Tier alcanzado: ${currentJourneyTier.title}`, type: 'reward' });
  }, [currentJourneyTier.title, currentJourneyTierId, highestJourneyTierId]);

  const currentStreamFullyWatched = fullyWatchedStreamIds.includes(activeStream.id);
  const fullLiveRewardUnlocked = fullyWatchedStreamIds.length > 0;
  const joinedLiveCount = joinedLiveStreamIds.length;
  const concertTicketCount = purchasedConcertTicketIds.length;
  const merchPurchaseCount = purchases.filter((purchase) => !purchase.label.startsWith('Entrada concierto ·')).length;

  const profileSummary = useMemo(() => {
    const defaultShipping = addresses.find((item) => item.isDefaultShipping);
    const defaultBilling = addresses.find((item) => item.isDefaultBilling);
    return {
      displayName: profileSettings.displayName || 'Fan Belako',
      username: profileSettings.username || profileSettings.email.split('@')[0] || 'fan',
      defaultShipping,
      defaultBilling
    };
  }, [addresses, profileSettings.displayName, profileSettings.username]);

  async function loginWithGoogleToken(idToken: string) {
    setAuthStatus('logging_in');
    setAuthError('');

    const response = await loginWithGoogle(idToken);
    if (!response.ok || !response.data?.user?.email) {
      setAuthStatus('logged_out');
      setAuthError(response.error || 'No se pudo iniciar sesión con Google.');
      return;
    }

    const user = response.data.user;
    const email = user.email.trim().toLowerCase();
    setAuthStatus('logged_in');
    setAuthUserEmail(email);
    setAuthProvider('google');
    const isNewUserHint = Boolean(user.isNewUserHint);
    const onboardingDone = Boolean(user.onboardingCompleted);
    setOnboardingCompleted(onboardingDone);
    setIsNewUser(isNewUserHint || !onboardingDone);
    setOnboardingStep(0);
    setOnboardingDoneInSession(false);
    setFanTabState('home');
    setProfileSettings((prev) => ({
      ...prev,
      email,
      displayName: user.name || prev.displayName || email.split('@')[0],
      username: prev.username || email.split('@')[0] || '',
      avatarUrl: user.picture || prev.avatarUrl
    }));
    setCheckoutForm((prev) => ({ ...prev, email }));
    setStatusText('Sesión iniciada con Google.');
    track('EVT_google_login_success', `Login Google: ${email}`);
  }

  function completeOnboardingStep() {
    setOnboardingStep((prev) => Math.min(prev + 1, 2));
  }

  function finishOnboardingForCurrentUser() {
    if (!authUserEmail) {
      return;
    }
    void completeOnboarding();
    setOnboardingDoneInSession(true);
    setIsNewUser(false);
    setOnboardingCompleted(true);
    setOnboardingStep(0);
    setFanTabState('home');
    setStatusText('Onboarding completado. Bienvenido a Belako SuperFan.');
    track('EVT_onboarding_complete', 'Fan completó onboarding full-screen');
    notify('Todo listo', 'Ya puedes explorar directos y tienda desde Home.');
  }

  function setFanTab(tab: FanTab) {
    setFanTabState(tab);
    setSheet('none');
  }

  function registerStreamReminder(streamId: string) {
    const stream = streams.find((item) => item.id === streamId);
    if (!stream) {
      return;
    }
    if (!registeredStreamIds.includes(streamId)) {
      setRegisteredStreamIds((prev) => [...prev, streamId]);
    }
    setStatusText(`Te avisaremos cuando empiece "${stream.title}".`);
    track('EVT_stream_register', `Registro al próximo directo de ${stream.artist}`);
  }

  function openConcertTicketCheckout(ticketId: string) {
    const ticket = concertTickets.find((item) => item.id === ticketId);
    if (!ticket) {
      setStatusText('La entrada seleccionada no está disponible.');
      return;
    }

    if (purchasedConcertTicketIds.includes(ticketId)) {
      setStatusText('Ya tienes esta entrada en tu perfil.');
      return;
    }

    const ticketProduct: Product = {
      id: `ticket-${ticket.id}`,
      name: `Entrada concierto · ${ticket.title}`,
      fiatPrice: ticket.priceEur,
      imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_Banda.jpg?v=1753809570',
      limited: false
    };

    openCheckout(ticketProduct);
    track('EVT_ticket_checkout_started', `Checkout abierto para entrada ${ticket.title}`);
  }

  function joinLiveStream(streamId: string) {
    const nextIndex = streams.findIndex((stream) => stream.id === streamId);
    if (nextIndex < 0) {
      setStatusText('No se ha encontrado el directo.');
      return;
    }

    setStreamIndex(nextIndex);
    setLiveState('live');
    setSheet('none');

    const stream = streams[nextIndex];
    track('EVT_stream_join', `Entró al directo de ${stream.artist}`);

    if (joinedLiveStreamIds.includes(streamId)) {
      return;
    }

    setJoinedLiveStreamIds((prev) => [...prev, streamId]);
    addXp(xpPolicy.liveJoin, `Unirse a directo: ${stream.title}`);
    notify('XP ganada', `+${xpPolicy.liveJoin} XP por unirte al directo.`);
  }

  function watchFullLive() {
    if (currentStreamFullyWatched) {
      setStatusText('Ya has completado este directo.');
      return;
    }
    setFullyWatchedStreamIds((prev) => [...prev, activeStream.id]);
    setAttendanceCount((n) => n + 1);
    addXp(xpPolicy.fullLive, 'Directo completo');
    setStatusText('Directo completo visto. Recompensa especial desbloqueada.');
    track('EVT_stream_full_watch', `Directo completo visto: ${activeStream.id}`);
    notify('Recompensa desbloqueada', 'Directo completo verificado y recompensa lista para reclamar.');
    pushHistory({ label: `Directo completo: ${activeStream.title}`, type: 'reward' });
  }

  function claimFullLiveReward() {
    if (!fullLiveRewardUnlocked) {
      setStatusText('Completa un directo entero para desbloquear esta recompensa.');
      return;
    }
    if (fullLiveRewardClaimed) {
      setStatusText('Recompensa de directo completo ya reclamada.');
      return;
    }
    setFullLiveRewardClaimed(true);
    setStatusText('Recompensa reclamada.');
    track('EVT_full_live_reward_claimed', 'Recompensa de directo completo reclamada');
    notify('Recompensa reclamada', 'Has reclamado tu recompensa por ver el directo entero.');
  }

  function hasConcertTicket(ticketId: string): boolean {
    return purchasedConcertTicketIds.includes(ticketId);
  }

  function updateProfileField<K extends keyof ProfileSettings>(field: K, value: ProfileSettings[K]) {
    setProfileSettings((prev) => ({ ...prev, [field]: value }));
    if (field === 'email' && typeof value === 'string') {
      const normalizedEmail = value.trim().toLowerCase();
      if (normalizedEmail.includes('@')) {
        try {
          localStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);
        } catch {
          // localStorage may be blocked
        }
        setCheckoutForm((prev) => ({ ...prev, email: normalizedEmail }));
      }
    }
  }

  function toggleNotification(key: NotificationPreferenceKey) {
    setProfileSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  }

  function addAddress(payload: AddressInput) {
    const nextAddress: Address = {
      ...payload,
      id: `addr-${Date.now()}`,
      isDefaultBilling: addresses.length === 0,
      isDefaultShipping: addresses.length === 0
    };
    setAddresses((prev) => [...prev, nextAddress]);
    setStatusText('Dirección añadida.');
  }

  function editAddress(id: string, payload: AddressInput) {
    setAddresses((prev) =>
      prev.map((address) =>
        address.id === id
          ? {
              ...address,
              ...payload
            }
          : address
      )
    );
    setStatusText('Dirección actualizada.');
  }

  function removeAddress(id: string) {
    setAddresses((prev) => {
      const target = prev.find((item) => item.id === id);
      const filtered = prev.filter((address) => address.id !== id);

      if (filtered.length === 0) {
        return [];
      }

      if (target?.isDefaultShipping && filtered[0]) {
        filtered[0] = { ...filtered[0], isDefaultShipping: true };
      }
      if (target?.isDefaultBilling && filtered[0]) {
        filtered[0] = { ...filtered[0], isDefaultBilling: true };
      }

      return [...filtered];
    });
    setStatusText('Dirección eliminada.');
  }

  function setDefaultAddress(id: string, type: AddressType) {
    setAddresses((prev) =>
      prev.map((address) => ({
        ...address,
        isDefaultShipping: type === 'shipping' ? address.id === id : address.isDefaultShipping,
        isDefaultBilling: type === 'billing' ? address.id === id : address.isDefaultBilling
      }))
    );
    setStatusText(type === 'shipping' ? 'Dirección de envío por defecto actualizada.' : 'Dirección de facturación por defecto actualizada.');
  }

  function fillCheckoutWithAddress(id: string) {
    const selected = addresses.find((address) => address.id === id);
    if (!selected) {
      return;
    }
    setCheckoutForm((prev) => ({
      ...prev,
      fullName: selected.fullName || prev.fullName,
      address: selected.line1 || prev.address,
      city: selected.city || prev.city,
      postalCode: selected.postalCode || prev.postalCode,
      country: selected.country || prev.country
    }));
  }

  function getDefaultProfileAddress() {
    return addresses.find((address) => address.isDefaultShipping) || addresses[0];
  }

  async function setDefaultSavedMethod(paymentMethodId: string) {
    setBillingError('');
    const response = await setDefaultPaymentMethod(paymentMethodId);
    if (!response.ok) {
      setBillingError(response.error || 'No se pudo actualizar tarjeta por defecto.');
      return;
    }

    await refreshPaymentMethods();
    setStatusText('Tarjeta por defecto actualizada.');
  }

  async function removeSavedMethod(paymentMethodId: string) {
    setBillingError('');
    const response = await removePaymentMethod(paymentMethodId);
    if (!response.ok) {
      setBillingError(response.error || 'No se pudo eliminar la tarjeta.');
      return;
    }

    await refreshPaymentMethods();
    setStatusText('Tarjeta eliminada.');
  }

  async function openCardSetup() {
    setCardSetupError('');
    setCardSetupLoading(true);

    const defaultAddress = getDefaultProfileAddress();
    setCheckoutForm((prev) => ({
      ...prev,
      fullName: profileSettings.displayName || prev.fullName,
      email: profileSettings.email || prev.email,
      address: defaultAddress?.line1 || prev.address,
      city: defaultAddress?.city || prev.city,
      postalCode: defaultAddress?.postalCode || prev.postalCode,
      country: defaultAddress?.country || prev.country
    }));

    if (!stripePublishableKey) {
      const configResult = await fetchStripeConfig();
      if (!configResult.ok || !configResult.data?.publishableKey) {
        setCardSetupLoading(false);
        setCardSetupError(configResult.error || 'No se pudo cargar Stripe.');
        return;
      }
      setStripePublishableKey(configResult.data.publishableKey);
    }

    const customerResult = await bootstrapCustomer();
    if (!customerResult.ok || !customerResult.data?.customerId) {
      setCardSetupLoading(false);
      setCardSetupError(customerResult.error || 'No se pudo inicializar cliente de pago.');
      return;
    }

    const setupResult = await createSetupIntent(customerResult.data.customerId);
    if (!setupResult.ok || !setupResult.data?.clientSecret) {
      setCardSetupLoading(false);
      setCardSetupError(setupResult.error || 'No se pudo crear SetupIntent.');
      return;
    }

    setCardSetupClientSecret(setupResult.data.clientSecret);
    setSheet('cardSetup');
    setCardSetupLoading(false);
  }

  function closeCardSetup() {
    setCardSetupClientSecret('');
    setCardSetupError('');
    setCardSetupLoading(false);
    setSheet('none');
    setFanTab('profile');
  }

  async function onCardSetupSuccess(paymentMethodId?: string) {
    setCardSetupError('');
    setCardSetupClientSecret('');
    await refreshPaymentMethods();
    if (paymentMethodId) {
      setSelectedPaymentMethodId(paymentMethodId);
    }
    setSheet('none');
    setFanTab('profile');
    setStatusText('Tarjeta guardada correctamente.');
  }

  function logoutSession() {
    clearStoredAuth();
    setBillingProfile(null);
    setSelectedPaymentMethodId('');
    setAuthStatus('logged_out');
    setAuthUserEmail('');
    setAuthProvider(null);
    setAuthError('');
    setOnboardingDoneInSession(false);
    setOnboardingStep(0);
    setIsNewUser(false);
    setFanTabState('home');
    setSheet('none');
    setStatusText('Sesión cerrada.');
    track('EVT_fan_logout', 'Fan cerró sesión local');
  }

  function openCheckout(product: Product) {
    setSelectedProduct(product);
    setSheet('checkout');
    setCheckoutError('');

    if (billingProfile?.methods.length) {
      const defaultMethod = billingProfile.methods.find((method) => method.isDefault) || billingProfile.methods[0];
      setSelectedPaymentMethodId(defaultMethod?.id || '');
    }

    const defaultAddress = getDefaultProfileAddress();
    setCheckoutForm((prev) => ({
      ...prev,
      fullName: profileSettings.displayName || prev.fullName,
      email: profileSettings.email || prev.email,
      address: defaultAddress?.line1 || prev.address,
      city: defaultAddress?.city || prev.city,
      postalCode: defaultAddress?.postalCode || prev.postalCode,
      country: defaultAddress?.country || prev.country
    }));

    track('EVT_merch_checkout_started', `Checkout abierto para ${product.name}`);
  }

  function updateCheckoutField<K extends keyof CheckoutForm>(field: K, value: CheckoutForm[K]) {
    setCheckoutForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateCheckout(): string {
    if (checkoutForm.fullName.trim().length < 3) {
      return 'Introduce nombre y apellidos.';
    }
    if (!checkoutForm.email.includes('@')) {
      return 'Introduce un email valido.';
    }
    if (checkoutForm.address.trim().length < 5) {
      return 'Introduce una direccion valida.';
    }
    if (checkoutForm.city.trim().length < 2) {
      return 'Introduce ciudad.';
    }
    if (checkoutForm.postalCode.trim().length < 4) {
      return 'Introduce codigo postal.';
    }
    if (!checkoutForm.acceptedPolicy) {
      return 'Debes aceptar politica de compra y devoluciones.';
    }
    return '';
  }

  function mergeStripeInvoiceOnPurchase(
    purchaseId: string,
    invoice: {
      paymentIntentId: string;
      chargeId?: string;
      status: string;
      amountEur: number;
      currency: string;
      createdAt: string;
      receiptUrl?: string;
      hostedInvoiceUrl?: string;
      invoicePdfUrl?: string;
      customerEmail?: string;
      customerName?: string;
    }
  ) {
    setPurchases((prev) =>
      prev.map((purchase) =>
        purchase.id === purchaseId
          ? {
              ...purchase,
              stripePaymentIntentId: invoice.paymentIntentId || purchase.stripePaymentIntentId,
              stripeChargeId: invoice.chargeId || purchase.stripeChargeId,
              stripeReceiptUrl: invoice.receiptUrl || purchase.stripeReceiptUrl,
              stripeInvoicePdfUrl: invoice.invoicePdfUrl || purchase.stripeInvoicePdfUrl,
              stripeHostedInvoiceUrl: invoice.hostedInvoiceUrl || purchase.stripeHostedInvoiceUrl,
              customerEmail: invoice.customerEmail || purchase.customerEmail,
              customerName: invoice.customerName || purchase.customerName,
              status: invoice.status === 'succeeded' ? 'paid' : purchase.status,
              invoiceLastSyncedAt: nowLabel(),
              invoiceError: undefined
            }
          : purchase
      )
    );
  }

  async function syncPurchaseInvoice(
    purchaseId: string,
    refs?: { sessionId?: string; paymentIntentId?: string }
  ) {
    const purchase = purchases.find((item) => item.id === purchaseId);
    if (!purchase && !refs?.sessionId && !refs?.paymentIntentId) {
      return;
    }
    const sessionId = refs?.sessionId || purchase?.stripeSessionId;
    const paymentIntentId = refs?.paymentIntentId || purchase?.stripePaymentIntentId;

    if (!sessionId && !paymentIntentId) {
      setPurchases((prev) =>
        prev.map((item) =>
          item.id === purchaseId
            ? { ...item, invoiceError: 'Esta compra no tiene referencia Stripe para descargar factura.' }
            : item
        )
      );
      return;
    }

    const invoiceResponse = await fetchStripeInvoice({
      sessionId,
      paymentIntentId
    });

    if (!invoiceResponse.ok || !invoiceResponse.data) {
      setPurchases((prev) =>
        prev.map((item) =>
          item.id === purchaseId
            ? { ...item, invoiceError: invoiceResponse.error || 'No se pudo sincronizar factura Stripe.' }
            : item
        )
      );
      return;
    }

    mergeStripeInvoiceOnPurchase(purchaseId, invoiceResponse.data);
  }

  function onPurchaseSuccess(
    productName: string,
    amountPaid: number,
    stripeRef?: { sessionId?: string; paymentIntentId?: string },
    checkoutRef?: { productId?: string }
  ) {
    const productId = checkoutRef?.productId || selectedProduct.id;
    const isConcertTicket = productId.startsWith('ticket-');
    const ticketId = isConcertTicket ? productId.replace('ticket-', '') : '';
    const purchaseId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const purchaseAt = nowLabel();

    setSpend((n) => n + amountPaid);
    setPurchases((prev) => [
      {
        id: purchaseId,
        label: productName,
        at: purchaseAt,
        amountEur: amountPaid,
        status: 'paid',
        customerName: checkoutForm.fullName,
        customerEmail: checkoutForm.email,
        stripeSessionId: stripeRef?.sessionId,
        stripePaymentIntentId: stripeRef?.paymentIntentId
      },
      ...prev
    ]);
    setLastCompletedPurchaseId(purchaseId);
    if (isConcertTicket) {
      if (ticketId && !purchasedConcertTicketIds.includes(ticketId)) {
        setPurchasedConcertTicketIds((prev) => [...prev, ticketId]);
      }
      addXp(xpPolicy.inPersonTicket, `Entrada presencial: ${productName}`);
    } else {
      addXp(xpPolicy.purchase, `Compra ${productName}`);
    }
    setSheet('none');
    setFanTab('profile');
    setCheckoutProcessing(false);
    setStatusText(`Pago confirmado: ${productName}.`);
    track(
      isConcertTicket ? 'EVT_in_person_ticket_purchase' : 'EVT_merch_purchase_success',
      isConcertTicket ? `Compra entrada ${productName}` : `Compra en EUR completada para ${productName}`
    );
    notify(
      'Compra completada',
      isConcertTicket
        ? `${productName} confirmada. +${xpPolicy.inPersonTicket} XP por entrada presencial.`
        : `${productName} confirmado. Revisa tu email para seguimiento.`
    );
    pushHistory({ label: `Compra ${productName} (€${amountPaid.toFixed(2)})`, type: 'purchase' });

    if (stripeRef?.sessionId || stripeRef?.paymentIntentId) {
      void syncPurchaseInvoice(purchaseId, stripeRef);
    }
  }

  async function payWithFiat() {
    const validation = validateCheckout();
    if (validation) {
      setCheckoutError(validation);
      setStatusText(validation);
      return;
    }

    setCheckoutProcessing(true);
    setCheckoutError('');

    const isConcertTicket = selectedProduct.id.startsWith('ticket-');
    const serviceFee = Number((selectedProduct.fiatPrice * 0.05).toFixed(2));
    const shipping = isConcertTicket ? 0 : selectedProduct.fiatPrice >= 40 ? 0 : 4.9;
    const total = Number((selectedProduct.fiatPrice + serviceFee + shipping).toFixed(2));

    const response = await createStripeCheckoutSession({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      customerEmail: checkoutForm.email,
      totalAmountEur: total,
      paymentMethodId: selectedPaymentMethodId || undefined,
      saveForFuture
    });

    if (!response.ok || !response.data) {
      setCheckoutProcessing(false);
      setCheckoutError(response.error || 'Error de pago. Intenta de nuevo.');
      notify('Error de pago', 'No se pudo completar tu compra.');
      return;
    }

    if (response.data.mode === 'payment_intent') {
      onPurchaseSuccess(selectedProduct.name, total, {
        paymentIntentId: response.data.paymentIntentId
      });
      return;
    }

    if (!response.data.url) {
      setCheckoutProcessing(false);
      setCheckoutError('No se recibió URL de checkout.');
      return;
    }

    window.location.assign(response.data.url);
  }

  function nextStream() {
    if (streams.length === 0) {
      setStatusText('No hay directos activos ahora mismo.');
      return;
    }
    const next = (streamIndex + 1) % streams.length;
    setStreamIndex(next);
    setLiveState('live');
    track('EVT_stream_join', `Entró al directo de ${streams[next].artist}`);
  }

  function toggleReconnectState() {
    if (liveState === 'live') {
      setLiveState('reconnecting');
      setStatusText('Conexion inestable. Reconectando...');
      return;
    }
    setLiveState('live');
    setStatusText('Conexion restablecida.');
  }

  function endStream() {
    setLiveState('ended');
    setStatusText('Directo finalizado. Puedes entrar al siguiente directo cuando quieras.');
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');

    if (checkoutState === 'success') {
      const productName = params.get('productName') || 'Merch Belako';
      const productId = params.get('productId') || selectedProduct.id;
      const total = Number(params.get('total'));
      const amountPaid = Number.isFinite(total) && total > 0 ? total : selectedProduct.fiatPrice;
      const sessionId = params.get('session_id') || undefined;
      onPurchaseSuccess(productName, amountPaid, { sessionId }, { productId });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (checkoutState === 'cancel') {
      setCheckoutProcessing(false);
      setCheckoutError('Pago cancelado. Puedes volver a intentarlo.');
      setStatusText('Pago cancelado.');
      track('EVT_merch_purchase_canceled', 'Checkout cancelado en Stripe');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [selectedProduct.fiatPrice]);

  return {
    fanTab,
    authStatus,
    authUserEmail,
    authError,
    authProvider,
    shouldShowOnboarding,
    isNewUser,
    onboardingStep,
    onboardingDoneInSession,
    streamIndex,
    activeStream,
    liveState,
    sheet,
    attendanceCount,
    spend,
    registeredStreamIds,
    joinedLiveCount,
    concertTicketCount,
    merchPurchaseCount,
    currentStreamFullyWatched,
    fullLiveRewardUnlocked,
    fullLiveRewardClaimed,
    concertTickets,
    selectedProduct,
    journeyXp,
    journeyTiers,
    currentJourneyTier,
    nextJourneyTier,
    journeyProgressPercent,
    statusText,
    checkoutForm,
    checkoutError,
    checkoutProcessing,
    events,
    notifications,
    rewardHistory,
    purchases,
    lastCompletedPurchaseId,
    conversion,
    profileSettings,
    profileSummary,
    addresses,
    billingProfile,
    billingLoading,
    billingError,
    profileSavedCardsEnabled,
    stripePublishableKey,
    cardSetupClientSecret,
    cardSetupLoading,
    cardSetupError,
    selectedPaymentMethodId,
    saveForFuture,
    setFanTab,
    setSheet,
    setSelectedPaymentMethodId,
    setSaveForFuture,
    setCardSetupError,
    loginWithGoogleToken,
    completeOnboardingStep,
    finishOnboardingForCurrentUser,
    watchFullLive,
    joinLiveStream,
    registerStreamReminder,
    openConcertTicketCheckout,
    claimFullLiveReward,
    hasConcertTicket,
    openCheckout,
    updateCheckoutField,
    payWithFiat,
    nextStream,
    toggleReconnectState,
    endStream,
    clearNotifications,
    updateProfileField,
    toggleNotification,
    addAddress,
    editAddress,
    removeAddress,
    setDefaultAddress,
    fillCheckoutWithAddress,
    refreshPaymentMethods,
    openCardSetup,
    closeCardSetup,
    setDefaultSavedMethod,
    removeSavedMethod,
    onCardSetupSuccess,
    syncPurchaseInvoice,
    logoutSession,
    track
  };
}

export function onboardingCopy(step: number): string {
  if (step === 0) {
    return 'Elige estilos y sigue a Belako para personalizar tu feed.';
  }
  if (step === 1) {
    return 'Completa hitos para subir en el journey de fan.';
  }
  return 'Mira un directo entero para desbloquear tu primera recompensa.';
}

export function liveBadgeText(state: LiveState): string {
  if (state === 'reconnecting') {
    return 'RECONECTANDO';
  }
  if (state === 'ended') {
    return 'FINALIZADO';
  }
  return 'EN DIRECTO';
}
