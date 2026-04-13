import { Injectable, Logger } from '@nestjs/common';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

interface CachedViewerData {
  username: string;
  viewerCount: number;
  isLive: boolean;
  timestamp: Date;
  lastUpdate: number; // timestamp en ms
}

@Injectable()
export class TikTokCacheService {
  private readonly logger = new Logger(TikTokCacheService.name);
  private cache = new Map<string, CachedViewerData>();
  private connections = new Map<string, TikTokLiveConnection>();
  private updateIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Obtener viewers del caché (sin hacer conexión nueva)
   */
  getCachedViewers(username: string): CachedViewerData | null {
    const clean = username.replace(/^@/, '');
    return this.cache.get(clean) || null;
  }

  /**
   * Empezar a monitorear un usuario (conecta UNA SOLA VEZ y actualiza caché continuamente)
   */
  async startMonitoring(username: string): Promise<CachedViewerData> {
    const clean = username.replace(/^@/, '');

    // Si ya está siendo monitoreado, retornar datos cacheados
    if (this.connections.has(clean)) {
      const cached = this.cache.get(clean);
      if (cached) return cached;
    }

    return new Promise((resolve) => {
      try {
        const connection = new TikTokLiveConnection(clean);
        let hasResolved = false;

        // Timeout después de 20 segundos
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            if (connection.isConnected) {
              connection.disconnect();
            }
            this.connections.delete(clean);

            const errorData: CachedViewerData = {
              username: clean,
              viewerCount: 0,
              isLive: false,
              timestamp: new Date(),
              lastUpdate: Date.now(),
            };
            this.cache.set(clean, errorData);
            resolve(errorData);
          }
        }, 20000);

        connection.on(ControlEvent.CONNECTED, () => {
          this.logger.log(`✅ Conectado a ${clean}`);
          clearTimeout(timeout);
        });

        // ⭐ ESCUCHAR ROOM_USER CONTINUAMENTE (no solo una vez)
        connection.on(WebcastEvent.ROOM_USER, (data) => {
          const viewerCount = data.viewerCount || 0;
          this.logger.log(`📊 ${clean}: ${viewerCount} viewers`);

          const cachedData: CachedViewerData = {
            username: clean,
            viewerCount,
            isLive: true,
            timestamp: new Date(),
            lastUpdate: Date.now(),
          };

          // Actualizar el caché (sucede cada vez que TikTok envía ROOM_USER)
          this.cache.set(clean, cachedData);

          // Solo resolver la promesa la PRIMERA vez
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            resolve(cachedData);
          }
        });

        // Manejar errores
        connection.on(ControlEvent.ERROR, ({ info }) => {
          this.logger.error(`❌ Error en ${clean}:`, info);
          clearTimeout(timeout);

          const errorData: CachedViewerData = {
            username: clean,
            viewerCount: 0,
            isLive: false,
            timestamp: new Date(),
            lastUpdate: Date.now(),
          };
          this.cache.set(clean, errorData);

          if (!hasResolved) {
            hasResolved = true;
            resolve(errorData);
          }

          // NO desconectar inmediatamente, reintentar conectar
          if (connection.isConnected) {
            connection.disconnect();
          }
          this.connections.delete(clean);
        });

        // Conectar
        connection.connect().catch((err) => {
          this.logger.error(`❌ Fallo conectar a ${clean}:`, err.message);
          clearTimeout(timeout);

          const errorData: CachedViewerData = {
            username: clean,
            viewerCount: 0,
            isLive: false,
            timestamp: new Date(),
            lastUpdate: Date.now(),
          };
          this.cache.set(clean, errorData);

          if (!hasResolved) {
            hasResolved = true;
            resolve(errorData);
          }
        });

        // Guardar conexión
        this.connections.set(clean, connection);
      } catch (error) {
        this.logger.error(`❌ Error en startMonitoring ${username}:`, error.message);

        const errorData: CachedViewerData = {
          username: clean,
          viewerCount: 0,
          isLive: false,
          timestamp: new Date(),
          lastUpdate: Date.now(),
        };
        this.cache.set(clean, errorData);
        resolve(errorData);
      }
    });
  }

  /**
   * Detener monitoreo de un usuario
   */
  stopMonitoring(username: string) {
    const clean = username.replace(/^@/, '');

    // Limpiar intervalo
    const interval = this.updateIntervals.get(clean);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(clean);
    }

    // Desconectar
    const connection = this.connections.get(clean);
    if (connection && connection.isConnected) {
      connection.disconnect();
    }
    this.connections.delete(clean);

    this.logger.log(`🔌 Monitoreo detenido para ${clean}`);
  }

  /**
   * Obtener datos del caché (o null si no existe)
   */
  getFromCache(username: string): CachedViewerData | null {
    const clean = username.replace(/^@/, '');
    return this.cache.get(clean) || null;
  }

  /**
   * Limpiar todo en caso de shutdown
   */
  onModuleDestroy() {
    for (const [username] of this.connections) {
      this.stopMonitoring(username);
    }
  }
}
