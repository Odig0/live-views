import { Injectable } from '@nestjs/common';
import {
  FacebookGraphListResponse,
  FacebookGraphObjectResponse,
  FacebookLiveError,
  FacebookLiveVideoNode,
  FacebookLiveViewersData,
} from './facebook-live.types';

interface CachedFacebookData {
  data: FacebookLiveViewersData;
  expiresAt: number;
}

@Injectable()
export class FacebookLiveService {
  private readonly graphVersion = process.env.FACEBOOK_GRAPH_API_VERSION || 'v23.0';
  private readonly ttlMs = 20_000;
  private readonly cache = new Map<string, CachedFacebookData>();

  async getLiveViewers(videoId?: string): Promise<FacebookLiveViewersData> {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!accessToken) {
      throw new FacebookLiveError(
        'FACEBOOK_ACCESS_TOKEN is missing in environment variables',
        'MISSING_ACCESS_TOKEN',
        500,
      );
    }

    if (!pageId) {
      throw new FacebookLiveError(
        'FACEBOOK_PAGE_ID is missing in environment variables',
        'MISSING_PAGE_ID',
        500,
      );
    }

    const cacheKey = videoId || `active:${pageId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const targetVideo = videoId
      ? await this.fetchVideoById(videoId, accessToken)
      : await this.fetchActiveLiveVideo(pageId, accessToken);

    const normalizedStatus = (targetVideo.status || targetVideo.broadcast_status || '').toUpperCase();
    const concurrentViewers = Number(targetVideo.live_views || 0);

    const data: FacebookLiveViewersData = {
      pageId,
      videoId: targetVideo.id,
      concurrentViewers,
      title: targetVideo.title,
      status: normalizedStatus || undefined,
      permalinkUrl: targetVideo.permalink_url,
      isLive: normalizedStatus.includes('LIVE'),
      fetchedAt: new Date(),
    };

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });

    return data;
  }

  private async fetchActiveLiveVideo(
    pageId: string,
    accessToken: string,
  ): Promise<FacebookLiveVideoNode> {
    const fields = 'id,title,status,broadcast_status,live_views,permalink_url,creation_time';

    const url = this.buildGraphUrl(`${encodeURIComponent(pageId)}/live_videos`, {
      fields,
      access_token: accessToken,
    });

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new FacebookLiveError(
        `Failed to connect to Meta Graph API: ${error instanceof Error ? error.message : 'unknown error'}`,
        'FACEBOOK_API_ERROR',
        502,
      );
    }

    let payload: FacebookGraphListResponse<FacebookLiveVideoNode>;
    try {
      payload = (await response.json()) as FacebookGraphListResponse<FacebookLiveVideoNode>;
    } catch {
      throw new FacebookLiveError('Invalid response from Meta Graph API', 'FACEBOOK_API_ERROR', 502);
    }

    if (!response.ok || payload.error) {
      throw new FacebookLiveError(
        payload.error?.message || 'Meta Graph API returned an error',
        'FACEBOOK_API_ERROR',
        response.status || 502,
      );
    }

    const liveVideo = (payload.data || []).find((video) => {
      const status = (video.status || video.broadcast_status || '').toUpperCase();
      return status.includes('LIVE');
    });

    if (!liveVideo) {
      throw new FacebookLiveError(
        'No active live video found for this Facebook page',
        'LIVE_NOT_FOUND',
        404,
      );
    }

    return liveVideo;
  }

  private async fetchVideoById(
    videoId: string,
    accessToken: string,
  ): Promise<FacebookLiveVideoNode> {
    const fields = 'id,title,status,broadcast_status,live_views,permalink_url,creation_time';

    const url = this.buildGraphUrl(encodeURIComponent(videoId), {
      fields,
      access_token: accessToken,
    });

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new FacebookLiveError(
        `Failed to connect to Meta Graph API: ${error instanceof Error ? error.message : 'unknown error'}`,
        'FACEBOOK_API_ERROR',
        502,
      );
    }

    let payload: FacebookGraphObjectResponse<FacebookLiveVideoNode> & FacebookLiveVideoNode;
    try {
      payload =
        (await response.json()) as FacebookGraphObjectResponse<FacebookLiveVideoNode> &
          FacebookLiveVideoNode;
    } catch {
      throw new FacebookLiveError('Invalid response from Meta Graph API', 'FACEBOOK_API_ERROR', 502);
    }

    if (!response.ok || payload.error) {
      const status = response.status || 502;
      throw new FacebookLiveError(
        payload.error?.message || 'Meta Graph API returned an error',
        status === 404 ? 'VIDEO_NOT_FOUND' : 'FACEBOOK_API_ERROR',
        status,
      );
    }

    if (!payload.id) {
      throw new FacebookLiveError('Facebook video not found', 'VIDEO_NOT_FOUND', 404);
    }

    return payload;
  }

  private buildGraphUrl(path: string, params: Record<string, string>): string {
    const base = `https://graph.facebook.com/${this.graphVersion}/${path}`;
    const query = new URLSearchParams(params);
    return `${base}?${query.toString()}`;
  }
}
