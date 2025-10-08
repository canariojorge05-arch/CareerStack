// In-memory Redis-compatible fallback client to run without a real Redis instance
// This implements only the subset of commands used in the codebase.

type RedisValue = string;

class InMemoryRedisClient {
  private kv = new Map<string, RedisValue>();
  private hashes = new Map<string, Map<string, RedisValue>>();
  private sortedSets = new Map<string, Array<{ score: number; member: RedisValue }>>();

  private commandCount = 0;
  private startTime = Date.now();

  private inc() { this.commandCount++; }

  async ping(): Promise<string> { this.inc(); return 'PONG'; }
  async info(section?: string): Promise<string> {
    this.inc();
    // Minimal INFO output lines expected by parsers
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const totalCommands = this.commandCount.toString();
    const usedMemory = '0';
    const maxmemory = '0';
    const connectedClients = '0';
    const redisVersion = 'in-memory-0.1.0';
    return [
      '# Server',
      `redis_version:${redisVersion}`,
      '# Clients',
      `connected_clients:${connectedClients}`,
      '# Memory',
      `used_memory:${usedMemory}`,
      `used_memory_human:0B`,
      `maxmemory:${maxmemory}`,
      '# Stats',
      `total_commands_processed:${totalCommands}`,
      '# CPU',
      '# Cluster',
      '# Keyspace',
      `uptime_in_seconds:${uptime}`,
    ].join('\r\n');
  }
  async dbsize(): Promise<number> { this.inc(); return this.kv.size; }

  // KV
  async set(key: string, value: RedisValue, ex?: any, ttlSeconds?: number): Promise<'OK'> {
    this.inc();
    this.kv.set(key, value);
    if (ex === 'EX' && typeof ttlSeconds === 'number' && ttlSeconds > 0) {
      setTimeout(() => { this.kv.delete(key); }, ttlSeconds * 1000).unref?.();
    }
    return 'OK';
  }
  async setex(key: string, seconds: number, value: RedisValue): Promise<'OK'> {
    this.inc();
    this.kv.set(key, value);
    if (seconds > 0) {
      setTimeout(() => { this.kv.delete(key); }, seconds * 1000).unref?.();
    }
    return 'OK';
  }
  async get(key: string): Promise<RedisValue | null> { this.inc(); return this.kv.get(key) ?? null; }
  async del(...keys: string[]): Promise<number> { this.inc(); let c=0; for (const k of keys){ if (this.kv.delete(k)) c++; this.hashes.delete(k); this.sortedSets.delete(k);} return c; }
  async expire(key: string, seconds: number): Promise<number> {
    this.inc();
    if (this.kv.has(key)) {
      if (seconds > 0) {
        setTimeout(() => { this.kv.delete(key); }, seconds * 1000).unref?.();
      }
      return 1; // Key exists and expiration was set
    }
    return 0; // Key doesn't exist
  }
  async ttl(key: string): Promise<number> { this.inc(); return -1; }
  async keys(pattern: string): Promise<string[]> {
    this.inc();
    const toRegex = (pat: string) => new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const re = toRegex(pattern);
    const all = new Set<string>([
      ...Array.from(this.kv.keys()),
      ...Array.from(this.hashes.keys()),
      ...Array.from(this.sortedSets.keys()),
    ]);
    return Array.from(all).filter(k => re.test(k));
  }

  // Hashes
  private getHash(key: string): Map<string, RedisValue> {
    let h = this.hashes.get(key);
    if (!h) { h = new Map(); this.hashes.set(key, h); }
    return h;
  }
  async hset(key: string, field: string, value: RedisValue): Promise<number> { this.inc(); const h=this.getHash(key); const isNew = h.has(field)?0:1; h.set(field, value); return isNew; }
  async hget(key: string, field: string): Promise<RedisValue | null> { this.inc(); const h=this.hashes.get(key); return h?.get(field) ?? null; }
  async hdel(key: string, ...fields: string[]): Promise<number> { this.inc(); const h=this.hashes.get(key); if (!h) return 0; let c=0; for (const f of fields){ if (h.delete(f)) c++; } return c; }
  async hlen(key: string): Promise<number> { this.inc(); return this.hashes.get(key)?.size ?? 0; }
  async hkeys(key: string): Promise<string[]> { this.inc(); return Array.from(this.hashes.get(key)?.keys() ?? []); }
  async hgetall(key: string): Promise<Record<string, string>> {
    this.inc();
    const h = this.hashes.get(key); const obj: Record<string, string> = {};
    if (!h) return obj; for (const [k,v] of h.entries()) obj[k]=v; return obj;
  }

