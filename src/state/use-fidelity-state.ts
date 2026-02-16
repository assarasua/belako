import { useEffect, useMemo, useRef, useState } from 'react';
import { officialBelakoNftAssets, products, streams, nowLabel } from '../lib/mock-data';
import type {
  EventItem,
  FanTab,
  LiveState,
  MeetGreetPass,
  NftAsset,
  NftCollectibleDto,
  NftGrant,
  NotificationItem,
  OwnedNft,
  Product,
  RewardHistoryItem,
  SheetState,
  Tier
} from '../lib/types';
import {
  claimNftGrant,
  createMeetGreetQrToken,
  createNftGrant,
  createStripeCheckoutSession,
  fetchMeetGreetPass,
  fetchNftAssets,
  fetchNftCollection,
  fetchNftGrants,
  verifyAttendanceAndGrant
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
  const [nftAssets, setNftAssets] = useState<NftAsset[]>(officialBelakoNftAssets);
  const [nftGrants, setNftGrants] = useState<NftGrant[]>([]);
  const [nftCollection, setNftCollection] = useState<NftCollectibleDto[]>([]);
  const [nftClaimLoadingById, setNftClaimLoadingById] = useState<Record<string, boolean>>({});
  const [nftClaimErrorById, setNftClaimErrorById] = useState<Record<string, string>>({});
  const [nftSyncing, setNftSyncing] = useState(false);
  const [nftImageLoadErrors, setNftImageLoadErrors] = useState<Record<string, boolean>>({});
  const [latestMintedNftId, setLatestMintedNftId] = useState<string | null>(null);
  const [meetGreetPass, setMeetGreetPass] = useState<MeetGreetPass>({
    status: 'LOCKED',
    canGenerateQr: false
  });
  const [meetGreetQrToken, setMeetGreetQrToken] = useState('');
  const [meetGreetQrExpiresAt, setMeetGreetQrExpiresAt] = useState('');
  const [meetGreetQrLoading, setMeetGreetQrLoading] = useState(false);

  const activeStream = streams[streamIndex];

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

  useEffect(() => {
    if (!meetGreetQrExpiresAt) {
      return;
    }
    const expiresAtMs = new Date(meetGreetQrExpiresAt).getTime();
    const delay = expiresAtMs - Date.now();
    if (delay <= 0) {
      setMeetGreetQrToken('');
      setMeetGreetQrExpiresAt('');
      return;
    }
    const timer = setTimeout(() => {
      setMeetGreetQrToken('');
      setMeetGreetQrExpiresAt('');
    }, delay);
    return () => clearTimeout(timer);
  }, [meetGreetQrExpiresAt]);

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

  function pickAssetByRarity(rarity: NftAsset['rarity']): NftAsset {
    return nftAssets.find((asset) => asset.rarity === rarity) ?? nftAssets[0];
  }

  function pickAssetForTier(tierId: Tier['id']): NftAsset {
    if (tierId === 3) {
      return (
        nftAssets.find((asset) => asset.id === 'nft-superfan-mg-pass' || asset.name.includes('Meet & Greet Pass')) ??
        pickAssetByRarity('legendary')
      );
    }
    return pickAssetByRarity(getTierRarity(tierId));
  }

  function markNftImageError(assetId: string) {
    setNftImageLoadErrors((prev) => ({ ...prev, [assetId]: true }));
  }

  async function syncNftData() {
    setNftSyncing(true);
    const [assetsResult, grantsResult, collectionResult, passResult] = await Promise.all([
      fetchNftAssets(),
      fetchNftGrants(),
      fetchNftCollection(),
      fetchMeetGreetPass()
    ]);

    if (assetsResult.ok && assetsResult.data?.assets) {
      setNftAssets(assetsResult.data.assets);
    }
    if (grantsResult.ok && grantsResult.data?.grants) {
      setNftGrants(grantsResult.data.grants);
    }
    if (collectionResult.ok && collectionResult.data?.collection) {
      setNftCollection(collectionResult.data.collection);
    }
    if (passResult.ok && passResult.data) {
      setMeetGreetPass(passResult.data);
    }
    setNftSyncing(false);
  }

  useEffect(() => {
    void syncNftData();
  }, []);

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
        reward: 'NFT Pass Superfan Meet & Greet'
      }
    ];
  }, [attendanceCount, spend]);

  const conversion = useMemo(() => {
    const superfan = tiers[2].unlocked ? 1 : 0;
    const base = Math.round((attendanceCount / 30) * 100);
    return Math.min(80, base + superfan * 8);
  }, [attendanceCount, tiers]);

  const canUseCoinDiscount = belakoCoins >= coinPolicy.discountCost;
  const currentStreamFullyWatched = fullyWatchedStreamIds.includes(activeStream.id);
  const fullLiveRewardUnlocked = fullyWatchedStreamIds.length > 0;
  const ownedNfts: OwnedNft[] = useMemo(() => {
    return nftCollection.map((item) => ({
      id: item.id,
      assetId: item.assetId,
      mintedAt: new Date(item.mintedAt).toLocaleString(),
      originTier: item.assetId.includes('legendary') ? 3 : item.assetId.includes('premium') ? 2 : 1
    }));
  }, [nftCollection]);

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

  async function watchFullLive() {
    if (currentStreamFullyWatched) {
      setStatusText('Ya has completado este directo.');
      return;
    }
    setFullyWatchedStreamIds((prev) => [...prev, activeStream.id]);
    setAttendanceCount((n) => n + 1);
    setStatusText('Directo completo visto. Recompensa especial desbloqueada.');
    track('EVT_stream_full_watch', `Directo completo visto: ${activeStream.id}`);
    const fullWatchAsset = pickAssetByRarity('fan');
    const attendanceResult = await verifyAttendanceAndGrant({
      streamId: activeStream.id,
      rewardAssetId: fullWatchAsset.id
    });
    if (attendanceResult.ok && attendanceResult.data?.grant) {
      const grant = attendanceResult.data.grant;
      setNftGrants((prev) => [grant, ...prev.filter((item) => item.id !== grant.id)]);
      notify('Recompensa desbloqueada', 'NFT pendiente disponible por ver el directo entero.');
    } else {
      notify('Recompensa desbloqueada', 'Ya puedes reclamar la recompensa por ver directo entero.');
    }
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

  async function claimTierReward(tier: Tier) {
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

    const selectedAsset = pickAssetForTier(tier.id);
    const grantResult = await createNftGrant({
      assetId: selectedAsset.id,
      originType: 'TIER',
      originRef: `tier-${tier.id}`
    });

    if (grantResult.ok && grantResult.data?.grant) {
      const grant = grantResult.data.grant;
      setNftGrants((prev) => [grant, ...prev.filter((item) => item.id !== grant.id)]);
      setStatusText(`Grant NFT creado para ${tier.title}. Reclámalo para mintear en Polygon.`);
      notify('NFT disponible', `Grant creado: ${selectedAsset.name}. Reclámalo desde Recompensas.`);
      track('EVT_reward_claimed', `Grant NFT creado al reclamar ${tier.title}`);
      pushHistory({ label: `Grant NFT creado: ${selectedAsset.name}`, type: 'nft' });
    } else {
      setStatusText('No se pudo crear el grant NFT. Intenta de nuevo.');
      notify('Error NFT', grantResult.error || 'No se pudo crear el grant.');
    }

    pushHistory({ label: `Claim de ${tier.title}`, type: 'reward' });
    pushHistory({ label: `+${coinPolicy.claimReward} BEL por reclamar recompensa`, type: 'coin' });
  }

  async function claimPendingNftGrant(grantId: string) {
    setNftClaimLoadingById((prev) => ({ ...prev, [grantId]: true }));
    setNftClaimErrorById((prev) => ({ ...prev, [grantId]: '' }));

    const result = await claimNftGrant(grantId);
    setNftClaimLoadingById((prev) => ({ ...prev, [grantId]: false }));

    if (!result.ok || !result.data?.grant) {
      const errorMessage = result.error || 'No se pudo reclamar el NFT.';
      setNftClaimErrorById((prev) => ({ ...prev, [grantId]: errorMessage }));
      setStatusText(errorMessage);
      return;
    }

    const updatedGrant = result.data.grant;
    setNftGrants((prev) => [updatedGrant, ...prev.filter((item) => item.id !== updatedGrant.id)]);

    if (result.data.collectible) {
      const collectible = result.data.collectible;
      const mintedAsset = nftAssets.find((asset) => asset.id === collectible.assetId);
      const isSuperfanPass = mintedAsset?.id === 'nft-superfan-mg-pass';
      setNftCollection((prev) => [collectible, ...prev.filter((item) => item.id !== collectible.id)]);
      const passResult = await fetchMeetGreetPass();
      if (passResult.ok && passResult.data) {
        setMeetGreetPass(passResult.data);
      }
      setLatestMintedNftId(collectible.id);
      setSheet('reward');
      setStatusText(
        isSuperfanPass
          ? 'NFT Pass Superfan minteado. Ya puedes usar Meet & Greet.'
          : 'NFT minteado en Polygon y añadido a tu colección.'
      );
      notify(
        isSuperfanPass ? 'NFT Pass Superfan minteado' : 'NFT minteado',
        isSuperfanPass
          ? 'Tu pase de acceso Meet & Greet ya está activo.'
          : `Tx ${collectible.txHash.slice(0, 12)}... confirmado.`
      );
      pushHistory({
        label: isSuperfanPass ? 'NFT Pass Superfan minteado' : `NFT minteado (${collectible.tokenId})`,
        type: 'nft'
      });
    } else {
      setStatusText('Grant actualizado.');
    }
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

  async function refreshMeetGreetPass() {
    const passResult = await fetchMeetGreetPass();
    if (passResult.ok && passResult.data) {
      setMeetGreetPass(passResult.data);
    }
  }

  async function generateMeetGreetQr() {
    setMeetGreetQrLoading(true);
    const result = await createMeetGreetQrToken();
    setMeetGreetQrLoading(false);

    if (!result.ok || !result.data) {
      setStatusText(result.error || 'No se pudo generar el QR.');
      notify('Error QR', result.error || 'No se pudo generar el QR de acceso.');
      return;
    }

    setMeetGreetQrToken(result.data.qrToken);
    setMeetGreetQrExpiresAt(result.data.expiresAt);
    notify('Pase QR generado', 'Presenta este QR en la entrada del meet & greet.');
    track('EVT_meet_greet_qr_generated', 'QR de acceso meet & greet generado');
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
    nftSyncing,
    nftGrants,
    nftCollection,
    nftClaimLoadingById,
    nftClaimErrorById,
    ownedNfts,
    nftAssets,
    nftImageLoadErrors,
    latestMintedNftId,
    meetGreetPass,
    meetGreetQrToken,
    meetGreetQrExpiresAt,
    meetGreetQrLoading,
    tiers,
    conversion,
    setFanTab,
    setOnboardingDone,
    setSheet,
    markNftImageError,
    completeOnboarding,
    watchMinute,
    watchFullLive,
    claimFullLiveReward,
    claimPendingNftGrant,
    openCheckout,
    updateCheckoutField,
    toggleCoinDiscount,
    payWithFiat,
    claimTierReward,
    nextStream,
    toggleReconnectState,
    endStream,
    clearNotifications,
    syncNftData,
    refreshMeetGreetPass,
    generateMeetGreetQr,
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
