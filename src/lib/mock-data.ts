import type { NftAsset, Product, Stream } from './types';

export const streams: Stream[] = [
  {
    id: 's1',
    artist: 'Belako',
    title: 'Belako Gaua en directo',
    viewers: 1821,
    rewardHint: 'Mira 1 min -> gana token Belako',
    genre: 'Post-punk',
    colorClass: 'stream-a'
  },
  {
    id: 's2',
    artist: 'Belako',
    title: 'Ensayo abierto acústico',
    viewers: 954,
    rewardHint: 'Mira completo para boost de fidelidad',
    genre: 'Indie rock',
    colorClass: 'stream-b'
  },
  {
    id: 's3',
    artist: 'Belako',
    title: 'Drop exclusivo de merch firmado',
    viewers: 2410,
    rewardHint: 'Nivel 1 se desbloquea con 3 asistencias',
    genre: 'Rock alternativo',
    colorClass: 'stream-c'
  },
  {
    id: 's4',
    artist: 'Belako',
    title: 'Session nocturna: post-punk set',
    viewers: 1660,
    rewardHint: 'Completa 1 minuto y suma +5 BEL',
    genre: 'Post-punk',
    colorClass: 'stream-a'
  },
  {
    id: 's5',
    artist: 'Belako',
    title: 'Backstage stories + Q&A',
    viewers: 1130,
    rewardHint: 'Interactúa en chat para ganar presencia',
    genre: 'Alternative',
    colorClass: 'stream-b'
  },
  {
    id: 's6',
    artist: 'Belako',
    title: 'Belako en vivo: set completo',
    viewers: 2795,
    rewardHint: 'Directo largo para acelerar progreso',
    genre: 'Live set',
    colorClass: 'stream-c'
  },
  {
    id: 's7',
    artist: 'Belako',
    title: 'Pre-show de gira: warm-up',
    viewers: 1422,
    rewardHint: 'Asiste hoy y desbloquea hitos antes',
    genre: 'Indie rock',
    colorClass: 'stream-a'
  },
  {
    id: 's8',
    artist: 'Belako',
    title: 'Aftershow íntimo para superfans',
    viewers: 890,
    rewardHint: 'Más directos vistos -> más BEL y tiers',
    genre: 'Acoustic',
    colorClass: 'stream-b'
  }
];

export const products: Product[] = [
  { id: 'p1', name: 'Púa firmada Belako', fiatPrice: 25, belakoCoinCost: 120, limited: true },
  { id: 'p2', name: 'Camiseta Gira Belako', fiatPrice: 45, belakoCoinCost: 240, limited: true },
  { id: 'p3', name: 'Fanzine backstage Belako', fiatPrice: 18, belakoCoinCost: 90, limited: false }
];

export const officialBelakoNftAssets: NftAsset[] = [
  {
    id: 'nft-fan-01',
    name: 'Belako Banda - Fan Edition',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_Banda.jpg?v=1753809570',
    rarity: 'fan',
    source: 'official-web'
  },
  {
    id: 'nft-premium-01',
    name: 'Belako Grupo - Premium Shot',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_grupo.jpg?v=1753809570',
    rarity: 'premium',
    source: 'official-web'
  },
  {
    id: 'nft-legendary-01',
    name: 'Belako Press Band - Legendary',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_PRESS_Band_1.jpg?v=1753809570',
    rarity: 'legendary',
    source: 'official-web'
  },
  {
    id: 'nft-fan-02',
    name: 'Belako Press Band - Fan Alt',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_PRESS_Band_1.jpg?v=1753809570',
    rarity: 'fan',
    source: 'official-web'
  }
];

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
