import { env } from '../config/env.js';

export type BelakoVideoDto = {
  id: string;
  youtubeVideoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  durationSeconds: number;
  embedUrl: string;
  watchUrl: string;
};

type YoutubeListResponse<T> = {
  items?: T[];
  nextPageToken?: string;
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
};

type CachedValue<T> = {
  expiresAt: number;
  value: T;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CachedValue<{ items: BelakoVideoDto[]; nextPageToken?: string }>>();
let channelCache: CachedValue<string> | null = null;

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: { items: BelakoVideoDto[]; nextPageToken?: string }) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim();
}

function parseIsoDurationToSeconds(duration: string): number {
  const match = duration.match(/^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) {
    return 0;
  }
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function pickThumbnail(thumbnails?: Record<string, { url?: string }>): string {
  return (
    thumbnails?.maxres?.url ||
    thumbnails?.high?.url ||
    thumbnails?.medium?.url ||
    thumbnails?.default?.url ||
    ''
  );
}

function isQuotaError(payload: YoutubeListResponse<unknown>): boolean {
  return payload.error?.code === 403 || payload.error?.errors?.some((error) => error.reason === 'quotaExceeded') === true;
}

async function fetchYouTubeJson<T>(url: string): Promise<YoutubeListResponse<T>> {
  const response = await fetch(url);
  const json = (await response.json()) as YoutubeListResponse<T>;
  if (!response.ok) {
    throw new Error(json.error?.message || 'YouTube API request failed');
  }
  return json;
}

export async function resolveChannelIdByHandle(handle = env.youtubeChannelHandle): Promise<string> {
  if (channelCache && channelCache.expiresAt > Date.now()) {
    return channelCache.value;
  }

  if (!env.youtubeApiKey) {
    throw new Error('MISSING_YOUTUBE_API_KEY');
  }

  const normalized = normalizeHandle(handle);
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'id');
  url.searchParams.set('forHandle', normalized);
  url.searchParams.set('key', env.youtubeApiKey);

  const payload = await fetchYouTubeJson<{ id?: string }>(url.toString());
  if (isQuotaError(payload)) {
    throw new Error('YOUTUBE_QUOTA_EXCEEDED');
  }
  const channelId = payload.items?.[0]?.id;
  if (!channelId) {
    throw new Error('YOUTUBE_CHANNEL_NOT_FOUND');
  }

  channelCache = {
    value: channelId,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  return channelId;
}

export async function fetchChannelVideos(input?: {
  pageToken?: string;
  limit?: number;
}): Promise<{ items: BelakoVideoDto[]; nextPageToken?: string }> {
  if (!env.youtubeApiKey) {
    throw new Error('MISSING_YOUTUBE_API_KEY');
  }

  const pageToken = input?.pageToken || '';
  const limit = Math.min(Math.max(input?.limit || 12, 1), 24);
  const cacheKey = `${normalizeHandle(env.youtubeChannelHandle)}::${pageToken}::${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  const channelId = await resolveChannelIdByHandle(env.youtubeChannelHandle);

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('channelId', channelId);
  searchUrl.searchParams.set('order', 'date');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', String(limit));
  searchUrl.searchParams.set('key', env.youtubeApiKey);
  if (pageToken) {
    searchUrl.searchParams.set('pageToken', pageToken);
  }

  const searchPayload = await fetchYouTubeJson<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
      liveBroadcastContent?: string;
    };
  }>(searchUrl.toString());

  if (isQuotaError(searchPayload)) {
    throw new Error('YOUTUBE_QUOTA_EXCEEDED');
  }

  const searchItems = (searchPayload.items || []).filter((item) => {
    const title = item.snippet?.title || '';
    const liveBroadcastContent = item.snippet?.liveBroadcastContent || 'none';
    const isShortByTitle = /#shorts/i.test(title);
    return liveBroadcastContent === 'none' && !isShortByTitle;
  });

  const ids = searchItems.map((item) => item.id?.videoId).filter(Boolean) as string[];
  if (ids.length === 0) {
    const result = { items: [], nextPageToken: searchPayload.nextPageToken };
    cacheSet(cacheKey, result);
    return result;
  }

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('part', 'contentDetails,snippet');
  videosUrl.searchParams.set('id', ids.join(','));
  videosUrl.searchParams.set('key', env.youtubeApiKey);

  const videosPayload = await fetchYouTubeJson<{
    id?: string;
    contentDetails?: { duration?: string };
    snippet?: {
      title?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
      liveBroadcastContent?: string;
    };
  }>(videosUrl.toString());

  if (isQuotaError(videosPayload)) {
    throw new Error('YOUTUBE_QUOTA_EXCEEDED');
  }

  const byId = new Map((videosPayload.items || []).map((item) => [item.id || '', item]));
  const items: BelakoVideoDto[] = ids
    .map((videoId) => {
      const details = byId.get(videoId);
      const durationSeconds = parseIsoDurationToSeconds(details?.contentDetails?.duration || '');
      const title = details?.snippet?.title || '';
      const liveBroadcastContent = details?.snippet?.liveBroadcastContent || 'none';
      const isRegularUpload = liveBroadcastContent === 'none' && durationSeconds >= 120 && !/#shorts/i.test(title);
      if (!isRegularUpload) {
        return null;
      }
      return {
        id: videoId,
        youtubeVideoId: videoId,
        title,
        publishedAt: details?.snippet?.publishedAt || new Date().toISOString(),
        thumbnailUrl: pickThumbnail(details?.snippet?.thumbnails),
        durationSeconds,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        watchUrl: `https://www.youtube.com/watch?v=${videoId}`
      } satisfies BelakoVideoDto;
    })
    .filter((item): item is BelakoVideoDto => Boolean(item));

  const result = {
    items,
    nextPageToken: searchPayload.nextPageToken
  };
  cacheSet(cacheKey, result);
  return result;
}
