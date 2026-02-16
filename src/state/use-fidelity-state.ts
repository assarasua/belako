import { useEffect, useMemo, useRef, useState } from 'react';
import { products, streams, nowLabel } from '../lib/mock-data';
import type {
  EventItem,
  FanTab,
  GamificationState,
  LiveState,
  NotificationItem,
  Product,
  RewardHistoryItem,
  SeasonMission,
  SeasonPassTier,
  SheetState,
  Tier
} from '../lib/types';
import {
  createStripeCheckoutSession,
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

export function useFidelityState() {
  const [fanTab, setFanTab] = useState<FanTab>('home');

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDone, setOnboardingDone] = useState(false);

  const [streamIndex, setStreamIndex] = useState(0);
  const [liveState, setLiveState] = useState<LiveState>('live');
  const [sheet, setSheet] = useState<SheetState>('none');

  const [attendanceCount, setAttendanceCount] = useState(1);
  const [spend, setSpend] = useState(20);
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

  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>([]);
  const [seasonXp, setSeasonXp] = useState(35);
  const [lastActivityDay, setLastActivityDay] = useState(new Date().toISOString());
  const [streakDays, setStreakDays] = useState(1);
  const [watchMinuteCount, setWatchMinuteCount] = useState(0);
  const [fullWatchCount, setFullWatchCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
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

  function pushHistory(item: Omit<RewardHistoryItem, 'id' | 'at'>) {
    setRewardHistory((prev) => [{ id: `h-${Date.now()}-${Math.random()}`, at: nowLabel(), ...item }, ...prev].slice(0, 20));
  }

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
      },
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

  async function watchFullLive() {
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

  function openCheckout(product: Product, mode: CheckoutMode = 'fiat') {
    const normalizedMode: CheckoutMode = product.purchaseType === 'eur_only' ? 'fiat' : mode;
    setSelectedProduct(product);
    setSheet('checkout');
    setCheckoutMode(normalizedMode);
    setCheckoutError('');
    setCheckoutUseCoinDiscount(false);
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
      useCoinDiscount: checkoutUseCoinDiscount
    });

    if (!response.ok || !response.data?.url) {
      setCheckoutProcessing(false);
      setCheckoutError(response.error || 'Error de pago. Intenta de nuevo.');
      notify('Error de pago', 'No se pudo completar tu compra.');
      return;
    }

    window.location.assign(response.data.url);
  }

  async function claimTierReward(tier: Tier) {
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

  function clearNotifications() {
    Object.values(notificationTimeouts.current).forEach((timer) => clearTimeout(timer));
    notificationTimeouts.current = {};
    setNotifications([]);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');

    if (checkoutState === 'success') {
      const productName = params.get('productName') || 'Merch Belako';
      const total = Number(params.get('total'));
      const usedCoinDiscount = params.get('coinDiscount') === '1';
      const amountPaid = Number.isFinite(total) && total > 0 ? total : selectedProduct.fiatPrice;

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
  }, [coinPolicy.discountCost, coinPolicy.purchaseReward, selectedProduct.fiatPrice]);

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
    setFanTab,
    setOnboardingDone,
    setSheet,
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
