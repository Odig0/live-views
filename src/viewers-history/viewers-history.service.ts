import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PostgresService } from '../database/postgres.service';
import { TikTokCacheService } from '../tiktok-live/tiktok-cache.service';
import { YoutubeLiveService } from '../youtube-live/youtube-live.service';
import { LiveCountJsonHistoryService } from './live-count-json-history.service';

interface TrackerState {
  key: string;
  source: 'tiktok' | 'youtube';
  lastTouchedAt: number;
  intervalId: NodeJS.Timeout;
}

@Injectable()
export class ViewersHistoryService implements OnModuleDestroy {
  private readonly logger = new Logger(ViewersHistoryService.name);
  private readonly trackingIntervalMs = 30_000;
  private readonly inactivityTimeoutMs = 15 * 60 * 1000;
  private readonly trackers = new Map<string, TrackerState>();

  constructor(
    private readonly postgresService: PostgresService,
    private readonly liveCountJsonHistoryService: LiveCountJsonHistoryService,
    private readonly tiktokCacheService: TikTokCacheService,
    private readonly youtubeLiveService: YoutubeLiveService,
  ) {}

  async recordTikTokSnapshot(data: {
    username: string;
    viewerCount: number;
    isLive: boolean;
    capturedAt?: Date;
    sourceUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    const username = normalizeTikTokUsername(data.username);
    const recordedAt = data.capturedAt ?? new Date();

    try {
      this.logger.debug(`Recording TikTok snapshot for ${username}: ${data.viewerCount} viewers`);

      const liveCountId = await this.postgresService.insertViewerHistory({
        platform: 'tiktok',
        channelName: username,
        viewCount: data.viewerCount,
        updatedAt: recordedAt,
      });

      this.logger.debug(`insertViewerHistory returned liveCountId: ${liveCountId}`);

      if (liveCountId !== null) {
        await this.postgresService.insertLiveCountHistory({
          liveCountId,
          channelName: username,
          platform: 'tiktok',
          viewCount: data.viewerCount,
          recordedAt,
        });

        await this.liveCountJsonHistoryService.appendRecord({
          liveCountId,
          channelName: username,
          platform: 'tiktok',
          viewCount: data.viewerCount,
          recordedAt,
        });

        this.logger.log(`✓ TikTok snapshot recorded for ${username}: ${data.viewerCount} viewers`);
      } else {
        this.logger.warn(`Failed to get liveCountId for TikTok user ${username}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to persist TikTok history for ${username}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async recordYoutubeSnapshot(data: {
    videoId: string;
    concurrentViewers: number;
    title?: string;
    channelTitle?: string;
    isLive: boolean;
    sourceUrl?: string;
    capturedAt?: Date;
    metadata?: Record<string, unknown>;
  }) {
    const recordedAt = data.capturedAt ?? new Date();

    try {
      this.logger.debug(`Recording YouTube snapshot for ${data.videoId}: ${data.concurrentViewers} viewers`);

      const liveCountId = await this.postgresService.insertViewerHistory({
        platform: 'youtube',
        channelName: data.channelTitle ?? data.videoId,
        viewCount: data.concurrentViewers,
        updatedAt: recordedAt,
      });

      this.logger.debug(`insertViewerHistory returned liveCountId: ${liveCountId}`);

      if (liveCountId !== null) {
        await this.postgresService.insertLiveCountHistory({
          liveCountId,
          channelName: data.channelTitle ?? data.videoId,
          platform: 'youtube',
          viewCount: data.concurrentViewers,
          recordedAt,
        });

        await this.liveCountJsonHistoryService.appendRecord({
          liveCountId,
          channelName: data.channelTitle ?? data.videoId,
          platform: 'youtube',
          viewCount: data.concurrentViewers,
          recordedAt,
        });

        this.logger.log(`✓ YouTube snapshot recorded for ${data.videoId}: ${data.concurrentViewers} viewers`);
      } else {
        this.logger.warn(`Failed to get liveCountId for YouTube video ${data.videoId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to persist YouTube history for ${data.videoId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  ensureTikTokTracking(username: string) {
    const key = normalizeTikTokUsername(username);
    const trackerId = this.getTrackerId('tiktok', key);
    this.touchTracker(trackerId);

    if (this.trackers.has(trackerId)) {
      return;
    }

    void this.captureTikTokSnapshot(key, trackerId);

    const intervalId = setInterval(() => {
      void this.captureTikTokSnapshot(key, trackerId);
    }, this.trackingIntervalMs);

    this.trackers.set(trackerId, {
      key,
      source: 'tiktok',
      lastTouchedAt: Date.now(),
      intervalId,
    });

    this.logger.log(`Tracking TikTok history for ${key} every 30 seconds`);
  }

  ensureYoutubeTracking(videoId: string) {
    const key = videoId.trim();
    const trackerId = this.getTrackerId('youtube', key);
    this.touchTracker(trackerId);

    if (this.trackers.has(trackerId)) {
      return;
    }

    void this.captureYoutubeSnapshot(key, trackerId);

    const intervalId = setInterval(() => {
      void this.captureYoutubeSnapshot(key, trackerId);
    }, this.trackingIntervalMs);

    this.trackers.set(trackerId, {
      key,
      source: 'youtube',
      lastTouchedAt: Date.now(),
      intervalId,
    });

    this.logger.log(`Tracking YouTube history for ${key} every 30 seconds`);
  }

  onModuleDestroy() {
    for (const tracker of this.trackers.values()) {
      clearInterval(tracker.intervalId);
    }

    this.trackers.clear();
  }

  private async captureTikTokSnapshot(username: string, trackerId: string) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      return;
    }

    if (this.isTrackerStale(tracker)) {
      this.stopTracker(trackerId);
      return;
    }

    try {
      let cached = this.tiktokCacheService.getFromCache(username);

      if (!cached) {
        cached = await this.tiktokCacheService.startMonitoring(username);
      }

      await this.recordTikTokSnapshot({
        username: cached.username,
        viewerCount: cached.viewerCount,
        isLive: cached.isLive,
        capturedAt: cached.timestamp,
        metadata: {
          source: 'scheduled-cache-snapshot',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to capture TikTok snapshot for ${username}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async captureYoutubeSnapshot(videoId: string, trackerId: string) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      return;
    }

    if (this.isTrackerStale(tracker)) {
      this.stopTracker(trackerId);
      return;
    }

    try {
      const data = await this.youtubeLiveService.getLiveViewersByVideoId(videoId);

      await this.recordYoutubeSnapshot({
        videoId: data.videoId,
        concurrentViewers: data.concurrentViewers,
        title: data.title,
        channelTitle: data.channelTitle,
        isLive: data.isLive,
        capturedAt: data.fetchedAt,
        metadata: {
          source: 'scheduled-poll',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to capture YouTube snapshot for ${videoId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private touchTracker(trackerId: string) {
    const tracker = this.trackers.get(trackerId);

    if (tracker) {
      tracker.lastTouchedAt = Date.now();
    }
  }

  private isTrackerStale(tracker: TrackerState) {
    return Date.now() - tracker.lastTouchedAt > this.inactivityTimeoutMs;
  }

  private stopTracker(trackerId: string) {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      return;
    }

    clearInterval(tracker.intervalId);
    this.trackers.delete(trackerId);
    this.logger.log(`Stopped tracking history for ${tracker.source}:${tracker.key}`);
  }

  private getTrackerId(source: 'tiktok' | 'youtube', key: string) {
    return `${source}:${key}`;
  }
}

function normalizeTikTokUsername(username: string) {
  return username.replace(/^@/, '').trim().toLowerCase();
}