import { prisma } from '../lib/prisma.js';

export type StoreItem = {
  id: string;
  name: string;
  fiatPrice: number;
  imageUrl: string;
  limited: boolean;
  isActive: boolean;
};

export type ConcertItem = {
  id: string;
  title: string;
  venue: string;
  city: string;
  startsAt: string;
  priceEur: number;
  ticketUrl?: string;
  isActive: boolean;
};

export type LiveItem = {
  id: string;
  artist: string;
  title: string;
  startsAt: string;
  viewers: number;
  rewardHint: string;
  genre: string;
  colorClass: string;
  youtubeUrl?: string;
  isActive: boolean;
};

export type TierConfig = {
  id: 'fan' | 'super' | 'ultra' | 'god';
  title: string;
  requiredXp: number;
  perkLabel: string;
  sortOrder: number;
  active: boolean;
};

export type XpActionConfig = {
  code: 'join_live' | 'watch_full_live' | 'buy_merch' | 'buy_ticket';
  label: string;
  xpValue: number;
  enabled: boolean;
};

export type RewardConfigItem = {
  id: string;
  title: string;
  description: string;
  triggerType: 'watch_full_live' | 'xp_threshold' | 'purchase';
  xpBonus: number;
  active: boolean;
};

export type RewardsConfig = {
  tiers: TierConfig[];
  xpActions: XpActionConfig[];
  rewards: RewardConfigItem[];
};

type ContentStore = {
  storeItems: StoreItem[];
  concerts: ConcertItem[];
  lives: LiveItem[];
  rewardsConfig: RewardsConfig;
};

const fallbackRewardsConfig: RewardsConfig = {
  tiers: [
    {
      id: 'fan',
      title: 'Fan Belako',
      requiredXp: 0,
      perkLabel: 'Acceso base a recompensas fan',
      sortOrder: 1,
      active: true
    },
    {
      id: 'super',
      title: 'Super Fan Belako',
      requiredXp: 180,
      perkLabel: 'Insignia Super Fan + prioridad en drops',
      sortOrder: 2,
      active: true
    },
    {
      id: 'ultra',
      title: 'Ultra Fan Belako',
      requiredXp: 420,
      perkLabel: 'Acceso anticipado a experiencias exclusivas',
      sortOrder: 3,
      active: true
    },
    {
      id: 'god',
      title: 'God Fan Belako',
      requiredXp: 760,
      perkLabel: 'Estado máximo de la comunidad Belako',
      sortOrder: 4,
      active: true
    }
  ],
  xpActions: [
    { code: 'join_live', label: 'Unirte a directos en vivo', xpValue: 20, enabled: true },
    { code: 'watch_full_live', label: 'Ver directo entero', xpValue: 50, enabled: true },
    { code: 'buy_merch', label: 'Comprar merchandising', xpValue: 80, enabled: true },
    { code: 'buy_ticket', label: 'Comprar billetes para conciertos', xpValue: 120, enabled: true }
  ],
  rewards: [
    {
      id: 'rw-full-live',
      title: 'Recompensa directo completo',
      description: 'Completa un directo entero para reclamar bonus de fan.',
      triggerType: 'watch_full_live',
      xpBonus: 50,
      active: true
    }
  ]
};

function mapStoreItem(item: {
  id: string;
  name: string;
  fiatPrice: { toNumber: () => number };
  imageUrl: string;
  limited: boolean;
  isActive: boolean;
}): StoreItem {
  return {
    id: item.id,
    name: item.name,
    fiatPrice: item.fiatPrice.toNumber(),
    imageUrl: item.imageUrl,
    limited: item.limited,
    isActive: item.isActive
  };
}

function mapConcert(item: {
  id: string;
  title: string;
  venue: string;
  city: string;
  startsAt: Date;
  priceEur: { toNumber: () => number };
  ticketUrl: string | null;
  isActive: boolean;
}): ConcertItem {
  return {
    id: item.id,
    title: item.title,
    venue: item.venue,
    city: item.city,
    startsAt: item.startsAt.toISOString(),
    priceEur: item.priceEur.toNumber(),
    ticketUrl: item.ticketUrl || '',
    isActive: item.isActive
  };
}

