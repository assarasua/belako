import { prisma } from '../lib/prisma.js';

type SaleCreateInput = {
  userEmail: string;
  customerEmail: string;
  customerName?: string;
  productId: string;
  productName: string;
  amountEur: number;
  stripeSessionId?: string;
  paymentIntentId?: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function saleTypeFromProductId(productId: string): 'ticket' | 'merch' {
  return productId.startsWith('ticket-') ? 'ticket' : 'merch';
}

function concertIdFromProductId(productId: string): string | null {
  if (!productId.startsWith('ticket-')) {
    return null;
  }
  const concertId = productId.replace('ticket-', '').trim();
  return concertId || null;
}

async function ensureConcertRegistrationForSale(sale: {
  id: string;
  productId: string;
  userEmail: string;
  customerName: string | null;
  status: string;
}) {
  if (sale.status !== 'PAID') {
    return;
  }
  const concertId = concertIdFromProductId(sale.productId);
  if (!concertId) {
    return;
  }

  const concert = await prisma.bandConcert.findUnique({ where: { id: concertId } });
  if (!concert) {
    return;
  }

  await prisma.bandConcertRegistration.upsert({
    where: {
      concertId_userEmail: {
        concertId,
        userEmail: normalizeEmail(sale.userEmail)
      }
    },
    create: {
      concertId,
      userEmail: normalizeEmail(sale.userEmail),
      userName: sale.customerName || undefined,
      status: 'PURCHASED',
      source: 'PURCHASE',
      saleId: sale.id
    },
    update: {
      userName: sale.customerName || undefined,
      status: 'PURCHASED',
      source: 'PURCHASE',
      saleId: sale.id
    }
  });
}

export async function createOrUpdateBandSale(input: SaleCreateInput) {
  const normalizedUserEmail = normalizeEmail(input.userEmail);
  const normalizedCustomerEmail = normalizeEmail(input.customerEmail);
  const itemType = saleTypeFromProductId(input.productId);

  const whereByPaymentIntent = input.paymentIntentId ? { paymentIntentId: input.paymentIntentId } : null;
  const whereBySession = input.stripeSessionId ? { stripeSessionId: input.stripeSessionId } : null;

  const existing =
    (whereByPaymentIntent ? await prisma.bandSale.findUnique({ where: whereByPaymentIntent }) : null) ||
    (whereBySession ? await prisma.bandSale.findUnique({ where: whereBySession }) : null);

  if (existing) {
    const updated = await prisma.bandSale.update({
      where: { id: existing.id },
      data: {
        userEmail: normalizedUserEmail,
        customerEmail: normalizedCustomerEmail,
        customerName: input.customerName || undefined,
        productId: input.productId,
        productName: input.productName,
        itemType,
        amountEur: input.amountEur,
        status: input.status,
        stripeSessionId: input.stripeSessionId || existing.stripeSessionId,
        paymentIntentId: input.paymentIntentId || existing.paymentIntentId,
        paidAt: input.status === 'PAID' ? new Date() : existing.paidAt
      }
    });
    await ensureConcertRegistrationForSale(updated);
    return updated;
  }

  const created = await prisma.bandSale.create({
    data: {
      userEmail: normalizedUserEmail,
      customerEmail: normalizedCustomerEmail,
      customerName: input.customerName || undefined,
      productId: input.productId,
      productName: input.productName,
      itemType,
      amountEur: input.amountEur,
      status: input.status,
      stripeSessionId: input.stripeSessionId,
      paymentIntentId: input.paymentIntentId,
      paidAt: input.status === 'PAID' ? new Date() : undefined
    }
  });
  await ensureConcertRegistrationForSale(created);
  return created;
}

export async function markBandSalePaid(input: { sessionId?: string; paymentIntentId?: string }) {
  const where = input.paymentIntentId
    ? { paymentIntentId: input.paymentIntentId }
    : input.sessionId
      ? { stripeSessionId: input.sessionId }
      : null;
  if (!where) {
    return null;
  }

  const existing = await prisma.bandSale.findUnique({ where });
  if (!existing) {
    return null;
  }

  const updated = await prisma.bandSale.update({
    where: { id: existing.id },
    data: {
      status: 'PAID',
      paidAt: existing.paidAt || new Date()
    }
  });
  await ensureConcertRegistrationForSale(updated);
  return updated;
}

export async function listDashboardSalesOverview() {
  const [sales, registrations] = await Promise.all([
    prisma.bandSale.findMany({
      orderBy: { createdAt: 'desc' }
    }),
    prisma.bandConcertRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        concert: true,
        sale: true
      }
    })
  ]);

  const paidSales = sales.filter((sale) => sale.status === 'PAID');
  const totalRevenueEur = paidSales.reduce((sum, sale) => sum + sale.amountEur.toNumber(), 0);
  const merchSales = paidSales.filter((sale) => sale.itemType === 'merch');
  const ticketSales = paidSales.filter((sale) => sale.itemType === 'ticket');

  return {
    summary: {
      totalSalesCount: sales.length,
      paidSalesCount: paidSales.length,
      pendingSalesCount: sales.filter((sale) => sale.status === 'PENDING').length,
      merchSalesCount: merchSales.length,
      ticketSalesCount: ticketSales.length,
      totalRevenueEur: Number(totalRevenueEur.toFixed(2)),
      totalConcertRegistrations: registrations.length
    },
    sales: sales.map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt.toISOString(),
      paidAt: sale.paidAt?.toISOString() || null,
      userEmail: sale.userEmail,
      customerEmail: sale.customerEmail,
      customerName: sale.customerName || '',
      productId: sale.productId,
      productName: sale.productName,
      itemType: sale.itemType,
      amountEur: sale.amountEur.toNumber(),
      status: sale.status,
      stripeSessionId: sale.stripeSessionId || '',
      paymentIntentId: sale.paymentIntentId || ''
    })),
    concertRegistrations: registrations.map((registration) => ({
      id: registration.id,
      createdAt: registration.createdAt.toISOString(),
      userEmail: registration.userEmail,
      userName: registration.userName || '',
      status: registration.status,
      source: registration.source,
      concertId: registration.concertId,
      concertTitle: registration.concert.title,
      concertVenue: registration.concert.venue,
      concertCity: registration.concert.city,
      concertStartsAt: registration.concert.startsAt.toISOString(),
      saleId: registration.saleId || '',
      saleAmountEur: registration.sale ? registration.sale.amountEur.toNumber() : null
    }))
  };
}
