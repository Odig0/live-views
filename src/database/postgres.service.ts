import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, type PoolConfig } from 'pg';

export interface ViewerHistoryRecord {
  source: 'tiktok' | 'youtube';
  referenceKey: string;
  viewerCount: number;
  isLive: boolean;
  capturedAt: Date;
  displayName?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
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
    await this.pool.query(
      `
        INSERT INTO viewer_history (
          source,
          reference_key,
          display_name,
          source_url,
          viewer_count,
          is_live,
          metadata,
          captured_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      `,
      [
        record.source,
        record.referenceKey,
        record.displayName ?? null,
        record.sourceUrl ?? null,
        record.viewerCount,
        record.isLive,
        JSON.stringify(record.metadata ?? {}),
        record.capturedAt,
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
      CREATE TABLE IF NOT EXISTS viewer_history (
        id BIGSERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        reference_key TEXT NOT NULL,
        display_name TEXT,
        source_url TEXT,
        viewer_count INTEGER NOT NULL,
        is_live BOOLEAN NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_viewer_history_source_reference_captured_at
      ON viewer_history (source, reference_key, captured_at DESC)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_viewer_history_captured_at
      ON viewer_history (captured_at DESC)
    `);
  }
}