function mapLive(item: {
  id: string;
  artist: string;
  title: string;
  startsAt: Date;
  viewers: number;
  rewardHint: string;
  genre: string;
  colorClass: string;
  youtubeUrl: string | null;
  isActive: boolean;
}): LiveItem {
  return {
    id: item.id,
    artist: item.artist,
    title: item.title,
    startsAt: item.startsAt.toISOString(),
    viewers: item.viewers,
    rewardHint: item.rewardHint,
    genre: item.genre,
    colorClass: item.colorClass,
    youtubeUrl: item.youtubeUrl || '',
    isActive: item.isActive
  };
}

async function loadRewardsConfig(): Promise<RewardsConfig> {
  const [tiers, actions, rewards] = await Promise.all([
    prisma.journeyTierConfig.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.xpActionConfig.findMany({ orderBy: { code: 'asc' } }),
    prisma.bandReward.findMany({ orderBy: { createdAt: 'desc' } })
  ]);

  if (tiers.length === 0 && actions.length === 0 && rewards.length === 0) {
    return fallbackRewardsConfig;
  }

  return {
    tiers: tiers.map((tier) => ({
      id: tier.code as TierConfig['id'],
      title: tier.title,
      requiredXp: tier.requiredXp,
      perkLabel: tier.perkLabel,
      sortOrder: tier.sortOrder,
      active: tier.active
    })),
    xpActions: actions.map((action) => ({
      code: action.code as XpActionConfig['code'],
      label: action.label,
      xpValue: action.xpValue,
      enabled: action.enabled
    })),
    rewards: rewards.map((reward) => ({
      id: reward.id,
      title: reward.title,
      description: reward.description,
      triggerType: reward.triggerType as RewardConfigItem['triggerType'],
      xpBonus: reward.xpBonus,
      active: reward.active
    }))
  };
}

export async function getPublicCatalog() {
  const [storeItems, concerts, lives, rewardsConfig] = await Promise.all([
    prisma.bandStoreItem.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }),
    prisma.bandConcert.findMany({ where: { isActive: true }, orderBy: { startsAt: 'asc' } }),
    prisma.bandLive.findMany({ where: { isActive: true }, orderBy: { startsAt: 'asc' } }),
    loadRewardsConfig()
  ]);

  return {
    storeItems: storeItems.map(mapStoreItem),
    concerts: concerts.map(mapConcert),
    lives: lives.map(mapLive),
    rewardsConfig: {
      tiers: rewardsConfig.tiers.filter((tier) => tier.active),
      xpActions: rewardsConfig.xpActions.filter((action) => action.enabled),
      rewards: rewardsConfig.rewards.filter((reward) => reward.active)
    }
  };
}

export async function getDashboardStore(): Promise<ContentStore> {
  const [storeItems, concerts, lives, rewardsConfig] = await Promise.all([
    prisma.bandStoreItem.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.bandConcert.findMany({ orderBy: { startsAt: 'asc' } }),
    prisma.bandLive.findMany({ orderBy: { startsAt: 'asc' } }),
    loadRewardsConfig()
  ]);

  return {
    storeItems: storeItems.map(mapStoreItem),
    concerts: concerts.map(mapConcert),
    lives: lives.map(mapLive),
    rewardsConfig
  };
}

export async function createStoreItem(input: Omit<StoreItem, 'id'>): Promise<StoreItem> {
  const created = await prisma.bandStoreItem.create({
    data: {
      name: input.name,
      fiatPrice: input.fiatPrice,
      imageUrl: input.imageUrl,
      limited: input.limited,
      isActive: input.isActive
    }
  });
  return mapStoreItem(created);
}

export async function updateStoreItem(id: string, input: Partial<Omit<StoreItem, 'id'>>): Promise<StoreItem | null> {
  const existing = await prisma.bandStoreItem.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const updated = await prisma.bandStoreItem.update({
    where: { id },
    data: {
      name: input.name,
      fiatPrice: input.fiatPrice,
      imageUrl: input.imageUrl,
      limited: input.limited,
      isActive: input.isActive
    }
  });
  return mapStoreItem(updated);
}

