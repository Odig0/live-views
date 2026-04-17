import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ViewersCacheService } from '../viewers-cache/viewers-cache.service';
import { YoutubeLiveService } from './youtube-live.service';
import { YoutubeLiveError, YoutubeLiveViewersData } from './youtube-live.types';

interface VideoPollingState {
  videoId: string;
  clients: Map<string, (payload: YoutubeWsUpdatePayload) => void>;
  updateCount: number;
  intervalId?: NodeJS.Timeout;
  inFlight?: Promise<YoutubeLiveViewersData | null>;
}

export interface YoutubeWsUpdatePayload {
  type: 'live-viewers-update' | 'live-ended' | 'error' | 'subscribed';
  platform?: 'youtube';
  referenceId?: string;
  videoId?: string;
  data?:
    | YoutubeLiveViewersData
    | (YoutubeLiveViewersData & {
        viewerCount: number;
        timestamp: Date;
      });
  updateNumber?: number;
  cached?: boolean;
  error?: {
    code: string;
    message: string;
  };
  sentAt: Date;
}

@Injectable()
export class YoutubeWebsocketManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(YoutubeWebsocketManagerService.name);
  private readonly pollIntervalMs = 25_000;
  private readonly states = new Map<string, VideoPollingState>();
  private readonly clientToVideos = new Map<string, Set<string>>();

  constructor(
    private readonly youtubeLiveService: YoutubeLiveService,
    private readonly viewersCacheService: ViewersCacheService,
  ) {}

  async subscribe(clientId: string, url: string, emit: (payload: YoutubeWsUpdatePayload) => void) {
    const videoId = this.youtubeLiveService.extractVideoId(url);

    let state = this.states.get(videoId);
    if (!state) {
      state = {
        videoId,
        clients: new Map(),
        updateCount: 0,
      };
      this.states.set(videoId, state);
    }

    state.clients.set(clientId, emit);

    let subscribedVideos = this.clientToVideos.get(clientId);
    if (!subscribedVideos) {
      subscribedVideos = new Set<string>();
      this.clientToVideos.set(clientId, subscribedVideos);
    }
    subscribedVideos.add(videoId);

    if (!state.intervalId) {
      await this.fetchAndBroadcast(videoId);
      state.intervalId = setInterval(() => {
        void this.fetchAndBroadcast(videoId);
      }, this.pollIntervalMs);
      this.logger.log(`Started polling YouTube video ${videoId} every 25 seconds`);
    } else {
      void this.fetchAndBroadcast(videoId);
    }

    return {
      videoId,
      pollIntervalSeconds: this.pollIntervalMs / 1000,
      subscribers: state.clients.size,
    };
  }

  unsubscribe(clientId: string, videoId?: string) {
    if (videoId) {
      this.removeClientFromVideo(clientId, videoId);
      return;
    }

    const videos = this.clientToVideos.get(clientId);
    if (!videos) {
      return;
    }

    for (const id of videos) {
      this.removeClientFromVideo(clientId, id);
    }

    this.clientToVideos.delete(clientId);
  }

  getStats() {
    return {
      monitoredVideos: this.states.size,
      videos: Array.from(this.states.values()).map((state) => ({
        videoId: state.videoId,
        subscribers: state.clients.size,
        isPolling: Boolean(state.intervalId),
      })),
    };
  }

  onModuleDestroy() {
    for (const [, state] of this.states) {
      if (state.intervalId) {
        clearInterval(state.intervalId);
      }
    }

    this.states.clear();
    this.clientToVideos.clear();
  }

  private removeClientFromVideo(clientId: string, videoId: string) {
    const state = this.states.get(videoId);
    if (!state) {
      return;
    }

    state.clients.delete(clientId);

    const videos = this.clientToVideos.get(clientId);
    if (videos) {
      videos.delete(videoId);
      if (videos.size === 0) {
        this.clientToVideos.delete(clientId);
      }
    }

    if (state.clients.size === 0) {
      if (state.intervalId) {
        clearInterval(state.intervalId);
      }
      this.states.delete(videoId);
      this.logger.log(`Stopped polling YouTube video ${videoId} due to no subscribers`);
    }
  }

  private async fetchAndBroadcast(videoId: string) {
    const state = this.states.get(videoId);
    if (!state || state.clients.size === 0) {
      return;
    }

    if (!state.inFlight) {
      state.inFlight = this.youtubeLiveService
        .getLiveViewersByVideoId(videoId)
        .then((data) => data)
        .catch((error) => {
          if (error instanceof YoutubeLiveError && error.code === 'VIDEO_NOT_LIVE') {
            const payload: YoutubeWsUpdatePayload = {
              type: 'live-ended',
              videoId,
              error: {
                code: error.code,
                message: error.message,
              },
              sentAt: new Date(),
            };
            this.broadcast(videoId, payload);
            this.cleanupVideo(videoId);
            return null;
          }

          const payload: YoutubeWsUpdatePayload = {
            type: 'error',
            videoId,
            error: {
              code: error instanceof YoutubeLiveError ? error.code : 'UNKNOWN_ERROR',
              message: error instanceof Error ? error.message : 'Unexpected error',
            },
            sentAt: new Date(),
          };
          this.broadcast(videoId, payload);
          return null;
        })
        .finally(() => {
          const current = this.states.get(videoId);
          if (current) {
            current.inFlight = undefined;
          }
        });
    }

    const data = await state.inFlight;
    if (!data) {
      return;
    }

    const sentAt = new Date();

    const payload: YoutubeWsUpdatePayload = {
      type: 'live-viewers-update',
      platform: 'youtube',
      referenceId: videoId,
      data: {
        ...data,
        viewerCount: data.concurrentViewers,
        timestamp: sentAt,
      },
      updateNumber: ++state.updateCount,
      cached: false,
      sentAt,
    };

    void this.viewersCacheService.upsertYoutube({
      videoId: data.videoId,
      concurrentViewers: data.concurrentViewers,
      title: data.title,
      channelTitle: data.channelTitle,
      isLive: data.isLive,
    });

    this.broadcast(videoId, payload);
  }

  private broadcast(videoId: string, payload: YoutubeWsUpdatePayload) {
    const state = this.states.get(videoId);
    if (!state) {
      return;
    }

    state.clients.forEach((emit) => {
      try {
        emit(payload);
      } catch (error) {
        this.logger.error(
          `Failed to emit update for video ${videoId}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    });
  }

  private cleanupVideo(videoId: string) {
    const state = this.states.get(videoId);
    if (!state) {
      return;
    }

    if (state.intervalId) {
      clearInterval(state.intervalId);
    }

    state.clients.forEach((_, clientId) => {
      const videos = this.clientToVideos.get(clientId);
      if (!videos) {
        return;
      }
      videos.delete(videoId);
      if (videos.size === 0) {
        this.clientToVideos.delete(clientId);
      }
    });

    this.states.delete(videoId);
  }
}
