import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface LiveCountJsonEntry {
  id: number;
  live_count_id: number;
  channel_name: string;
  platform: 'tiktok' | 'youtube';
  view_count: number;
  recorded_at: string;
}

interface LiveCountJsonFile {
  updatedAt: string;
  nextId: number;
  live_count: LiveCountJsonEntry[];
}

export interface LiveCountMinuteAverage {
  minute: string;
  platform: 'tiktok' | 'youtube';
  averageViewCount: number;
  samples: number;
  channelNames: string[];
}

export interface LiveCountAveragesResult {
  generatedAt: string;
  windowMinutes: number;
  platform?: 'tiktok' | 'youtube';
  channelName?: string;
  data: LiveCountMinuteAverage[];
}

@Injectable()
export class LiveCountJsonHistoryService implements OnModuleInit {
  private readonly logger = new Logger(LiveCountJsonHistoryService.name);
  private readonly filePath = join(process.cwd(), 'data', 'live-count-history.json');
  private snapshot: LiveCountJsonFile = this.emptySnapshot();
  private writeQueue: Promise<void> = Promise.resolve();

  async onModuleInit() {
    await this.ensureFile();
    this.snapshot = await this.readFromDisk();
    await this.persist();
  }

  async appendRecord(record: {
    liveCountId: number;
    channelName: string;
    platform: 'tiktok' | 'youtube';
    viewCount: number;
    recordedAt: Date;
  }) {
    this.snapshot.live_count.push({
      id: this.snapshot.nextId,
      live_count_id: record.liveCountId,
      channel_name: record.channelName,
      platform: record.platform,
      view_count: record.viewCount,
      recorded_at: record.recordedAt.toISOString(),
    });

    this.snapshot.nextId += 1;
    this.snapshot.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async readMinuteAverages(options?: {
    windowMinutes?: number;
    platform?: 'tiktok' | 'youtube';
    channelName?: string;
  }): Promise<LiveCountAveragesResult> {
    const snapshot = await this.readFromDisk();
    const windowMinutes = options?.windowMinutes && options.windowMinutes > 0 ? options.windowMinutes : 60;
    const since = Date.now() - windowMinutes * 60 * 1000;
    const normalizedChannel = options?.channelName?.trim().toLowerCase();

    const filtered = snapshot.live_count.filter((entry) => {
      const entryTime = new Date(entry.recorded_at).getTime();
      const platformMatches = options?.platform ? entry.platform === options.platform : true;
      const channelMatches = normalizedChannel
        ? entry.channel_name.toLowerCase() === normalizedChannel
        : true;

      return entryTime >= since && platformMatches && channelMatches;
    });

    const grouped = new Map<string, { sum: number; samples: number; channelNames: Set<string> }>();

    for (const entry of filtered) {
      const minute = truncateToMinute(entry.recorded_at);
      const key = `${minute}|${entry.platform}`;
      const current = grouped.get(key) ?? {
        sum: 0,
        samples: 0,
        channelNames: new Set<string>(),
      };

      current.sum += entry.view_count;
      current.samples += 1;
      current.channelNames.add(entry.channel_name);
      grouped.set(key, current);
    }

    const data = Array.from(grouped.entries())
      .map(([key, value]) => {
        const [minute, platform] = key.split('|') as [string, 'tiktok' | 'youtube'];

        return {
          minute,
          platform,
          averageViewCount: roundToTwo(value.sum / value.samples),
          samples: value.samples,
          channelNames: Array.from(value.channelNames).sort(),
        } satisfies LiveCountMinuteAverage;
      })
      .sort((left, right) => left.minute.localeCompare(right.minute) || left.platform.localeCompare(right.platform));

    return {
      generatedAt: new Date().toISOString(),
      windowMinutes,
      platform: options?.platform,
      channelName: options?.channelName,
      data,
    };
  }

  private emptySnapshot(): LiveCountJsonFile {
    return {
      updatedAt: new Date().toISOString(),
      nextId: 1,
      live_count: [],
    };
  }

  private async ensureFile() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const content = await readFile(this.filePath, 'utf8');
      const trimmed = content.trim();

      if (trimmed === '' || trimmed === '{}') {
        this.logger.warn(`JSON history file is empty or corrupted, recreating at ${this.filePath}`);
        await this.writeBaseSnapshot();
        return;
      }

      try {
        JSON.parse(content);
      } catch {
        this.logger.warn(`JSON history file has invalid JSON, recreating at ${this.filePath}`);
        await this.writeBaseSnapshot();
      }
    } catch {
      await this.writeBaseSnapshot();
      this.logger.log(`Created JSON history file at ${this.filePath}`);
    }
  }

  private async readFromDisk(): Promise<LiveCountJsonFile> {
    try {
      const content = await readFile(this.filePath, 'utf8');
      const trimmed = content.trim();

      if (trimmed === '' || trimmed === '{}') {
        this.logger.warn('JSON history file is empty or corrupted, returning base structure');
        return this.emptySnapshot();
      }

      const parsed = JSON.parse(content) as Partial<LiveCountJsonFile>;

      return {
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        nextId: parsed.nextId && parsed.nextId > 0 ? parsed.nextId : 1,
        live_count: Array.isArray(parsed.live_count) ? parsed.live_count : [],
      };
    } catch (error) {
      this.logger.warn(
        `Error reading JSON history file: ${error instanceof Error ? error.message : 'unknown error'}, returning base structure`,
      );
      return this.emptySnapshot();
    }
  }

  private async persist() {
    const payload = `${JSON.stringify(this.snapshot, null, 2)}\n`;

    this.writeQueue = this.writeQueue
      .then(() => writeFile(this.filePath, payload, 'utf8'))
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to persist JSON history: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });

    await this.writeQueue;
  }

  private async writeBaseSnapshot() {
    await writeFile(
      this.filePath,
      `${JSON.stringify(this.emptySnapshot(), null, 2)}\n`,
      'utf8',
    );
  }
}

function truncateToMinute(isoDate: string) {
  const date = new Date(isoDate);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}