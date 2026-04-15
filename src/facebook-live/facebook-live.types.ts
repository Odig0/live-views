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

export interface FacebookLiveVideoNode {
  id: string;
  title?: string;
  status?: string;
  broadcast_status?: string;
  live_views?: number;
  permalink_url?: string;
  creation_time?: string;
}

export interface FacebookGraphListResponse<T> {
  data?: T[];
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
}

export interface FacebookGraphObjectResponse<T> {
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
}

export class FacebookLiveError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'MISSING_ACCESS_TOKEN'
      | 'MISSING_PAGE_ID'
      | 'FACEBOOK_API_ERROR'
      | 'VIDEO_NOT_FOUND'
      | 'LIVE_NOT_FOUND',
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
