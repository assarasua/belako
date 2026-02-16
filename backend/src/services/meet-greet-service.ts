import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { hasCollectibleByAssetCode, listNftAssets } from './wallet-service.js';

export type MeetGreetPassStatus = 'LOCKED' | 'VALID' | 'USED' | 'EXPIRED';

export type ConcertEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  active: boolean;
};

type MeetGreetAccess = {
  id: string;
  userId: string;
  eventId: string;
  passAssetId: string;
  status: 'VALID' | 'USED' | 'EXPIRED';
  issuedAt: string;
  usedAt?: string;
};

type QrClaims = {
  sub: string;
  eventId: string;
  accessId: string;
  nonce: string;
};

const SUPERFAN_PASS_CODE = 'BELAKO_SUPERFAN_MG_PASS';
const QR_EXPIRY_SECONDS = 60;

const concertEvents: ConcertEvent[] = [
  {
    id: 'evt-bilbao-2026-11-21',
    title: 'Belako Superfan Meet & Greet - Bilbao',
    date: '2026-11-21T19:30:00.000Z',
    location: 'Bilbao Arena',
    active: true
  }
];

const accessByUser = new Map<string, MeetGreetAccess>();

function nowIso(): string {
  return new Date().toISOString();
}

function randomToken(size = 10): string {
  return Math.random().toString(36).slice(2, 2 + size);
}

function resolveActiveEvent(): ConcertEvent | undefined {
  return concertEvents.find((event) => event.active);
}

function resolvePassAssetId(): string | undefined {
  const passAsset = listNftAssets().find((asset) => asset.code === SUPERFAN_PASS_CODE);
  return passAsset?.id;
}

function computeStatus(access: MeetGreetAccess): MeetGreetPassStatus {
  if (access.status === 'USED') {
    return 'USED';
  }

  const event = concertEvents.find((item) => item.id === access.eventId);
  if (!event) {
    return 'EXPIRED';
  }

  const eventDate = new Date(event.date).getTime();
  if (Number.isFinite(eventDate) && eventDate < Date.now()) {
    access.status = 'EXPIRED';
    return 'EXPIRED';
  }

  return 'VALID';
}

function getOrCreateAccess(userId: string): MeetGreetAccess | undefined {
  const passAssetId = resolvePassAssetId();
  const event = resolveActiveEvent();
  if (!passAssetId || !event) {
    return undefined;
  }

  const existing = accessByUser.get(userId);
  if (existing) {
    return existing;
  }

  const created: MeetGreetAccess = {
    id: `mga_${randomToken(8)}`,
    userId,
    eventId: event.id,
    passAssetId,
    status: 'VALID',
    issuedAt: nowIso()
  };
  accessByUser.set(userId, created);
  return created;
}

export function getMeetGreetPass(userId: string) {
  const ownsPass = hasCollectibleByAssetCode(userId, SUPERFAN_PASS_CODE);
  const activeEvent = resolveActiveEvent();
  const passAsset = listNftAssets().find((asset) => asset.code === SUPERFAN_PASS_CODE);

  if (!ownsPass || !activeEvent || !passAsset) {
    return {
      status: 'LOCKED' as MeetGreetPassStatus,
      event: activeEvent,
      passAsset,
      canGenerateQr: false
    };
  }

  const access = getOrCreateAccess(userId);
  if (!access) {
    return {
      status: 'LOCKED' as MeetGreetPassStatus,
      event: activeEvent,
      passAsset,
      canGenerateQr: false
    };
  }

  const status = computeStatus(access);
  return {
    status,
    event: activeEvent,
    passAsset,
    canGenerateQr: status === 'VALID',
    usedAt: access.usedAt
  };
}

export function createMeetGreetQrToken(userId: string) {
  const pass = getMeetGreetPass(userId);
  if (pass.status !== 'VALID' || !pass.event) {
    throw new Error('Pase no válido para generar QR');
  }

  const access = getOrCreateAccess(userId);
  if (!access) {
    throw new Error('No existe acceso Meet & Greet');
  }

  const expiresAt = new Date(Date.now() + QR_EXPIRY_SECONDS * 1000).toISOString();
  const qrToken = jwt.sign(
    {
      sub: userId,
      eventId: access.eventId,
      accessId: access.id,
      nonce: randomToken(12)
    } satisfies QrClaims,
    env.jwtSecret,
    { expiresIn: `${QR_EXPIRY_SECONDS}s` }
  );

  return {
    qrToken,
    expiresAt
  };
}

export function validateMeetGreetQrToken(qrToken: string) {
  try {
    const decoded = jwt.verify(qrToken, env.jwtSecret) as QrClaims;
    const userId = decoded.sub;

    const pass = getMeetGreetPass(userId);
    if (pass.status === 'LOCKED') {
      return { valid: false, reason: 'PASS_LOCKED' };
    }
    if (pass.status === 'EXPIRED') {
      return { valid: false, reason: 'PASS_EXPIRED' };
    }

    const access = accessByUser.get(userId);
    if (!access || access.id !== decoded.accessId || access.eventId !== decoded.eventId) {
      return { valid: false, reason: 'ACCESS_NOT_FOUND' };
    }

    if (access.status === 'USED') {
      return {
        valid: true,
        reason: 'ALREADY_USED',
        usedAt: access.usedAt
      };
    }

    access.status = 'USED';
    access.usedAt = nowIso();

    return {
      valid: true,
      usedAt: access.usedAt
    };
  } catch {
    return {
      valid: false,
      reason: 'TOKEN_INVALID_OR_EXPIRED'
    };
  }
}
