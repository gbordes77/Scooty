import { createClient, RedisClientType } from 'redis';
import { CacheData, Archetype, Scout } from '../types';
import { logger } from '../utils/logger';

export class CacheService {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  async connect(): Promise<void> {
    // Check if Redis URL is configured properly
    if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
      throw new Error('Redis not configured or not available locally');
    }

    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        logger.warn('Redis connection failed, continuing without cache:', error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Archetype cache
  async getArchetypes(): Promise<Archetype[]> {
    try {
      if (!this.isConnected) return [];
      
      const cached = await this.client.get('archetypes');
      if (cached) {
        return JSON.parse(cached);
      }
      return [];
    } catch (error) {
      logger.error('Error getting archetypes from cache:', error);
      return [];
    }
  }

  async setArchetypes(archetypes: Archetype[]): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      await this.client.setEx('archetypes', 3600, JSON.stringify(archetypes)); // 1 hour cache
    } catch (error) {
      logger.error('Error setting archetypes in cache:', error);
    }
  }

  // Opponent search cache
  async getOpponentSuggestions(query: string, eventId: string): Promise<string[]> {
    try {
      if (!this.isConnected) return [];
      
      const key = `opponents:${eventId}:${query.toLowerCase()}`;
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return [];
    } catch (error) {
      logger.error('Error getting opponent suggestions from cache:', error);
      return [];
    }
  }

  async setOpponentSuggestions(query: string, eventId: string, opponents: string[]): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      const key = `opponents:${eventId}:${query.toLowerCase()}`;
      await this.client.setEx(key, 300, JSON.stringify(opponents)); // 5 minutes cache
    } catch (error) {
      logger.error('Error setting opponent suggestions in cache:', error);
    }
  }

  // Live embed cache
  async getLiveEmbedData(eventId: string): Promise<any> {
    try {
      if (!this.isConnected) return null;
      
      const key = `live_embed:${eventId}`;
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Error getting live embed data from cache:', error);
      return null;
    }
  }

  async setLiveEmbedData(eventId: string, data: any): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      const key = `live_embed:${eventId}`;
      await this.client.setEx(key, 60, JSON.stringify(data)); // 1 minute cache
    } catch (error) {
      logger.error('Error setting live embed data in cache:', error);
    }
  }

  // Recent scouts cache
  async getRecentScouts(eventId: string): Promise<Scout[]> {
    try {
      if (!this.isConnected) return [];
      
      const key = `recent_scouts:${eventId}`;
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      return [];
    } catch (error) {
      logger.error('Error getting recent scouts from cache:', error);
      return [];
    }
  }

  async setRecentScouts(eventId: string, scouts: Scout[]): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      const key = `recent_scouts:${eventId}`;
      await this.client.setEx(key, 120, JSON.stringify(scouts)); // 2 minutes cache
    } catch (error) {
      logger.error('Error setting recent scouts in cache:', error);
    }
  }

  // Invalidate cache when new data is added
  async invalidateScoutCache(eventId: string): Promise<void> {
    try {
      if (!this.isConnected) return;
      
      const keys = await this.client.keys(`*:${eventId}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Invalidated ${keys.length} cache keys for event ${eventId}`);
      }
    } catch (error) {
      logger.error('Error invalidating scout cache:', error);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) return false;
      
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  // Get cache statistics
  async getStats(): Promise<{ keys: number; memory: string }> {
    try {
      if (!this.isConnected) return { keys: 0, memory: '0B' };
      
      const info = await this.client.info('memory');
      const keys = await this.client.dbSize();
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:(\S+)/);
      const memory = (memoryMatch ? memoryMatch[1] : undefined) || '0B';
      
      return { keys, memory };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return { keys: 0, memory: '0B' };
    }
  }
} 