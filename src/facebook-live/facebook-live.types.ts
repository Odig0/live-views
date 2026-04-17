export interface FacebookLiveViewersData {
  pageId: string;
  videoId: string;
  concurrentViewers: number;
  title?: string;
  status?: string;
  permalinkUrl?: string;
  isLive: boolean;
  fetchedAt: Date;
}

export interface FacebookLiveScrapeResult {
  sourceUrl: string;
  videoId: string;
  pageId: string;
  title?: string;
  status?: string;
  viewerCount: number;
  isLive: boolean;
}

export class FacebookLiveError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_SOURCE'
      | 'MISSING_ACCESS_TOKEN'
      | 'MISSING_PAGE_ID'
      | 'FACEBOOK_API_ERROR'
      | 'FACEBOOK_BROWSER_ERROR'
      | 'VIDEO_NOT_FOUND'
      | 'LIVE_NOT_FOUND',
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
