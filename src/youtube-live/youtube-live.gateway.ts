import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { YoutubeLiveError } from './youtube-live.types';
import { YoutubeWebsocketManagerService } from './youtube-websocket-manager.service';

interface SubscribePayload {
  url: string;
}

interface UnsubscribePayload {
  videoId?: string;
}

@WebSocketGateway({
  namespace: 'api/v1/youtube-live',
  cors: {
    origin: '*',
  },
})
export class YoutubeLiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(YoutubeLiveGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly youtubeWsManager: YoutubeWebsocketManagerService) {}

  handleConnection(client: Socket) {
    this.logger.log(`WS client connected: ${client.id}`);
    client.emit('connected', {
      message: 'Connected to YouTube live viewers websocket',
    });
  }

  handleDisconnect(client: Socket) {
    this.youtubeWsManager.unsubscribe(client.id);
    this.logger.log(`WS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-live')
  async subscribeLive(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ) {
    try {
      if (!payload?.url) {
        client.emit('youtube-error', {
          code: 'INVALID_URL',
          message: 'payload.url is required',
        });
        return;
      }

      const subscription = await this.youtubeWsManager.subscribe(
        client.id,
        payload.url,
        (message) => {
          client.emit('live-viewers-update', message);
        },
      );

      client.emit('subscribed-live', {
        videoId: subscription.videoId,
        pollIntervalSeconds: subscription.pollIntervalSeconds,
        subscribers: subscription.subscribers,
      });
    } catch (error) {
      if (error instanceof YoutubeLiveError) {
        client.emit('youtube-error', {
          code: error.code,
          message: error.message,
        });
        return;
      }

      client.emit('youtube-error', {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unexpected websocket error',
      });
    }
  }

  @SubscribeMessage('unsubscribe-live')
  unsubscribeLive(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: UnsubscribePayload,
  ) {
    this.youtubeWsManager.unsubscribe(client.id, payload?.videoId);
    client.emit('unsubscribed-live', {
      videoId: payload?.videoId || null,
    });
  }
}
