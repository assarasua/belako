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
    title: 'Ensayo abierto + pujas de shoutout',
    viewers: 954,
    rewardHint: 'Subasta de shoutout cada 3 min',
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
