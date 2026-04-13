import { Injectable, Logger } from '@nestjs/common';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

export interface LiveViewsData {
  username: string;
  viewerCount: number;
  isLive: boolean;
  timestamp: Date;
  error?: string;
}

@Injectable()
export class TikTokLiveService {
  private readonly logger = new Logger(TikTokLiveService.name);
  private connections: Map<string, TikTokLiveConnection> = new Map();

  /**
   * Get the current viewer count from a TikTok live stream
   * @param username TikTok username (without @)
   * @returns Promise with viewer count data
   */
  async getViewerCount(username: string): Promise<LiveViewsData> {
    return new Promise((resolve) => {
      try {
        const connection = new TikTokLiveConnection(username);
        let viewerCount = 0;
        let isConnected = false;
        let isLive = true;

        // Timeout after 15 seconds
        const timeout = setTimeout(() => {
          if (connection.isConnected) {
            connection.disconnect();
          }
          resolve({
            username,
            viewerCount,
            isLive: isConnected,
            timestamp: new Date(),
            error: 'Connection timeout',
          });
        }, 15000);

        // Handle successful connection
        connection.on(ControlEvent.CONNECTED, () => {
          isConnected = true;
          this.logger.log(`Connected to ${username}'s live stream`);
        });

        // Handle stream end
        connection.on(WebcastEvent.STREAM_END, () => {
          isLive = false;
          this.logger.log(`Stream ended for ${username}`);
        });

        // Get viewer count from room user event
        connection.on(WebcastEvent.ROOM_USER, (data) => {
          viewerCount = data.viewerCount || 0;
          this.logger.log(`Current viewers for ${username}: ${viewerCount}`);

          // Disconnect after getting viewer count
          clearTimeout(timeout);
          connection.disconnect();

          resolve({
            username,
            viewerCount,
            isLive: true,
            timestamp: new Date(),
          });
        });

        // Handle errors
        connection.on(ControlEvent.ERROR, ({ info, exception }) => {
          this.logger.error(`Error connecting to ${username}:`, info, exception);
          clearTimeout(timeout);

          if (connection.isConnected) {
            connection.disconnect();
          }

          resolve({
            username,
            viewerCount: 0,
            isLive: false,
            timestamp: new Date(),
            error: info || 'Failed to connect',
          });
        });

        // Try to connect
        connection.connect().catch((err) => {
          this.logger.error(`Failed to connect to ${username}:`, err.message);
          clearTimeout(timeout);

          resolve({
            username,
            viewerCount: 0,
            isLive: false,
            timestamp: new Date(),
            error: err.message || 'Connection failed',
          });
        });
      } catch (error) {
        this.logger.error(`Unexpected error for ${username}:`, error);
        resolve({
          username,
          viewerCount: 0,
          isLive: false,
          timestamp: new Date(),
          error: error.message || 'Unexpected error',
        });
      }
    });
  }

  /**
   * Get room info including viewer count and stream details
   * @param username TikTok username (without @)
   * @returns Promise with room info
   */
  async getRoomInfo(username: string) {
    try {
      const connection = new TikTokLiveConnection(username);
      const roomInfo = await connection.fetchRoomInfo();

      return {
        username,
        userCount: roomInfo.user_count,
        viewCount: roomInfo.stats?.viewer_count,
        isLive: roomInfo.status === 2,
        title: roomInfo.title,
        owner: {
          username: roomInfo.owner?.display_id,
          nickname: roomInfo.owner?.nickname,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch room info for ${username}:`, error);
      throw error;
    }
  }
}