  // Sorted sets
  private getZset(key: string) {
    let z = this.sortedSets.get(key);
    if (!z) { z = []; this.sortedSets.set(key, z); }
    return z;
  }
  async zadd(key: string, score: number, member: RedisValue): Promise<number> {
    this.inc();
    const z = this.getZset(key);
    const idx = z.findIndex(e => e.member === member);
    if (idx >= 0) { z[idx].score = score; return 0; }
    z.push({ score, member });
    z.sort((a,b)=>a.score-b.score);
    return 1;
  }
  async zrem(key: string, member: RedisValue): Promise<number> { this.inc(); const z=this.getZset(key); const len=z.length; const nz=z.filter(e=>e.member!==member); this.sortedSets.set(key, nz); return len - nz.length; }
  async zrange(key: string, start: number, stop: number): Promise<RedisValue[]> {
    this.inc();
    const z = this.getZset(key);
    const normalizedStop = stop === -1 ? z.length - 1 : stop;
    return z.slice(start, normalizedStop + 1).map(e => e.member);
  }
  async zrangebyscore(key: string, min: string, max: string, _limit?: string, offset?: number, count?: number): Promise<RedisValue[]> {
    this.inc();
    const z = this.getZset(key);
    const minVal = min === '-inf' ? -Infinity : Number(min);
    const maxVal = max === '+inf' ? Infinity : Number(max);
    const filtered = z.filter(e => e.score >= minVal && e.score <= maxVal).sort((a,b)=>a.score-b.score).map(e=>e.member);
    const off = offset ?? 0; const cnt = count ?? filtered.length;
    return filtered.slice(off, off + cnt);
  }
  async zcard(key: string): Promise<number> { this.inc(); return this.getZset(key).length; }

  // Convenience for compatibility
  quit(): Promise<'OK'> { return Promise.resolve('OK'); }
}

const inMemoryClient = new InMemoryRedisClient();

export const redisService = {
  getClient: () => inMemoryClient as any,
  isHealthy: async () => true,
  cleanup: async () => { /* nothing to cleanup for in-memory */ },
  ready: true,
  executeCommand: async <T>(command: () => Promise<T>, _operation: string): Promise<T> => {
    // In memory fallback just executes the command
    return command();
  },
  getHealthMetrics: () => ({
    totalCommands: 0,
    failedCommands: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastLatency: 0,
    cacheHitRate: 0,
    errorRate: 0,
    isReady: true,
    isClusterMode: false,
    poolSize: 1,
    activeConnections: 1,
  }),
  optimizeConnections: async () => {},
  // Optional cluster info accessor used by health monitor
  getClusterInfo: () => ({ mode: 'standalone' })
};

// Simple in-memory caches using the same in-memory client
export const sessionCache = {
  async get(key: string): Promise<any> { const v = await inMemoryClient.get(`session:${key}`); return v ? JSON.parse(v) : null; },
  async set(key: string, value: any, customTTL?: number): Promise<void> { await inMemoryClient.set(`session:${key}`, JSON.stringify(value), 'EX', customTTL ?? 3600); },
  async del(key: string): Promise<void> { await inMemoryClient.del(`session:${key}`); },
  async exists(key: string): Promise<boolean> { return (await inMemoryClient.get(`session:${key}`)) !== null; },
  async extend(key: string, ttl?: number): Promise<void> { const v = await inMemoryClient.get(`session:${key}`); if (v) await inMemoryClient.set(`session:${key}`, v, 'EX', ttl ?? 3600); }
};

export const apiCache = {
  async get(key: string): Promise<any> { const v = await inMemoryClient.get(`api:${key}`); return v ? JSON.parse(v) : null; },
  async set(key: string, value: any, customTTL?: number): Promise<void> { await inMemoryClient.set(`api:${key}`, JSON.stringify(value), 'EX', customTTL ?? 300); },
  async del(key: string): Promise<void> { await inMemoryClient.del(`api:${key}`); },
  async mget(keys: string[]): Promise<(any | null)[]> { const vals = await Promise.all(keys.map(k => inMemoryClient.get(`api:${k}`))); return vals.map(v => v ? JSON.parse(v) : null); },
  async invalidatePattern(pattern: string): Promise<number> { const keys = await inMemoryClient.keys(pattern); if (keys.length) await inMemoryClient.del(...keys); return keys.length; }
};

export const docxCache = {
  async get(key: string): Promise<any> { const v = await inMemoryClient.get(`docx:${key}`); return v ? JSON.parse(v) : null; },
  async set(key: string, value: any, customTTL?: number): Promise<void> { await inMemoryClient.set(`docx:${key}`, JSON.stringify(value), 'EX', customTTL ?? 86400); },
  async del(key: string): Promise<void> { await inMemoryClient.del(`docx:${key}`); },
  async warmCache(keys: string[]): Promise<void> { void keys; },
  async getStats(): Promise<{ totalKeys: number; totalMemory: string }> { const keys = await inMemoryClient.keys('docx:*'); return { totalKeys: keys.length, totalMemory: '0' }; }
};

export default redisService;
export const redisInstance = redisService;

// Rate limiter stub always allows when using in-memory
export async function tryAcquireJobQuota(_options: any): Promise<boolean> {
  return true;
}
