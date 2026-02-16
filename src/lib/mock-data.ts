import type { ConcertTicket, Product, Stream } from './types';

const now = new Date();
const addDays = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

const setTime = (base: Date, hours: number, minutes: number) => {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const todayHours = now.getHours();
const todayMinutes = now.getMinutes();

export const streams: Stream[] = [
  {
    id: 's1',
    artist: 'Belako',
    title: 'Belako apertura en directo',
    startsAt: now.toISOString(),
    viewers: 1821,
    rewardHint: 'Ver directo entero -> desbloquea recompensa',
    genre: 'Post-punk',
    colorClass: 'stream-a'
  },
  {
    id: 's2',
    artist: 'Belako',
    title: 'Ensayo abierto acústico',
    startsAt: setTime(addDays(now, 7), 20, 30).toISOString(),
    viewers: 954,
    rewardHint: 'Mira completo para boost de fidelidad',
    genre: 'Indie rock',
    colorClass: 'stream-b'
  },
  {
    id: 's3',
    artist: 'Belako',
    title: 'Drop exclusivo de merch firmado',
    startsAt: setTime(addDays(now, 14), 21, 0).toISOString(),
    viewers: 2410,
    rewardHint: 'Nivel 1 se desbloquea con 3 asistencias',
    genre: 'Rock alternativo',
    colorClass: 'stream-c'
  },
  {
    id: 's4',
    artist: 'Belako',
    title: 'Session nocturna: post-punk set',
    startsAt: setTime(addDays(now, 21), 22, 15).toISOString(),
    viewers: 1660,
    rewardHint: 'Completa el directo para subir de nivel fan',
    genre: 'Post-punk',
    colorClass: 'stream-a'
  },
  {
    id: 's5',
    artist: 'Belako',
    title: 'Backstage stories + Q&A',
    startsAt: setTime(addDays(now, 28), 20, 0).toISOString(),
    viewers: 1130,
    rewardHint: 'Interactúa en chat para ganar presencia',
    genre: 'Alternative',
    colorClass: 'stream-b'
  },
  {
    id: 's6',
    artist: 'Belako',
    title: 'Belako en vivo: set completo',
    startsAt: setTime(addDays(now, 35), 21, 30).toISOString(),
    viewers: 2795,
    rewardHint: 'Directo largo para acelerar progreso',
    genre: 'Live set',
    colorClass: 'stream-c'
  },
  {
    id: 's7',
    artist: 'Belako',
    title: 'Pre-show de gira: warm-up',
    startsAt: setTime(addDays(now, 42), 19, 45).toISOString(),
    viewers: 1422,
    rewardHint: 'Asiste hoy y desbloquea hitos antes',
    genre: 'Indie rock',
    colorClass: 'stream-a'
  },
  {
    id: 's8',
    artist: 'Belako',
    title: 'Aftershow íntimo para superfans',
    startsAt: setTime(addDays(now, 49), todayHours, todayMinutes).toISOString(),
    viewers: 890,
    rewardHint: 'Más directos vistos -> más XP y tiers',
    genre: 'Acoustic',
    colorClass: 'stream-b'
  }
];

export const products: Product[] = [
  {
    id: 'csv-001',
    name: 'Belako LP Vinilo 12" Transparente Ed. limitada "Sigo regando"',
    fiatPrice: 26.95,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/belako-lp-vinilo-12-transparente-ed-limitada-sigo-regando-432285_1200x.jpg?v=1687479972',
    limited: false
  },
  {
    id: 'csv-002',
    name: 'Belako CD "Sigo regando"',
    fiatPrice: 12.95,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/belako-cd-sigo-regando-312426_1200x.jpg?v=1687479972',
    limited: false
  },
  {
    id: 'csv-003',
    name: 'Belako Camiseta "Sigo Regando" Negra',
    fiatPrice: 19.99,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/belako-camiseta-sigo-regando-negra-909582_1200x.jpg?v=1697158568',
    limited: false
  },
  {
    id: 'csv-004',
    name: 'Belako Camiseta "Sigo Regando" Blanca',
    fiatPrice: 19.99,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/belako-camiseta-sigo-regando-blanca-190247_1200x.jpg?v=1697158567',
    limited: false
  },
  {
    id: 'csv-005',
    name: 'Belako Camiseta "Europe 2022"',
    fiatPrice: 15.95,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/belako-camiseta-europe-2022-807549_1200x.jpg?v=1697158563',
    limited: false
  },
  {
    id: 'csv-006',
    name: 'Belako Camiseta "Europe 2022"',
    fiatPrice: 15.95,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/camiseta-european-tour-belako-396367_1200x.jpg?v=1668157220',
    limited: false
  },
  {
    id: 'csv-007',
    name: 'Belako Camiseta Edición Especial Fin de Gira',
    fiatPrice: 17,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/camiseta-edicion-especial-fin-de-gira-969633_600x.jpg?v=1649337593',
    limited: false
  },
  {
    id: 'csv-008',
    name: 'Belako Camiseta Fuego - Negra',
    fiatPrice: 14,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/camiseta-belako-negra-fuego-129088_600x.jpg?v=1649337593',
    limited: false
  },
  {
    id: 'csv-009',
    name: 'Belako Camiseta Fuego - Blanca',
    fiatPrice: 14,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/camiseta-belako-blanca-fuego-961502_600x.jpg?v=1649337593',
    limited: false
  },
  {
    id: 'csv-010',
    name: 'Belako Sudadera Capucha Fuego - Negra',
    fiatPrice: 34.95,
    imageUrl: 'https://www.d2fy.es/cdn/shop/products/sudadera-capucha-belako-negra-fuego-327412_600x.jpg?v=1649337898',
    limited: false
  }
];

export const concertTickets: ConcertTicket[] = [
  {
    id: 't1',
    title: 'Belako Live · Sala Santana',
    venue: 'Sala Santana 27',
    city: 'Bilbao',
    startsAt: setTime(addDays(now, 5), 21, 0).toISOString(),
    priceEur: 24.5
  },
  {
    id: 't2',
    title: 'Belako Live · Dabadaba',
    venue: 'Dabadaba',
    city: 'Donostia',
    startsAt: setTime(addDays(now, 12), 20, 30).toISOString(),
    priceEur: 22
  },
  {
    id: 't3',
    title: 'Belako Live · Zentral',
    venue: 'Zentral',
    city: 'Pamplona',
    startsAt: setTime(addDays(now, 19), 21, 15).toISOString(),
    priceEur: 23
  },
  {
    id: 't4',
    title: 'Belako Live · Razzmatazz',
    venue: 'Razzmatazz',
    city: 'Barcelona',
    startsAt: setTime(addDays(now, 26), 21, 0).toISOString(),
    priceEur: 28
  }
];

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
