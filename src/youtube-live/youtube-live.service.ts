import { Injectable } from '@nestjs/common';
import {
  YoutubeApiVideoResponse,
  YoutubeLiveError,
  YoutubeLiveViewersData,
} from './youtube-live.types';
import { extractYoutubeVideoId } from './youtube-url.util';

interface CachedYoutubeData {
  data: YoutubeLiveViewersData;
  expiresAt: number;
}

@Injectable()
export class YoutubeLiveService {
  private readonly apiUrl = 'https://www.googleapis.com/youtube/v3/videos';
  private readonly cache = new Map<string, CachedYoutubeData>();
  private readonly ttlMs = 20_000;

  extractVideoId(url: string): string {
    return extractYoutubeVideoId(url);
  }

  async getLiveViewersByUrl(url: string): Promise<YoutubeLiveViewersData> {
    const videoId = this.extractVideoId(url);
    return this.getLiveViewersByVideoId(videoId);
  }

  async getLiveViewersByVideoId(videoId: string): Promise<YoutubeLiveViewersData> {
    const cached = this.cache.get(videoId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new YoutubeLiveError(
        'YOUTUBE_API_KEY is missing in environment variables',
        'MISSING_API_KEY',
        500,
      );
    }

    const url = `${this.apiUrl}?part=liveStreamingDetails,snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new YoutubeLiveError(
        `Failed to connect to YouTube API: ${error instanceof Error ? error.message : 'unknown error'}`,
        'YOUTUBE_API_ERROR',
        502,
      );
    }

    let payload: YoutubeApiVideoResponse;
    try {
      payload = (await response.json()) as YoutubeApiVideoResponse;
    } catch {
      throw new YoutubeLiveError('Invalid response from YouTube API', 'YOUTUBE_API_ERROR', 502);
    }

    if (!response.ok || payload.error) {
      throw new YoutubeLiveError(
        payload.error?.message || 'YouTube API returned an error',
        'YOUTUBE_API_ERROR',
        response.status || 502,
      );
    }

    const item = payload.items?.[0];
    if (!item) {
      throw new YoutubeLiveError('Video not found', 'VIDEO_NOT_FOUND', 404);
    }

    const viewersRaw = item.liveStreamingDetails?.concurrentViewers;
    if (viewersRaw === undefined) {
      throw new YoutubeLiveError(
        'The video is not currently live or does not expose concurrent viewers',
        'VIDEO_NOT_LIVE',
        409,
      );
    }

    const data: YoutubeLiveViewersData = {
      videoId,
      concurrentViewers: Number.parseInt(viewersRaw, 10) || 0,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      isLive: true,
      fetchedAt: new Date(),
    };

    this.cache.set(videoId, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });

    return data;
  }
}
