import { useMemo, useState } from 'react';
import { officialBelakoNftAssets, products, streams, nowLabel } from '../lib/mock-data';
import type {
  ArtistTab,
  EventItem,
  FanTab,
  LiveState,
  NftAsset,
  NotificationItem,
  OwnedNft,
  Product,
  RewardHistoryItem,
  Role,
  SheetState,
  Tier
} from '../lib/types';
import { fakeApi } from '../services/api-client';

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
  const [role, setRole] = useState<Role>('fan');
  const [fanTab, setFanTab] = useState<FanTab>('home');
  const [artistTab, setArtistTab] = useState<ArtistTab>('dashboard');

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

  const [artistOnboardingDone, setArtistOnboardingDone] = useState(false);
  const [artistSocialConnected, setArtistSocialConnected] = useState(false);
  const [artistStreamTitle, setArtistStreamTitle] = useState('Belako Night #1');
  const [artistPinnedItem, setArtistPinnedItem] = useState('Pua firmada Belako');
  const [artistLive, setArtistLive] = useState(false);
  const [artistModerationOpen, setArtistModerationOpen] = useState(false);

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

  async function switchRole(nextRole: Role) {
    setRole(nextRole);
    track('EVT_role_switched', `Rol cambiado a ${nextRole}`);
    setStatusText('');
    setSheet('none');
    await fakeApi({ ok: true });
  }

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

  function openCheckout(product: Product) {
    setSelectedProduct(product);
    setSheet('checkout');
    setCheckoutError('');
    setCheckoutUseCoinDiscount(false);
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

    if (checkoutUseCoinDiscount && !canUseCoinDiscount) {
      setCheckoutError('Saldo BEL insuficiente para aplicar descuento.');
      return;
    }

    setCheckoutProcessing(true);
    setCheckoutError('');

    const response = await fakeApi({ ok: true }, 650);

    if (!response.ok) {
      setCheckoutProcessing(false);
      setCheckoutError('Error de pago. Intenta de nuevo.');
      notify('Error de pago', 'No se pudo completar tu compra.');
      return;
    }

    const discount = checkoutUseCoinDiscount ? coinPolicy.discountValueEur : 0;
    const finalPaid = Math.max(0, selectedProduct.fiatPrice - discount);

    setSpend((n) => n + finalPaid);
    setBelakoCoins((n) => n + coinPolicy.purchaseReward - (checkoutUseCoinDiscount ? coinPolicy.discountCost : 0));
    setSheet('none');
    setCheckoutProcessing(false);
    setCheckoutUseCoinDiscount(false);

    setStatusText(`Pedido confirmado: ${selectedProduct.name}. +${coinPolicy.purchaseReward} BEL.`);
    track('EVT_merch_purchase_success', `Compra en EUR completada para ${selectedProduct.name}`);
    notify('Compra completada', `${selectedProduct.name} confirmado. Revisa tu email para seguimiento.`);
    pushHistory({ label: `Compra ${selectedProduct.name} (€${finalPaid.toFixed(2)})`, type: 'purchase' });
    pushHistory({ label: `+${coinPolicy.purchaseReward} BEL por compra`, type: 'coin' });
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
    setNotifications([]);
  }

  function startArtistOnboarding() {
    setArtistSocialConnected(true);
    setStatusText('TikTok e Instagram conectados (mock).');
    track('EVT_artist_social_connected', 'Equipo conectó redes sociales');
  }

  function completeArtistOnboarding() {
    setArtistOnboardingDone(true);
    setStatusText('Onboarding del equipo completado. Ya puedes emitir.');
    track('EVT_artist_onboarding_complete', 'Setup del equipo completado');
  }

  function toggleArtistLive() {
    const next = !artistLive;
    setArtistLive(next);
    if (next) {
      track('EVT_artist_stream_started', `Belako inició directo ${artistStreamTitle}`);
      setStatusText('Directo iniciado. Pin de producto y moderacion disponibles.');
      return;
    }
    track('EVT_artist_stream_stopped', 'Belako finalizó directo');
    setStatusText('Directo finalizado. Metricas actualizadas.');
  }

  return {
    role,
    fanTab,
    artistTab,
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
    canUseCoinDiscount,
    coinPolicy,
    artistOnboardingDone,
    artistSocialConnected,
    artistStreamTitle,
    artistPinnedItem,
    artistLive,
    artistModerationOpen,
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
    setArtistTab,
    setOnboardingDone,
    setSheet,
    setArtistModerationOpen,
    setArtistStreamTitle,
    setArtistPinnedItem,
    markNftImageError,
    switchRole,
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
    startArtistOnboarding,
    completeArtistOnboarding,
    toggleArtistLive,
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
