import Redis from 'ioredis'

interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
  lazyConnect?: boolean
  connectTimeout?: number
  commandTimeout?: number
}

class RedisManager {
  private static instance: RedisManager
  private redis: Redis | null = null
  private isConnected: boolean = false
  private connectionAttempts: number = 0
  private maxConnectionAttempts: number = 3

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager()
    }
    return RedisManager.instance
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.redis) {
      return
    }

    try {
      const config: RedisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 5000
      }

      this.redis = new Redis(config)

      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully')
        this.isConnected = true
        this.connectionAttempts = 0
      })

      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error.message)
        this.isConnected = false
        this.connectionAttempts++
        
        if (this.connectionAttempts >= this.maxConnectionAttempts) {
          console.warn('⚠️  Max Redis connection attempts reached, falling back to memory storage')
        }
      })

      this.redis.on('close', () => {
        console.log('🔌 Redis connection closed')
        this.isConnected = false
      })

      await this.redis.connect()
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error)
      this.isConnected = false
      this.connectionAttempts++
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect()
      this.redis = null
      this.isConnected = false
    }
  }

  getClient(): Redis | null {
    return this.isConnected ? this.redis : null
  }

  isReady(): boolean {
    return this.isConnected && this.redis !== null
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.redis || !this.isConnected) {
        return false
      }
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('Redis ping failed:', error)
      return false
    }
  }

  // Utility methods for common operations
  async get(key: string): Promise<string | null> {
    try {
      if (!this.isReady()) return null
      return await this.redis!.get(key)
    } catch (error) {
      console.error('Redis GET error:', error)
      return null
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      if (!this.isReady()) return false
      if (ttl) {
        await this.redis!.setex(key, ttl, value)
      } else {
        await this.redis!.set(key, value)
      }
      return true
    } catch (error) {
      console.error('Redis SET error:', error)
      return false
    }
  }

  async incr(key: string): Promise<number | null> {
    try {
      if (!this.isReady()) return null
      return await this.redis!.incr(key)
    } catch (error) {
      console.error('Redis INCR error:', error)
      return null
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!this.isReady()) return false
      await this.redis!.expire(key, ttl)
      return true
    } catch (error) {
      console.error('Redis EXPIRE error:', error)
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.isReady()) return false
      await this.redis!.del(key)
      return true
    } catch (error) {
      console.error('Redis DEL error:', error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isReady()) return false
      const result = await this.redis!.exists(key)
      return result === 1
    } catch (error) {
      console.error('Redis EXISTS error:', error)
      return false
    }
  }

  async ttl(key: string): Promise<number | null> {
    try {
      if (!this.isReady()) return null
      return await this.redis!.ttl(key)
    } catch (error) {
      console.error('Redis TTL error:', error)
      return null
    }
  }
}

export const redisManager = RedisManager.getInstance()

// Initialize Redis connection on module load
if (process.env.NODE_ENV === 'production' || process.env.REDIS_ENABLED === 'true') {
  redisManager.connect().catch(console.error)
}