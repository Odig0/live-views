import { YoutubeLiveError } from './youtube-live.types';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

export function extractYoutubeVideoId(url: string): string {
  if (!url || url.trim() === '') {
    throw new YoutubeLiveError('YouTube URL is required', 'INVALID_URL', 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new YoutubeLiveError('Invalid YouTube URL format', 'INVALID_URL', 400);
  }

  if (!YOUTUBE_HOSTS.has(parsed.hostname)) {
    throw new YoutubeLiveError('URL is not a valid YouTube host', 'INVALID_URL', 400);
  }

  const path = parsed.pathname;
  const host = parsed.hostname;

  if (host.includes('youtu.be')) {
    return validateVideoId(path.split('/').filter(Boolean)[0]);
  }

  const watchId = parsed.searchParams.get('v');
  if (watchId) {
    return validateVideoId(watchId);
  }

  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'live' && segments[1]) {
    return validateVideoId(segments[1]);
  }

  if (segments[0] === 'shorts' && segments[1]) {
    return validateVideoId(segments[1]);
  }

  if (segments[0] === 'embed' && segments[1]) {
    return validateVideoId(segments[1]);
  }

  throw new YoutubeLiveError('Could not extract videoId from URL', 'INVALID_URL', 400);
}

function validateVideoId(raw: string | undefined): string {
  const value = (raw || '').trim();
  // YouTube videoId is usually 11 chars, allow >=10 for safer compatibility.
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(value)) {
    throw new YoutubeLiveError('Invalid YouTube videoId extracted from URL', 'INVALID_VIDEO_ID', 400);
  }
  return value;
}
