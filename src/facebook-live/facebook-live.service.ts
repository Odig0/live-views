import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Browser, chromium } from 'playwright';
import {
  FacebookLiveError,
  FacebookLiveScrapeResult,
  FacebookLiveViewersData,
} from './facebook-live.types';

interface CachedFacebookData {
  data: FacebookLiveViewersData;
  expiresAt: number;
}

@Injectable()
export class FacebookLiveService implements OnModuleDestroy {
  private readonly ttlMs = 20_000;
  private readonly cache = new Map<string, CachedFacebookData>();
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.browserPromise = null;
    }
  }

  async getLiveViewers(source?: string): Promise<FacebookLiveViewersData> {
    const normalizedSource = this.normalizeSource(source);

    const cacheKey = normalizedSource.sourceUrl;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const scraped = await this.scrapeLiveViewers(normalizedSource);

    const data: FacebookLiveViewersData = {
      pageId: scraped.pageId,
      videoId: scraped.videoId,
      concurrentViewers: scraped.viewerCount,
      title: scraped.title,
      status: scraped.status,
      permalinkUrl: scraped.sourceUrl,
      isLive: scraped.isLive,
      fetchedAt: new Date(),
    };

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });

    return data;
  }

  private normalizeSource(source?: string): FacebookLiveScrapeResult {
    if (!source || source.trim() === '') {
      throw new FacebookLiveError(
        'Facebook video URL or videoId is required',
        'INVALID_SOURCE',
        400,
      );
    }

    const trimmed = source.trim();
    const videoId = this.extractFacebookVideoId(trimmed);
    const sourceUrl = this.buildWatchUrl(trimmed, videoId);

    return {
      sourceUrl,
      videoId,
      pageId: 'facebook-public-live',
      title: undefined,
      status: undefined,
      viewerCount: 0,
      isLive: false,
    };
  }

  private extractFacebookVideoId(source: string): string {
    if (/^\d+$/.test(source)) {
      return source;
    }

    try {
      const url = new URL(source);
      return (
        url.searchParams.get('v') ||
        url.searchParams.get('video_id') ||
        url.pathname.split('/').filter(Boolean).pop() ||
        source
      );
    } catch {
      return source;
    }
  }

  private buildWatchUrl(source: string, videoId: string): string {
    if (/^https?:\/\//i.test(source)) {
      return source;
    }

    return `https://www.facebook.com/watch/live/?ref=watch_permalink&v=${encodeURIComponent(videoId)}`;
  }

  private async scrapeLiveViewers(
    source: FacebookLiveScrapeResult,
  ): Promise<FacebookLiveScrapeResult> {
    const browser = await this.getBrowser();
    const page = await browser.newPage({
      viewport: { width: 1365, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    try {
      await page.goto(source.sourceUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      await page.waitForTimeout(4000);

      const [bodyText, html, title] = await Promise.all([
        page.locator('body').innerText({ timeout: 10000 }).catch(() => ''),
        page.content().catch(() => ''),
        page.title().catch(() => ''),
      ]);

      const extracted = this.extractViewerCount(bodyText, html);

      if (!extracted) {
        throw new FacebookLiveError(
          'Could not detect live viewer count from Facebook page',
          'LIVE_NOT_FOUND',
          404,
        );
      }

      return {
        sourceUrl: source.sourceUrl,
        videoId: source.videoId,
        pageId: source.pageId,
        title: title || this.extractTitle(bodyText),
        status: extracted.isLive ? 'LIVE' : 'UNKNOWN',
        viewerCount: extracted.count,
        isLive: extracted.isLive,
      };
    } catch (error) {
      if (error instanceof FacebookLiveError) {
        throw error;
      }

      throw new FacebookLiveError(
        `Failed to scrape Facebook live viewers: ${error instanceof Error ? error.message : 'unknown error'}`,
        'FACEBOOK_BROWSER_ERROR',
        502,
      );
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    if (!this.browserPromise) {
      this.browserPromise = chromium
        .launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })
        .then((browser) => {
          this.browser = browser;
          return browser;
        })
        .catch((error) => {
          this.browserPromise = null;
          throw new FacebookLiveError(
            `Unable to launch Chromium: ${error instanceof Error ? error.message : 'unknown error'}`,
            'FACEBOOK_BROWSER_ERROR',
            500,
          );
        });
    }

    return this.browserPromise;
  }

  private extractViewerCount(bodyText: string, html: string): { count: number; isLive: boolean } | null {
    const sources = [bodyText, html].filter(Boolean);

    const patterns = [
      /([0-9][0-9.,]*)\s*([kKmMbB]?)\s*(?:personas?\s+viendo|personas?\s+est[aá]n viendo|viendo|watching(?:\s+now)?|people watching|viewers?)/i,
      /(?:personas?\s+viendo|personas?\s+est[aá]n viendo|viendo|watching(?:\s+now)?|people watching|viewers?)\s*([0-9][0-9.,]*)\s*([kKmMbB]?)/i,
      /"liveViewerCount"\s*:\s*"?(\d+)"?/i,
      /"live_views"\s*:\s*"?(\d+)"?/i,
      /"viewer_count"\s*:\s*"?(\d+)"?/i,
    ];

    for (const source of sources) {
      for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) {
          const count = this.parseViewerCount(match[1], match[2]);
          return {
            count,
            isLive: true,
          };
        }
      }
    }

    return null;
  }

  private parseViewerCount(value: string, suffix?: string): number {
    const normalized = value.replace(/\s/g, '').replace(/,/g, '');
    const numeric = Number(normalized.replace(/[^\d.]/g, ''));

    if (Number.isNaN(numeric)) {
      return 0;
    }

    const multiplier = this.getMultiplier(suffix);
    return Math.round(numeric * multiplier);
  }

  private getMultiplier(suffix?: string): number {
    switch ((suffix || '').toLowerCase()) {
      case 'k':
        return 1_000;
      case 'm':
        return 1_000_000;
      case 'b':
        return 1_000_000_000;
      default:
        return 1;
    }
  }

  private extractTitle(bodyText: string): string | undefined {
    const lines = bodyText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return lines[0] || undefined;
  }
}
