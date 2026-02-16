import { useEffect, useMemo, useRef, useState } from 'react';
import { products, streams, nowLabel } from '../lib/mock-data';
import type {
  Address,
  BillingProfile,
  EventItem,
  FanTab,
  GamificationState,
  LiveState,
  NotificationItem,
  NotificationPreferenceKey,
  ProfileSettings,
  Product,
  RewardHistoryItem,
  SeasonMission,
  SeasonPassTier,
  SheetState,
  Tier
} from '../lib/types';
import {
  bootstrapCustomer,
  createSetupIntent,
  createStripeCheckoutSession,
  fetchPaymentMethods,
  fetchStripeConfig,
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

type CheckoutMode = 'fiat' | 'coin';
type AddressType = 'shipping' | 'billing';
type AddressInput = Omit<Address, 'id' | 'isDefaultShipping' | 'isDefaultBilling'>;

const AUTH_TOKEN_KEY = 'belako_fan_token';
const AUTH_EMAIL_KEY = 'belako_fan_email';
const PROFILE_STORAGE_KEY = 'belako_profile_settings_v1';
const ADDRESS_STORAGE_KEY = 'belako_addresses_v1';
const REWARD_HISTORY_STORAGE_KEY = 'belako_reward_history_v1';

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
  watchMinute: 10,
  fullLive: 50,
  purchase: 80,
  tierClaim: 40,
  missionClaimBonus: 20
};

const seasonLevels = [0, 100, 220, 380, 580, 820];

