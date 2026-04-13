import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

interface MonitoredStreamer {
  username: string;
  intervalId?: NodeJS.Timeout;
  clients: Set<(data: any) => void>;
}

export interface RealtimeViewerUpdate {
  username: string;
  viewerCount: number;
  isLive: boolean;
  timestamp: Date;
  error?: string;
}

@Injectable()
export class TikTokRealtimeService {
  private readonly logger = new Logger(TikTokRealtimeService.name);
  private monitored: Map<string, MonitoredStreamer> = new Map();
  private viewerUpdates = new Subject<RealtimeViewerUpdate>();

  /**
   * Obtener observable de actualizaciones en tiempo real
   */
  getUpdates$() {
    return this.viewerUpdates.asObservable();
  }

  /**
   * Registrar observer para recibir updates en tiempo real
   */
  subscribeToUpdates(username: string, callback: (data: RealtimeViewerUpdate) => void) {
    const clean = username.replace(/^@/, '');
    
    let monitored = this.monitored.get(clean);
    
    if (!monitored) {
      monitored = {
        username: clean,
        clients: new Set(),
      };
      this.monitored.set(clean, monitored);
    }

    monitored.clients.add(callback);

    // Si no hay intervalo, crear uno
    if (!monitored.intervalId) {
      this.startMonitoring(clean, callback);
    }

    // Retornar función para desuscribirse
    return () => {
      monitored.clients.delete(callback);
      if (monitored.clients.size === 0) {
        this.stopMonitoring(clean);
      }
    };
  }

  /**
   * Iniciar monitoreo en tiempo real
   */
  private startMonitoring(username: string, callback?: (data: RealtimeViewerUpdate) => void) {
    const monitored = this.monitored.get(username);
    if (!monitored) return;

    this.logger.log(`Iniciando monitoreo en tiempo real para ${username}`);

    // Actualizar cada 5 segundos
    monitored.intervalId = setInterval(async () => {
      try {
        // Aquí se dispararía la lógica de obtener viewers
        // Por ahora es un placeholder que será usado desde el controller
      } catch (error) {
        this.logger.error(`Error monitoreando ${username}:`, error.message);
      }
    }, 5000);
  }

  /**
   * Detener monitoreo
   */
  private stopMonitoring(username: string) {
    const monitored = this.monitored.get(username);
    if (monitored && monitored.intervalId) {
      clearInterval(monitored.intervalId);
      monitored.intervalId = undefined;
      this.logger.log(`Monitoreo detenido para ${username}`);
      this.monitored.delete(username);
    }
  }

  /**
   * Enviar actualización a todos los clientes conectados
   */
  broadcastUpdate(username: string, data: RealtimeViewerUpdate) {
    const monitored = this.monitored.get(username.replace(/^@/, ''));
    if (monitored) {
      monitored.clients.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error('Error en callback de cliente:', error.message);
        }
      });
      this.viewerUpdates.next(data);
    }
  }

  /**
   * Obtener streaming actual de un usuario
   */
  getStreamingClients(username: string): number {
    const monitored = this.monitored.get(username.replace(/^@/, ''));
    return monitored?.clients.size || 0;
  }

  /**
   * Obtener lista de streamers siendo monitoreados
   */
  getMonitoredStreamers(): string[] {
    return Array.from(this.monitored.keys());
  }
}
