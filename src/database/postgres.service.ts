import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type PoolConfig } from 'pg';

export interface ViewerHistoryRecord {
  platform: 'tiktok' | 'youtube';
  channelName: string;
  viewCount: number;
  updatedAt: Date;
}

export interface LiveCountHistoryRecord {
  liveCountId: number;
  channelName: string;
  platform: 'tiktok' | 'youtube';
  viewCount: number;
  recordedAt: Date;
}

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool = new Pool(this.buildPoolConfig());

  async onModuleInit() {
    try {
      await this.pool.query('SELECT 1');
      await this.ensureSchema();
      this.logger.log('PostgreSQL connection ready');
    } catch (error) {
      this.logger.error(
        `PostgreSQL initialization failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async insertViewerHistory(record: ViewerHistoryRecord) {
    const result = await this.pool.query<{ id: number }>(
      `
        INSERT INTO live_count (
          channel_name,
          platform,
          view_count,
          updated_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (channel_name, platform)
        DO UPDATE SET
          view_count = EXCLUDED.view_count,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `,
      [
        record.channelName,
        record.platform,
        record.viewCount,
        record.updatedAt,
      ],
    );

    return result.rows[0]?.id ?? null;
  }

  async insertLiveCountHistory(record: LiveCountHistoryRecord) {
    await this.pool.query(
      `
        INSERT INTO live_count_history (
          live_count_id,
          channel_name,
          platform,
          view_count,
          recorded_at
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [
        record.liveCountId,
        record.channelName,
        record.platform,
        record.viewCount,
        record.recordedAt,
      ],
    );
  }

  private buildPoolConfig(): PoolConfig {
    const connectionString = process.env.DATABASE_URL;
    const useSsl = this.shouldUseSsl();

    if (connectionString) {
      return {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        max: Number(process.env.PGPOOL_MAX ?? 10),
      };
    }

    return {
      host: process.env.PGHOST ?? process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.PGPORT ?? process.env.DB_PORT ?? 5432),
      user: process.env.PGUSER ?? process.env.DB_USER ?? 'postgres',
      password: process.env.PGPASSWORD ?? process.env.DB_PASSWORD,
      database: process.env.PGDATABASE ?? process.env.DB_NAME ?? 'postgres',
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX ?? 10),
    };
  }

  private shouldUseSsl() {
    const sslMode = (process.env.PGSSLMODE ?? process.env.DB_SSLMODE ?? '').toLowerCase();
    if (sslMode === 'require' || sslMode === 'true' || sslMode === '1') {
      return true;
    }

    return process.env.NODE_ENV === 'production';
  }

  private async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS live_count (
        id SERIAL PRIMARY KEY,
        channel_name VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        view_count INT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (channel_name, platform)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS live_count_history (
        id SERIAL PRIMARY KEY,
        live_count_id INT NOT NULL,
        channel_name VARCHAR(255) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        view_count INT NOT NULL,
        recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_live_count_history_live_count
          FOREIGN KEY (live_count_id) REFERENCES live_count (id)
          ON DELETE CASCADE
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_live_count_platform_channel_updated_at
      ON live_count (platform, channel_name, updated_at DESC)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_live_count_updated_at
      ON live_count (updated_at DESC)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_live_count_history_live_count_recorded_at
      ON live_count_history (live_count_id, recorded_at DESC)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_live_count_history_recorded_at
      ON live_count_history (recorded_at DESC)
    `);
  }
}