const defaultProfileSettings: ProfileSettings = {
  displayName: 'Asier Sarasua',
  username: 'assarasua',
  bio: 'Creative Farmer',
  avatarUrl: '/asier-avatar.jpg',
  location: 'Tolosa, Euskadi',
  website: 'https://bizkardolab.eus',
  email: 'assarasua@gmail.com',
  phone: '+34615788239',
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

const defaultAddresses: Address[] = [
  {
    id: 'addr-default',
    label: 'Principal',
    fullName: 'Asier Sarasua',
    line1: 'Calle Mayor 1',
    line2: '',
    city: 'Tolosa',
    postalCode: '20400',
    country: 'España',
    isDefaultShipping: true,
    isDefaultBilling: true
  }
];

const defaultRewardHistory: RewardHistoryItem[] = [
  {
    id: 'h-initial-vinyl',
    label: 'Compra Belako LP Vinilo 12" Transparente Ed. limitada "Sigo regando" (€26.95)',
    at: nowLabel(),
    type: 'purchase'
  }
];

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

function safeReadAddresses(): Address[] {
  try {
    const raw = localStorage.getItem(ADDRESS_STORAGE_KEY);
    if (!raw) {
      return defaultAddresses;
    }
    const parsed = JSON.parse(raw) as Address[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultAddresses;
    }
    return parsed;
  } catch {
    return defaultAddresses;
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

export function useFidelityState() {
  const [fanTab, setFanTab] = useState<FanTab>('home');

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const [streamIndex, setStreamIndex] = useState(0);
  const [liveState, setLiveState] = useState<LiveState>('live');
  const [sheet, setSheet] = useState<SheetState>('none');

  const [attendanceCount, setAttendanceCount] = useState(1);
  const [spend, setSpend] = useState(26.95);
  const [belakoCoins, setBelakoCoins] = useState(40);
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [claimedTierIds, setClaimedTierIds] = useState<number[]>([]);
  const [fullyWatchedStreamIds, setFullyWatchedStreamIds] = useState<string[]>([]);
  const [fullLiveRewardClaimed, setFullLiveRewardClaimed] = useState(false);
  const [statusText, setStatusText] = useState('');

  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(defaultCheckoutForm);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);
  const [checkoutUseCoinDiscount, setCheckoutUseCoinDiscount] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>('fiat');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [saveForFuture, setSaveForFuture] = useState(true);

  const [events, setEvents] = useState<EventItem[]>([
    { code: 'EVT_app_open', message: 'App abierta en modo fans', at: nowLabel() }
  ]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: `n-${Date.now()}`,
      title: 'Bienvenida',
      message: 'Completa hitos para ganar Belako Coin y recompensas.',
      at: nowLabel()
    }
  ]);
  const notificationTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>(defaultRewardHistory);

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

  const [seasonXp, setSeasonXp] = useState(35);
  const [lastActivityDay, setLastActivityDay] = useState(new Date().toISOString());
  const [streakDays, setStreakDays] = useState(1);
  const [watchMinuteCount, setWatchMinuteCount] = useState(0);
  const [fullWatchCount, setFullWatchCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(1);
  const [tierClaimCount, setTierClaimCount] = useState(0);
  const [claimedSeasonTierIds, setClaimedSeasonTierIds] = useState<string[]>([]);
  const [claimedMissionIds, setClaimedMissionIds] = useState<string[]>([]);

  const activeStream = streams[streamIndex];

  const coinPolicy = {
    watchReward: 5,
    purchaseReward: 20,
    claimReward: 30,
    discountCost: 50,
    discountValueEur: 5,
    dailyWatchCoinCap: 50
  };

  function toDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function registerDailyActivity() {
    const today = new Date();
    const todayKey = toDayKey(today);
    const lastKey = toDayKey(new Date(lastActivityDay));
    if (todayKey === lastKey) {
      return;
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = toDayKey(yesterday);

    setStreakDays((prev) => (lastKey === yesterdayKey ? prev + 1 : 1));
    setLastActivityDay(today.toISOString());
  }

  function pushHistory(item: Omit<RewardHistoryItem, 'id' | 'at'>) {
    setRewardHistory((prev) => [{ id: `h-${Date.now()}-${Math.random()}`, at: nowLabel(), ...item }, ...prev].slice(0, 20));
  }

  function addXp(amount: number, reason: string) {
    setSeasonXp((prev) => prev + amount);
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
    setProfileSettings(safeReadProfileSettings());
    setAddresses(safeReadAddresses());
    setRewardHistory(safeReadRewardHistory());
    const savedEmail = localStorage.getItem(AUTH_EMAIL_KEY) || '';
    if (savedEmail) {
      setProfileSettings((prev) => ({ ...prev, email: prev.email || savedEmail }));
      setCheckoutForm((prev) => ({ ...prev, email: prev.email || savedEmail }));
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileSettings));
    } catch {
      // localStorage may be blocked
    }
  }, [profileSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(ADDRESS_STORAGE_KEY, JSON.stringify(addresses));
    } catch {
      // localStorage may be blocked
    }
  }, [addresses]);

  useEffect(() => {
    try {
      localStorage.setItem(REWARD_HISTORY_STORAGE_KEY, JSON.stringify(rewardHistory));
    } catch {
      // localStorage may be blocked
    }
  }, [rewardHistory]);

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
    if (!profileSavedCardsEnabled) {
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
      if (!profileSavedCardsEnabled) {
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
  }, [profileSavedCardsEnabled]);

  const tiers: Tier[] = useMemo(() => {
    return [
      {
        id: 1,
        title: 'Nivel 1 - Fan activo',
        requirement: '3 directos',
        unlocked: attendanceCount >= 3,
        progress: `${Math.min(attendanceCount, 3)}/3 directos`,
        reward: '+30 BEL + boost de XP'
      },
      {
        id: 2,
        title: 'Nivel 2 - Fan premium',
        requirement: '10 directos + 50 EUR de gasto',
        unlocked: attendanceCount >= 10 && spend >= 50,
        progress: `${Math.min(attendanceCount, 10)}/10 directos | €${spend}/€50`,
        reward: '+30 BEL + prioridad en recompensas'
      },
      {
        id: 3,
        title: 'Nivel 3 - Superfan Belako',
        requirement: '20 directos + 150 EUR de gasto',
        unlocked: attendanceCount >= 20 && spend >= 150,
        progress: `${Math.min(attendanceCount, 20)}/20 directos | €${spend}/€150`,
        reward: '+30 BEL + estado Superfan'
      }
    ];
  }, [attendanceCount, spend]);

  const conversion = useMemo(() => {
    const superfan = tiers[2].unlocked ? 1 : 0;
    const base = Math.round((attendanceCount / 30) * 100);
    return Math.min(80, base + superfan * 8);
  }, [attendanceCount, tiers]);

  const currentLevel = useMemo(() => {
    let level = 0;
    for (let i = 0; i < seasonLevels.length; i += 1) {
      if (seasonXp >= seasonLevels[i]) {
        level = i;
      }
    }
    return level;
  }, [seasonXp]);

  const nextLevelXp = useMemo(() => {
    const next = seasonLevels[currentLevel + 1];
    return next ?? seasonLevels[seasonLevels.length - 1];
  }, [currentLevel]);

  const seasonPass: GamificationState = useMemo(() => ({
    seasonName: 'Temporada Sigo Regando',
    seasonEndsAt: '2026-12-31T23:59:59.000Z',
    currentXp: seasonXp,
    currentLevel,
    nextLevelXp,
    streakDays
  }), [currentLevel, nextLevelXp, seasonXp, streakDays]);

  const seasonTiers: SeasonPassTier[] = useMemo(() => {
    return [
      { id: 'sp-1', title: 'Nivel 1', requiredXp: 100, rewardLabel: '+15 BEL', claimed: claimedSeasonTierIds.includes('sp-1') },
      { id: 'sp-2', title: 'Nivel 2', requiredXp: 220, rewardLabel: 'Drop early access', claimed: claimedSeasonTierIds.includes('sp-2') },
      { id: 'sp-3', title: 'Nivel 3', requiredXp: 380, rewardLabel: '+25 BEL', claimed: claimedSeasonTierIds.includes('sp-3') },
      { id: 'sp-4', title: 'Nivel 4', requiredXp: 580, rewardLabel: 'Acceso anticipado a drops', claimed: claimedSeasonTierIds.includes('sp-4') },
      { id: 'sp-5', title: 'Nivel 5', requiredXp: 820, rewardLabel: 'Perk superfan unlock', claimed: claimedSeasonTierIds.includes('sp-5') }
    ];
  }, [claimedSeasonTierIds]);

  const seasonMissions: SeasonMission[] = useMemo(() => {
    const definitions = [
      {
        id: 'm-watch-minute',
        title: 'Asistencia exprés',
        description: 'Ver 1 min en 3 directos esta semana',
        progress: watchMinuteCount,
        goal: 3,
        xpReward: 30
      },
      {
        id: 'm-full-live',
        title: 'Directo completo',
        description: 'Ver 1 directo entero',
        progress: fullWatchCount,
        goal: 1,
        xpReward: 50
      },
      {
        id: 'm-first-purchase',
        title: 'Merch supporter',
        description: 'Completar 1 compra en la tienda',
        progress: purchaseCount,
        goal: 1,
        xpReward: 80
      },
      {
        id: 'm-tier-claim',
        title: 'Ascenso fan',
        description: 'Reclamar 1 nivel de fidelidad',
        progress: tierClaimCount,
        goal: 1,
        xpReward: 40
      }
    ];

    return definitions.map((mission) => {
      const completed = mission.progress >= mission.goal;
      const claimed = claimedMissionIds.includes(mission.id);
      return {
        ...mission,
        status: claimed ? 'claimed' : completed ? 'completed' : 'active'
      };
    });
  }, [claimedMissionIds, fullWatchCount, purchaseCount, tierClaimCount, watchMinuteCount]);

  const canUseCoinDiscount = belakoCoins >= coinPolicy.discountCost;
  const currentStreamFullyWatched = fullyWatchedStreamIds.includes(activeStream.id);
  const fullLiveRewardUnlocked = fullyWatchedStreamIds.length > 0;

  const profileSummary = useMemo(() => {
    const defaultShipping = addresses.find((item) => item.isDefaultShipping);
    const defaultBilling = addresses.find((item) => item.isDefaultBilling);
    return {
      displayName: profileSettings.displayName || 'Fan Belako',
      username: profileSettings.username || 'belako.superfan',
      defaultShipping,
      defaultBilling
    };
  }, [addresses, profileSettings.displayName, profileSettings.username]);

  function completeOnboarding() {
    const next = onboardingStep + 1;
    if (next >= 3) {
      setOnboardingDone(true);
      setStatusText('Onboarding completado. Ya puedes entrar a directos de Belako.');
      track('EVT_onboarding_complete', 'Fan completó onboarding');
      notify('Onboarding completado', 'Ya puedes ganar BEL con hitos de fan.');
      return;
    }
    setOnboardingStep(next);
  }

  function watchMinute() {
    registerDailyActivity();
    setWatchMinuteCount((prev) => prev + 1);
    setAttendanceCount((n) => n + 1);
    setBelakoCoins((n) => n + coinPolicy.watchReward);
    addXp(xpPolicy.watchMinute, 'Asistencia de 1 minuto');
    setStatusText(`Asistencia verificada. +${coinPolicy.watchReward} BEL.`);
    track('EVT_belako_coin_earned', 'Belako Coin ganado por ver directo');
    notify('Belako Coin', `Has ganado +${coinPolicy.watchReward} BEL por ver el directo.`);
    pushHistory({ label: `+${coinPolicy.watchReward} BEL por asistencia`, type: 'coin' });
  }

  function watchFullLive() {
    if (currentStreamFullyWatched) {
      setStatusText('Ya has completado este directo.');
      return;
    }
    registerDailyActivity();
    setFullWatchCount((prev) => prev + 1);
    setFullyWatchedStreamIds((prev) => [...prev, activeStream.id]);
    setAttendanceCount((n) => n + 1);
    addXp(xpPolicy.fullLive, 'Directo completo');
    setStatusText('Directo completo visto. Recompensa especial desbloqueada.');
    track('EVT_stream_full_watch', `Directo completo visto: ${activeStream.id}`);
    notify('Recompensa desbloqueada', 'Ya puedes reclamar la recompensa por ver directo entero.');
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
    const fullWatchReward = 25;
    setFullLiveRewardClaimed(true);
    setBelakoCoins((n) => n + fullWatchReward);
    setStatusText(`Recompensa reclamada. +${fullWatchReward} BEL.`);
    track('EVT_full_live_reward_claimed', 'Recompensa de directo completo reclamada');
    notify('Recompensa reclamada', `Has ganado +${fullWatchReward} BEL por ver el directo entero.`);
    pushHistory({ label: `+${fullWatchReward} BEL por directo completo`, type: 'coin' });
  }

  function updateProfileField<K extends keyof ProfileSettings>(field: K, value: ProfileSettings[K]) {
    setProfileSettings((prev) => ({ ...prev, [field]: value }));
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
    setSheet('checkout');
  }

  async function onCardSetupSuccess(paymentMethodId?: string) {
    setCardSetupError('');
    setCardSetupClientSecret('');
    await refreshPaymentMethods();
    if (paymentMethodId) {
      setSelectedPaymentMethodId(paymentMethodId);
    }
    setSheet('checkout');
    setStatusText('Tarjeta guardada correctamente.');
  }

  function logoutSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
    setBillingProfile(null);
    setSelectedPaymentMethodId('');
    setStatusText('Sesión cerrada.');
    track('EVT_fan_logout', 'Fan cerró sesión local');
  }

  function openCheckout(product: Product, mode: CheckoutMode = 'fiat') {
    const normalizedMode: CheckoutMode = product.purchaseType === 'eur_only' ? 'fiat' : mode;
    setSelectedProduct(product);
    setSheet('checkout');
    setCheckoutMode(normalizedMode);
    setCheckoutError('');
    setCheckoutUseCoinDiscount(false);

    if (normalizedMode === 'fiat' && billingProfile?.methods.length) {
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

    track('EVT_merch_checkout_started', `${normalizedMode === 'coin' ? 'Canje' : 'Checkout'} abierto para ${product.name}`);
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

  function toggleCoinDiscount() {
    if (!canUseCoinDiscount) {
      setCheckoutError(`Necesitas ${coinPolicy.discountCost} BEL para usar descuento.`);
      return;
    }
    setCheckoutUseCoinDiscount((v) => !v);
    setCheckoutError('');
  }

  function onPurchaseSuccess(productName: string, amountPaid: number, usedCoinDiscount: boolean) {
    registerDailyActivity();
    setPurchaseCount((prev) => prev + 1);
    setSpend((n) => n + amountPaid);
    setBelakoCoins((n) => n + coinPolicy.purchaseReward - (usedCoinDiscount ? coinPolicy.discountCost : 0));
    addXp(xpPolicy.purchase, `Compra ${productName}`);
    setSheet('none');
    setCheckoutProcessing(false);
    setCheckoutUseCoinDiscount(false);
    setStatusText(`Pago confirmado: ${productName}. +${coinPolicy.purchaseReward} BEL.`);
    track('EVT_merch_purchase_success', `Compra en EUR completada para ${productName}`);
    notify('Compra completada', `${productName} confirmado. Revisa tu email para seguimiento.`);
    pushHistory({ label: `Compra ${productName} (€${amountPaid.toFixed(2)})`, type: 'purchase' });
    pushHistory({ label: `+${coinPolicy.purchaseReward} BEL por compra`, type: 'coin' });
  }

  async function payWithFiat() {
    const validation = validateCheckout();
    if (validation) {
      setCheckoutError(validation);
      setStatusText(validation);
      return;
    }

    if (checkoutMode === 'coin') {
      if (selectedProduct.belakoCoinCost == null) {
        setCheckoutError('Este producto solo permite compra en euros.');
        setCheckoutProcessing(false);
        return;
      }
      const coinCost = selectedProduct.belakoCoinCost;
      if (belakoCoins < coinCost) {
        setCheckoutError(`Saldo BEL insuficiente. Necesitas ${coinCost} BEL.`);
        setCheckoutProcessing(false);
        return;
      }

      setBelakoCoins((n) => n - coinCost);
      setSheet('none');
      setCheckoutProcessing(false);
      setCheckoutUseCoinDiscount(false);
      setStatusText(`Canje confirmado: ${selectedProduct.name}.`);
      track('EVT_reward_redeemed', `Canje en BEL completado para ${selectedProduct.name}`);
      notify('Canje completado', `${selectedProduct.name} añadido a tus pedidos.`);
      pushHistory({ label: `Canje ${selectedProduct.name} (${coinCost} BEL)`, type: 'reward' });
      return;
    }

    if (checkoutUseCoinDiscount && !canUseCoinDiscount) {
      setCheckoutError('Saldo BEL insuficiente para aplicar descuento.');
      return;
    }

    setCheckoutProcessing(true);
    setCheckoutError('');

    const serviceFee = Number((selectedProduct.fiatPrice * 0.05).toFixed(2));
    const shipping = selectedProduct.fiatPrice >= 40 ? 0 : 4.9;
    const discount = checkoutUseCoinDiscount ? coinPolicy.discountValueEur : 0;
    const total = Number((selectedProduct.fiatPrice + serviceFee + shipping - discount).toFixed(2));

    const response = await createStripeCheckoutSession({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      customerEmail: checkoutForm.email,
      totalAmountEur: total,
      useCoinDiscount: checkoutUseCoinDiscount,
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
      onPurchaseSuccess(selectedProduct.name, total, checkoutUseCoinDiscount);
      return;
    }

    if (!response.data.url) {
      setCheckoutProcessing(false);
      setCheckoutError('No se recibió URL de checkout.');
      return;
    }

    window.location.assign(response.data.url);
  }

  function claimTierReward(tier: Tier) {
    if (!tier.unlocked) {
      setStatusText('Nivel todavia no desbloqueado.');
      return;
    }
    if (claimedTierIds.includes(tier.id)) {
      setStatusText('Recompensa ya canjeada.');
      return;
    }

    registerDailyActivity();
    setTierClaimCount((prev) => prev + 1);
    setClaimedTierIds((prev) => [...prev, tier.id]);
    setBelakoCoins((n) => n + coinPolicy.claimReward);
    addXp(xpPolicy.tierClaim, `Claim ${tier.title}`);
    setStatusText(`Recompensa reclamada para ${tier.title}.`);
    notify('Recompensa reclamada', `${tier.title} completado con éxito.`);
    track('EVT_reward_claimed', `Recompensa reclamada: ${tier.title}`);

    pushHistory({ label: `Claim de ${tier.title}`, type: 'reward' });
    pushHistory({ label: `+${coinPolicy.claimReward} BEL por reclamar recompensa`, type: 'coin' });
  }

  function claimSeasonPassTier(tierId: string) {
    const tier = seasonTiers.find((item) => item.id === tierId);
    if (!tier || tier.claimed) {
      return;
    }
    if (seasonXp < tier.requiredXp) {
      setStatusText('Aún no alcanzas el XP requerido para este nivel.');
      return;
    }

    setClaimedSeasonTierIds((prev) => [...prev, tierId]);
    if (tierId === 'sp-1') {
      setBelakoCoins((prev) => prev + 15);
      pushHistory({ label: 'Battle Pass: +15 BEL', type: 'coin' });
    }
    if (tierId === 'sp-3') {
      setBelakoCoins((prev) => prev + 25);
      pushHistory({ label: 'Battle Pass: +25 BEL', type: 'coin' });
    }

    notify('Battle Pass', `Recompensa reclamada: ${tier.rewardLabel}`);
    track('EVT_battle_pass_tier_claimed', `Tier BP reclamado: ${tier.title}`);
    pushHistory({ label: `Battle Pass ${tier.title}: ${tier.rewardLabel}`, type: 'reward' });
  }

  function claimSeasonMission(missionId: string) {
    const mission = seasonMissions.find((item) => item.id === missionId);
    if (!mission || mission.status !== 'completed') {
      return;
    }
    setClaimedMissionIds((prev) => [...prev, missionId]);
    addXp(mission.xpReward + xpPolicy.missionClaimBonus, mission.title);
    notify('Misión reclamada', `${mission.title} completada (+${mission.xpReward + xpPolicy.missionClaimBonus} XP).`);
    track('EVT_mission_claimed', `Misión reclamada: ${mission.title}`);
    pushHistory({ label: `Misión ${mission.title} reclamada`, type: 'reward' });
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
      const total = Number(params.get('total'));
      const usedCoinDiscount = params.get('coinDiscount') === '1';
      const amountPaid = Number.isFinite(total) && total > 0 ? total : selectedProduct.fiatPrice;
      onPurchaseSuccess(productName, amountPaid, usedCoinDiscount);
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
    onboardingStep,
    onboardingDone,
    streamIndex,
    activeStream,
    liveState,
    sheet,
    attendanceCount,
    spend,
    belakoCoins,
    currentStreamFullyWatched,
    fullLiveRewardUnlocked,
    fullLiveRewardClaimed,
    selectedProduct,
    claimedTierIds,
    statusText,
    checkoutForm,
    checkoutError,
    checkoutProcessing,
    checkoutUseCoinDiscount,
    checkoutMode,
    canUseCoinDiscount,
    coinPolicy,
    events,
    notifications,
    rewardHistory,
    seasonPass,
    seasonTiers,
    seasonMissions,
    tiers,
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
    setOnboardingDone,
    setSheet,
    setSelectedPaymentMethodId,
    setSaveForFuture,
    setCardSetupError,
    completeOnboarding,
    watchMinute,
    watchFullLive,
    claimFullLiveReward,
    openCheckout,
    updateCheckoutField,
    toggleCoinDiscount,
    payWithFiat,
    claimTierReward,
    nextStream,
    toggleReconnectState,
    endStream,
    clearNotifications,
    claimSeasonPassTier,
    claimSeasonMission,
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
    logoutSession,
    track
  };
}

export function onboardingCopy(step: number): string {
  if (step === 0) {
    return 'Elige estilos y sigue a Belako para personalizar tu feed.';
  }
  if (step === 1) {
    return 'Completa hitos para ganar Belako Coin y canjear descuentos.';
  }
  return 'Mira 1 minuto de directo para ganar tu primer Belako Coin.';
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
