export interface YoutubeLiveViewersData {
  videoId: string;
  concurrentViewers: number;
  title?: string;
  channelTitle?: string;
  isLive: boolean;
  fetchedAt: Date;
}

export interface YoutubeApiVideoResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
    };
    liveStreamingDetails?: {
      concurrentViewers?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

export class YoutubeLiveError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_URL'
      | 'INVALID_VIDEO_ID'
      | 'MISSING_API_KEY'
      | 'VIDEO_NOT_FOUND'
      | 'VIDEO_NOT_LIVE'
      | 'YOUTUBE_API_ERROR',
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
