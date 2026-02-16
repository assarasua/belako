import { useEffect, useMemo, useRef, useState } from 'react';
import { officialBelakoNftAssets, products, streams, nowLabel } from '../lib/mock-data';
import type {
  EventItem,
  FanTab,
  LiveState,
  NftAsset,
  NotificationItem,
  OwnedNft,
  Product,
  RewardHistoryItem,
  SheetState,
  Tier
} from '../lib/types';
import { createStripeCheckoutSession } from '../services/api-client';

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
  const [bidValue, setBidValue] = useState(20);
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0]);
  const [claimedTierIds, setClaimedTierIds] = useState<number[]>([]);
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
  const [ownedNfts, setOwnedNfts] = useState<OwnedNft[]>([]);
  const [nftImageLoadErrors, setNftImageLoadErrors] = useState<Record<string, boolean>>({});
  const [latestMintedNftId, setLatestMintedNftId] = useState<string | null>(null);

  const activeStream = streams[streamIndex];
  const nftAssets: NftAsset[] = officialBelakoNftAssets;

  const coinPolicy = {
    watchReward: 5,
    purchaseReward: 20,
    claimReward: 30,
    discountCost: 50,
    discountValueEur: 5,
    dailyWatchCoinCap: 50
  };

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

  function getTierRarity(tierId: Tier['id']): NftAsset['rarity'] {
    if (tierId === 1) {
      return 'fan';
    }
    if (tierId === 2) {
      return 'premium';
    }
    return 'legendary';
  }

  function markNftImageError(assetId: string) {
    setNftImageLoadErrors((prev) => ({ ...prev, [assetId]: true }));
  }

  const tiers: Tier[] = useMemo(() => {
    return [
      {
        id: 1,
        title: 'Nivel 1 - NFT Belako',
        requirement: '3 directos',
        unlocked: attendanceCount >= 3,
        progress: `${Math.min(attendanceCount, 3)}/3 directos`,
        reward: 'NFT exclusivo de Belako (edicion fan)'
      },
      {
        id: 2,
        title: 'Nivel 2 - NFT Belako firmado',
        requirement: '10 directos + 50 EUR de gasto',
        unlocked: attendanceCount >= 10 && spend >= 50,
        progress: `${Math.min(attendanceCount, 10)}/10 directos | €${spend}/€50`,
        reward: 'NFT premium de Belako con arte exclusivo'
      },
      {
        id: 3,
        title: 'Nivel 3 - Superfan Belako',
        requirement: '20 directos + 150 EUR de gasto',
        unlocked: attendanceCount >= 20 && spend >= 150,
        progress: `${Math.min(attendanceCount, 20)}/20 directos | €${spend}/€150`,
        reward: 'NFT legendario de Belako + perks superfan'
      }
    ];
  }, [attendanceCount, spend]);

  const conversion = useMemo(() => {
    const superfan = tiers[2].unlocked ? 1 : 0;
    const base = Math.round((attendanceCount / 30) * 100);
    return Math.min(80, base + superfan * 8);
  }, [attendanceCount, tiers]);

  const canUseCoinDiscount = belakoCoins >= coinPolicy.discountCost;

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
    setAttendanceCount((n) => n + 1);
    setBelakoCoins((n) => n + coinPolicy.watchReward);
    setStatusText(`Asistencia verificada. +${coinPolicy.watchReward} BEL.`);
    track('EVT_belako_coin_earned', 'Belako Coin ganado por ver directo');
    notify('Belako Coin', `Has ganado +${coinPolicy.watchReward} BEL por ver el directo.`);
    pushHistory({ label: `+${coinPolicy.watchReward} BEL por asistencia`, type: 'coin' });
  }

  function placeBid() {
    const nextBid = bidValue + 5;
    setBidValue(nextBid);
    setStatusText(`Puja realizada en €${nextBid}.`);
    track('EVT_bid_placed', `Puja subida a €${nextBid}`);
  }

  function openCheckout(product: Product, mode: CheckoutMode = 'fiat') {
    setSelectedProduct(product);
    setSheet('checkout');
    setCheckoutMode(mode);
    setCheckoutError('');
    setCheckoutUseCoinDiscount(mode === 'fiat' ? false : false);
    track('EVT_merch_checkout_started', `${mode === 'coin' ? 'Canje' : 'Checkout'} abierto para ${product.name}`);
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
      if (belakoCoins < selectedProduct.belakoCoinCost) {
        setCheckoutError(`Saldo BEL insuficiente. Necesitas ${selectedProduct.belakoCoinCost} BEL.`);
        setCheckoutProcessing(false);
        return;
      }

      setBelakoCoins((n) => n - selectedProduct.belakoCoinCost);
      setSheet('none');
      setCheckoutProcessing(false);
      setCheckoutUseCoinDiscount(false);
      setStatusText(`Canje confirmado: ${selectedProduct.name}.`);
      track('EVT_reward_redeemed', `Canje en BEL completado para ${selectedProduct.name}`);
      notify('Canje completado', `${selectedProduct.name} añadido a tus pedidos.`);
      pushHistory({ label: `Canje ${selectedProduct.name} (${selectedProduct.belakoCoinCost} BEL)`, type: 'reward' });
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

  function claimTierReward(tier: Tier) {
    if (!tier.unlocked) {
      setStatusText('Nivel todavia no desbloqueado.');
      return;
    }
    if (claimedTierIds.includes(tier.id)) {
      setStatusText('Recompensa ya canjeada.');
      return;
    }

    setClaimedTierIds((prev) => [...prev, tier.id]);
    setBelakoCoins((n) => n + coinPolicy.claimReward);

    const targetRarity = getTierRarity(tier.id);
    const selectedAsset = nftAssets.find((asset) => asset.rarity === targetRarity) ?? nftAssets[0];
    const mintedId = `owned-${Date.now()}-${Math.random()}`;

    setOwnedNfts((prev) => [
      {
        id: mintedId,
        assetId: selectedAsset.id,
        mintedAt: nowLabel(),
        originTier: tier.id
      },
      ...prev
    ]);
    setLatestMintedNftId(mintedId);

    setSheet('reward');
    setStatusText(`NFT de Belako minteado por ${tier.title}. +${coinPolicy.claimReward} BEL.`);
    track('EVT_reward_claimed', `NFT minteado al reclamar ${tier.title}`);
    notify('NFT desbloqueado', 'NFT de Belako añadido a tu colección.');
    pushHistory({ label: `NFT reclamado: ${selectedAsset.name}`, type: 'nft' });
    pushHistory({ label: `Claim de ${tier.title}`, type: 'reward' });
    pushHistory({ label: `+${coinPolicy.claimReward} BEL por reclamar recompensa`, type: 'coin' });
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
    setStatusText('Directo finalizado. Desliza para el siguiente.');
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

      setSpend((n) => n + amountPaid);
      setBelakoCoins((n) => n + coinPolicy.purchaseReward - (usedCoinDiscount ? coinPolicy.discountCost : 0));
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
    bidValue,
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
    ownedNfts,
    nftAssets,
    nftImageLoadErrors,
    latestMintedNftId,
    tiers,
    conversion,
    setFanTab,
    setOnboardingDone,
    setSheet,
    markNftImageError,
    completeOnboarding,
    watchMinute,
    placeBid,
    openCheckout,
    updateCheckoutField,
    toggleCoinDiscount,
    payWithFiat,
    claimTierReward,
    nextStream,
    toggleReconnectState,
    endStream,
    clearNotifications,
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
