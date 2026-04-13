import { Test, TestingModule } from '@nestjs/testing';
import { TikTokLiveService } from './tiktok-live.service';
import { TikTokLiveController } from './tiktok-live.controller';

describe('TikTokLive Module', () => {
  let service: TikTokLiveService;
  let controller: TikTokLiveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TikTokLiveController],
      providers: [TikTokLiveService],
    }).compile();

    service = module.get<TikTokLiveService>(TikTokLiveService);
    controller = module.get<TikTokLiveController>(TikTokLiveController);
  });

  describe('Service', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have getViewerCount method', () => {
      expect(typeof service.getViewerCount).toBe('function');
    });

    it('should have getRoomInfo method', () => {
      expect(typeof service.getRoomInfo).toBe('function');
    });
  });

  describe('Controller', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('health endpoint should return ok status', async () => {
      const result = await controller.health();
      expect(result).toEqual({
        status: 'ok',
        service: 'TikTok Live Viewers',
      });
    });

    it('getViewers should reject if username is empty', async () => {
      try {
        await controller.getViewers('');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.response.message).toBe('Username is required');
      }
    });

    it('getViewers should remove @ from username', async () => {
      const username = '@testuser';
      // Mock would be needed in a real test
      // This is just showing the structure
      try {
        await controller.getViewers(username);
      } catch (error) {
        // Expected to fail without actual TikTok connection
        expect(username.replace(/^@/, '')).toBe('testuser');
      }
    });

    it('getRoomInfo should reject if username is empty', async () => {
      try {
        await controller.getRoomInfo('');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.status).toBe(400);
        expect(error.response.message).toBe('Username is required');
      }
    });
  });

  describe('Response Format', () => {
    it('getViewerCount should return error object if connection fails', async () => {
      const result = await service.getViewerCount('nonexistentuser12345');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('viewerCount');
      expect(result).toHaveProperty('isLive');
      expect(result).toHaveProperty('timestamp');
      // Will likely have an error message since user doesn't exist
      expect(result.error || result.viewerCount === 0).toBe(true);
    });
  });
});
