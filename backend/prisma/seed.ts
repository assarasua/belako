import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function addDays(days: number, hours: number, minutes: number) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

async function main() {
  await prisma.$transaction([
    prisma.bandStoreItem.deleteMany({}),
    prisma.bandConcert.deleteMany({}),
    prisma.bandLive.deleteMany({}),
    prisma.journeyTierConfig.deleteMany({}),
    prisma.xpActionConfig.deleteMany({}),
    prisma.bandReward.deleteMany({})
  ]);

  await prisma.bandStoreItem.createMany({
    data: [
      {
        name: 'Belako LP Vinilo 12" Transparente Ed. limitada "Sigo regando"',
        fiatPrice: 26.95,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/belako-lp-vinilo-12-transparente-ed-limitada-sigo-regando-432285_1200x.jpg?v=1687479972',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako CD "Sigo regando"',
        fiatPrice: 12.95,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/belako-cd-sigo-regando-312426_1200x.jpg?v=1687479972',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta "Sigo Regando" Negra',
        fiatPrice: 19.99,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/belako-camiseta-sigo-regando-negra-909582_1200x.jpg?v=1697158568',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta "Sigo Regando" Blanca',
        fiatPrice: 19.99,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/belako-camiseta-sigo-regando-blanca-190247_1200x.jpg?v=1697158567',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta "Europe 2022"',
        fiatPrice: 15.95,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/belako-camiseta-europe-2022-807549_1200x.jpg?v=1697158563',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta "Europe 2022"',
        fiatPrice: 15.95,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/camiseta-european-tour-belako-396367_1200x.jpg?v=1668157220',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta Edición Especial Fin de Gira',
        fiatPrice: 17,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/camiseta-edicion-especial-fin-de-gira-969633_600x.jpg?v=1649337593',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta Fuego - Negra',
        fiatPrice: 14,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/camiseta-belako-negra-fuego-129088_600x.jpg?v=1649337593',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Camiseta Fuego - Blanca',
        fiatPrice: 14,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/camiseta-belako-blanca-fuego-961502_600x.jpg?v=1649337593',
        limited: false,
        isActive: true
      },
      {
        name: 'Belako Sudadera Capucha Fuego - Negra',
        fiatPrice: 34.95,
        imageUrl:
          'https://www.d2fy.es/cdn/shop/products/sudadera-capucha-belako-negra-fuego-327412_600x.jpg?v=1649337898',
        limited: false,
        isActive: true
      }
    ]
  });

  await prisma.bandConcert.createMany({
    data: [
      {
        title: 'Belako Live · Sala Santana',
        venue: 'Sala Santana 27',
        city: 'Bilbao',
        startsAt: addDays(5, 21, 0),
        priceEur: 24.5,
        ticketUrl: '',
        isActive: true
      },
      {
        title: 'Belako Live · Dabadaba',
        venue: 'Dabadaba',
        city: 'Donostia',
        startsAt: addDays(12, 20, 30),
        priceEur: 22,
        ticketUrl: '',
        isActive: true
      },
      {
        title: 'Belako Live · Zentral',
        venue: 'Zentral',
        city: 'Pamplona',
        startsAt: addDays(19, 21, 15),
        priceEur: 23,
        ticketUrl: '',
        isActive: true
      },
      {
        title: 'Belako Live · Razzmatazz',
        venue: 'Razzmatazz',
        city: 'Barcelona',
        startsAt: addDays(26, 21, 0),
        priceEur: 28,
        ticketUrl: '',
        isActive: true
      }
    ]
  });

  await prisma.bandLive.createMany({
    data: [
      {
        artist: 'Belako',
        title: 'Belako apertura en directo',
        startsAt: new Date(),
        viewers: 1821,
        rewardHint: 'Ver directo entero -> desbloquea recompensa',
        genre: 'Post-punk',
        colorClass: 'stream-a',
        youtubeUrl: 'https://www.youtube.com/watch?v=l7TlAz1HvSk&t=650s',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Ensayo abierto acústico',
        startsAt: addDays(7, 20, 30),
        viewers: 954,
        rewardHint: 'Mira completo para boost de fidelidad',
        genre: 'Indie rock',
        colorClass: 'stream-b',
        youtubeUrl: '',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Drop exclusivo de merch firmado',
        startsAt: addDays(14, 21, 0),
        viewers: 2410,
        rewardHint: 'Nivel 1 se desbloquea con 3 asistencias',
        genre: 'Rock alternativo',
        colorClass: 'stream-c',
        youtubeUrl: '',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Session nocturna: post-punk set',
        startsAt: addDays(21, 22, 15),
        viewers: 1660,
        rewardHint: 'Completa el directo para subir de nivel fan',
        genre: 'Post-punk',
        colorClass: 'stream-a',
        youtubeUrl: '',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Backstage stories + Q&A',
        startsAt: addDays(28, 20, 0),
        viewers: 1130,
        rewardHint: 'Interactúa en chat para ganar presencia',
        genre: 'Alternative',
        colorClass: 'stream-b',
        youtubeUrl: '',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Belako en vivo: set completo',
        startsAt: addDays(35, 21, 30),
        viewers: 2795,
        rewardHint: 'Directo largo para acelerar progreso',
        genre: 'Live set',
        colorClass: 'stream-c',
        youtubeUrl: '',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Pre-show de gira: warm-up',
        startsAt: addDays(42, 19, 45),
        viewers: 1422,
        rewardHint: 'Asiste hoy y desbloquea hitos antes',
        genre: 'Indie rock',
        colorClass: 'stream-a',
        youtubeUrl: '',
        isActive: true
      },
      {
        artist: 'Belako',
        title: 'Aftershow íntimo para superfans',
        startsAt: addDays(49, 20, 0),
        viewers: 890,
        rewardHint: 'Más directos vistos -> más XP y tiers',
        genre: 'Acoustic',
        colorClass: 'stream-b',
        youtubeUrl: '',
        isActive: true
      }
    ]
  });

  await prisma.journeyTierConfig.createMany({
    data: [
      {
        code: 'fan',
        title: 'Fan Belako',
        requiredXp: 0,
        perkLabel: 'Acceso base a recompensas fan',
        sortOrder: 1,
        active: true
      },
      {
        code: 'super',
        title: 'Super Fan Belako',
        requiredXp: 180,
        perkLabel: 'Insignia Super Fan + prioridad en drops',
        sortOrder: 2,
        active: true
      },
      {
        code: 'ultra',
        title: 'Ultra Fan Belako',
        requiredXp: 420,
        perkLabel: 'Acceso anticipado a experiencias exclusivas',
        sortOrder: 3,
        active: true
      },
      {
        code: 'god',
        title: 'God Fan Belako',
        requiredXp: 760,
        perkLabel: 'Estado máximo de la comunidad Belako',
        sortOrder: 4,
        active: true
      }
    ]
  });

  await prisma.xpActionConfig.createMany({
    data: [
      { code: 'join_live', label: 'Unirte a directos en vivo', xpValue: 20, enabled: true },
      { code: 'watch_full_live', label: 'Ver directo entero', xpValue: 50, enabled: true },
      { code: 'buy_merch', label: 'Comprar merchandising', xpValue: 80, enabled: true },
      { code: 'buy_ticket', label: 'Comprar billetes para conciertos', xpValue: 120, enabled: true }
    ]
  });

  await prisma.bandReward.createMany({
    data: [
      {
        title: 'Recompensa directo completo',
        description: 'Completa un directo entero para reclamar bonus de fan.',
        triggerType: 'watch_full_live',
        xpBonus: 50,
        active: true,
        createdByEmail: 'assarasua@gmail.com'
      },
      {
        title: 'Bonus por compra de merch',
        description: 'Compra en tienda para sumar experiencia extra.',
        triggerType: 'purchase',
        xpBonus: 80,
        active: true,
        createdByEmail: 'assarasua@gmail.com'
      },
      {
        title: 'Bonus por entrada presencial',
        description: 'Ir a conciertos presenciales acelera tu journey.',
        triggerType: 'purchase',
        xpBonus: 120,
        active: true,
        createdByEmail: 'assarasua@gmail.com'
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
