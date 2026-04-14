import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface TikTokViewerSnapshot {
  username: string;
  viewerCount: number;
  isLive: boolean;
  updatedAt: string;
}

interface YoutubeViewerSnapshot {
  videoId: string;
  concurrentViewers: number;
  title?: string;
  channelTitle?: string;
  isLive: boolean;
  updatedAt: string;
}

interface ViewersCacheFile {
  updatedAt: string;
  tiktok: Record<string, TikTokViewerSnapshot>;
  youtube: Record<string, YoutubeViewerSnapshot>;
}

@Injectable()
export class ViewersCacheService implements OnModuleInit {
  private readonly logger = new Logger(ViewersCacheService.name);
  private readonly filePath = join(process.cwd(), 'data', 'viewers-cache.json');
  private snapshot: ViewersCacheFile = this.emptySnapshot();
  private writeQueue: Promise<void> = Promise.resolve();

  async onModuleInit() {
    await this.ensureFile();
    this.snapshot = await this.readFromDisk();
  }

  async upsertTikTok(data: {
    username: string;
    viewerCount: number;
    isLive: boolean;
  }) {
    const key = data.username.replace(/^@/, '').toLowerCase();
    this.snapshot.tiktok[key] = {
      username: key,
      viewerCount: data.viewerCount,
      isLive: data.isLive,
      updatedAt: new Date().toISOString(),
    };
    this.snapshot.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async upsertYoutube(data: {
    videoId: string;
    concurrentViewers: number;
    title?: string;
    channelTitle?: string;
    isLive: boolean;
  }) {
    const key = data.videoId;
    this.snapshot.youtube[key] = {
      videoId: key,
      concurrentViewers: data.concurrentViewers,
      title: data.title,
      channelTitle: data.channelTitle,
      isLive: data.isLive,
      updatedAt: new Date().toISOString(),
    };
    this.snapshot.updatedAt = new Date().toISOString();
    await this.persist();
  }

  async readSnapshot() {
    return this.readFromDisk();
  }

  async readTikTokSnapshot() {
    const data = await this.readFromDisk();
    return data.tiktok;
  }

  async readYoutubeSnapshot() {
    const data = await this.readFromDisk();
    return data.youtube;
  }

  private async ensureFile() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, 'utf8');
    } catch {
      await writeFile(
        this.filePath,
        `${JSON.stringify(this.emptySnapshot(), null, 2)}\n`,
        'utf8',
      );
      this.logger.log(`Created viewers cache file at ${this.filePath}`);
    }
  }

  private async readFromDisk(): Promise<ViewersCacheFile> {
    try {
      const content = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<ViewersCacheFile>;

      return {
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        tiktok: parsed.tiktok || {},
        youtube: parsed.youtube || {},
      };
    } catch {
      return this.emptySnapshot();
    }
  }

  private async persist() {
    const payload = `${JSON.stringify(this.snapshot, null, 2)}\n`;

    this.writeQueue = this.writeQueue
      .then(() => writeFile(this.filePath, payload, 'utf8'))
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to persist viewers cache: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });

    await this.writeQueue;
  }

  private emptySnapshot(): ViewersCacheFile {
    return {
      updatedAt: new Date().toISOString(),
      tiktok: {},
      youtube: {},
    };
  }
}