export async function deleteStoreItem(id: string): Promise<boolean> {
  const result = await prisma.bandStoreItem.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function createConcert(input: Omit<ConcertItem, 'id'>): Promise<ConcertItem> {
  const created = await prisma.bandConcert.create({
    data: {
      title: input.title,
      venue: input.venue,
      city: input.city,
      startsAt: new Date(input.startsAt),
      priceEur: input.priceEur,
      ticketUrl: input.ticketUrl || '',
      isActive: input.isActive
    }
  });
  return mapConcert(created);
}

export async function updateConcert(id: string, input: Partial<Omit<ConcertItem, 'id'>>): Promise<ConcertItem | null> {
  const existing = await prisma.bandConcert.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const updated = await prisma.bandConcert.update({
    where: { id },
    data: {
      title: input.title,
      venue: input.venue,
      city: input.city,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      priceEur: input.priceEur,
      ticketUrl: input.ticketUrl,
      isActive: input.isActive
    }
  });
  return mapConcert(updated);
}

export async function deleteConcert(id: string): Promise<boolean> {
  const result = await prisma.bandConcert.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function createLive(input: Omit<LiveItem, 'id'>): Promise<LiveItem> {
  const created = await prisma.bandLive.create({
    data: {
      artist: input.artist,
      title: input.title,
      startsAt: new Date(input.startsAt),
      viewers: input.viewers,
      rewardHint: input.rewardHint,
      genre: input.genre,
      colorClass: input.colorClass,
      youtubeUrl: input.youtubeUrl || '',
      isActive: input.isActive
    }
  });
  return mapLive(created);
}

export async function updateLive(id: string, input: Partial<Omit<LiveItem, 'id'>>): Promise<LiveItem | null> {
  const existing = await prisma.bandLive.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const updated = await prisma.bandLive.update({
    where: { id },
    data: {
      artist: input.artist,
      title: input.title,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      viewers: input.viewers,
      rewardHint: input.rewardHint,
      genre: input.genre,
      colorClass: input.colorClass,
      youtubeUrl: input.youtubeUrl,
      isActive: input.isActive
    }
  });
  return mapLive(updated);
}

export async function deleteLive(id: string): Promise<boolean> {
  const result = await prisma.bandLive.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function setTierConfig(tiers: TierConfig[]) {
  await prisma.$transaction(async (tx) => {
    await tx.journeyTierConfig.deleteMany({});
    if (tiers.length > 0) {
      await tx.journeyTierConfig.createMany({
        data: tiers.map((tier) => ({
          code: tier.id,
          title: tier.title,
          requiredXp: tier.requiredXp,
          perkLabel: tier.perkLabel,
          sortOrder: tier.sortOrder,
          active: tier.active
        }))
      });
    }
  });
}

export async function setXpActionConfig(xpActions: XpActionConfig[]) {
  await prisma.$transaction(async (tx) => {
    await tx.xpActionConfig.deleteMany({});
    if (xpActions.length > 0) {
      await tx.xpActionConfig.createMany({
        data: xpActions.map((action) => ({
          code: action.code,
          label: action.label,
          xpValue: action.xpValue,
          enabled: action.enabled
        }))
      });
    }
  });
}

export async function createReward(
  input: Omit<RewardConfigItem, 'id'>,
  createdByEmail: string
): Promise<RewardConfigItem> {
  const created = await prisma.bandReward.create({
    data: {
      title: input.title,
      description: input.description,
      triggerType: input.triggerType,
      xpBonus: input.xpBonus,
      active: input.active,
      createdByEmail
    }
  });
  return {
    id: created.id,
    title: created.title,
    description: created.description,
    triggerType: created.triggerType as RewardConfigItem['triggerType'],
    xpBonus: created.xpBonus,
    active: created.active
  };
}

export async function updateReward(
  id: string,
  input: Partial<Omit<RewardConfigItem, 'id'>>
): Promise<RewardConfigItem | null> {
  const existing = await prisma.bandReward.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }
  const updated = await prisma.bandReward.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      triggerType: input.triggerType,
      xpBonus: input.xpBonus,
      active: input.active
    }
  });
  return {
    id: updated.id,
    title: updated.title,
    description: updated.description,
    triggerType: updated.triggerType as RewardConfigItem['triggerType'],
    xpBonus: updated.xpBonus,
    active: updated.active
  };
}

export async function deleteReward(id: string): Promise<boolean> {
  const result = await prisma.bandReward.deleteMany({ where: { id } });
  return result.count > 0;
}
