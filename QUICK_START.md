# ⚡ Quick Start Guide - Production Features

## 🚀 Getting Started in 5 Minutes

### 1. Setup Environment

```bash
# Copy production config
cp .env.production.example .env.production

# Edit with your values
nano .env.production

# Required values:
# - DATABASE_URL
# - REDIS_URL
# - JWT_SECRET
# - JWT_REFRESH_SECRET
# - GOOGLE_CLIENT_ID (for Gmail)
```

### 2. Start Services

```bash
# Option A: Development
npm run dev

# Option B: Production with PM2
npm run build
npm run pm2:start

# Option C: Docker
docker-compose up -d
```

### 3. Verify Setup

```bash
# Check health
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": { "healthy": true },
    "redis": { "healthy": true },
    "queues": { "healthy": true }
  }
}
```

---

## 📚 Common Operations

### Using the New Caching System

```typescript
import { CacheService, CACHE_TTL } from './server/config/redis';

// Get from cache
const user = await CacheService.get('user:123');

// Set with TTL
await CacheService.set('user:123', userData, CACHE_TTL.MEDIUM);

// Get or fetch pattern
const data = await CacheService.getOrSet(
  'expensive-query',
  async () => await fetchExpensiveData(),
  CACHE_TTL.LONG
);

// Delete pattern
await CacheService.delPattern('user:*');
```

### Using Rate Limiting

```typescript
import { createRateLimiter } from './server/middleware/rateLimiter';

// Apply to route
app.post('/api/email/send',
  emailSendRateLimiter,  // Pre-built limiter
  async (req, res) => {
    // Your code
  }
);

// Create custom limiter
const customLimiter = createRateLimiter({
  windowMs: 60000,  // 1 minute
  max: 10,          // 10 requests
  keyGenerator: (req) => req.user.id,
});
```

### Using Queue Manager

```typescript
import QueueManager from './server/services/queueManager';

// Add email to send queue
await QueueManager.addEmailSendJob({
  accountId: 'account-123',
  userId: 'user-456',
  to: ['recipient@example.com'],
  subject: 'Hello',
  htmlBody: '<p>Message</p>',
});

// Add sync job
await QueueManager.addEmailSyncJob({
  accountId: 'account-123',
  userId: 'user-456',
  fullSync: false,
});

// Get queue stats
const stats = await QueueManager.getQueueStats('email:send');
console.log(stats);  // { waiting: 5, active: 2, completed: 100 }
```

### Using Multi-Account Service

```typescript
import EmailAccountService from './server/services/emailAccountService';

// Get user accounts (cached)
const accounts = await EmailAccountService.getUserAccounts(userId);

// Send email via specific account
const result = await EmailAccountService.sendEmailViaAccount(
  accountId,
  {
    to: ['recipient@example.com'],
    subject: 'Hello',
    htmlBody: '<p>Message</p>',
  }
);

// Sync account (rate-limited)
await EmailAccountService.syncAccount(accountId);

// Fetch from multiple accounts in parallel
const emails = await EmailAccountService.fetchEmailsForMultipleAccounts(
  ['account-1', 'account-2', 'account-3'],
  { limit: 50, offset: 0 }
);
```

### Using JWT Authentication

```typescript
import jwtAuth from './server/middleware/jwtAuth';

// Protect route
app.get('/api/profile',
  jwtAuth.jwtAuthMiddleware,  // Require auth
  async (req, res) => {
    const user = req.user;  // User from token
    res.json(user);
  }
);

// Require specific role
app.get('/api/admin',
  jwtAuth.jwtAuthMiddleware,
  jwtAuth.requireRole('admin'),
  async (req, res) => {
    // Admin only
  }
);

// Refresh token endpoint
app.post('/api/auth/refresh', jwtAuth.refreshTokenHandler);

// Logout
app.post('/api/auth/logout',
  jwtAuth.jwtAuthMiddleware,
  jwtAuth.logoutHandler
);
```

### Using Monitoring Service

```typescript
import MonitoringService from './server/services/monitoringService';

// Get current metrics
const metrics = await MonitoringService.getSystemMetrics();
console.log(metrics);
// {
//   cpu: { usage: 45, loadAverage: [2.1, 1.8, 1.5] },
//   memory: { usagePercent: 62, used: 524288000 },
//   ...
// }

// Perform health check
const health = await MonitoringService.performHealthCheck();
console.log(health.status);  // 'healthy' | 'degraded' | 'unhealthy'

// Get metrics summary
const summary = MonitoringService.getMetricsSummary();
console.log(summary.current, summary.average, summary.peak);
```

---

## 🔧 Configuration Examples

### Database Optimization

```typescript
// server/config/database.ts
// Already configured! But you can adjust:

// In .env.production:
DB_MAX_CONNECTIONS=20      # Increase for more users
DB_MIN_CONNECTIONS=5       # Keep some connections warm
CPU_CORES=4               # Auto-detects if not set
```

### Redis Configuration

```typescript
// For single instance (default)
REDIS_URL=redis://localhost:6379
REDIS_CLUSTER=false

// For cluster (high availability)
REDIS_CLUSTER=true
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### PM2 Scaling

```bash
# Scale to specific number
pm2 scale email-app 4

# Scale up by 2
pm2 scale email-app +2

# Scale down by 1
pm2 scale email-app -1

# Use all CPUs
pm2 scale email-app max
```

---

## 📊 Monitoring Dashboard

### Health Endpoints

```bash
# Overall health
curl http://localhost:3000/health

# Readiness (for load balancer)
curl http://localhost:3000/health/ready

# Liveness (is running?)
curl http://localhost:3000/health/live
```

### Metrics (Admin Only)

```bash
# Get detailed metrics
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3000/metrics | jq

# Response includes:
# - System metrics (CPU, memory, disk)
# - Database stats (connections, queries)
# - Redis stats (hit rate, memory)
# - Queue stats (jobs pending, processed)
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# List processes
pm2 list

# Detailed info
pm2 describe email-app

# View logs
pm2 logs email-app --lines 100

# Web dashboard
pm2 web
# Open http://localhost:9615
```

---

## 🐛 Troubleshooting

### Issue: High Memory Usage

```bash
# Check memory
pm2 describe email-app

# Solution 1: Trigger GC manually
curl -X POST http://localhost:3000/admin/gc

# Solution 2: Reload process
pm2 reload email-app

# Solution 3: Increase memory limit
# In ecosystem.config.js:
max_memory_restart: '2G'
```

### Issue: Database Connection Pool Exhausted

```bash
# Check pool status
curl http://localhost:3000/health | jq '.checks.database.connections'

# Solution: Increase pool size
# In .env.production:
DB_MAX_CONNECTIONS=30

# Then reload
pm2 reload email-app
```

### Issue: Redis Connection Failed

```bash
# Check Redis
redis-cli ping

# Check connection in app
curl http://localhost:3000/health | jq '.checks.redis'

# Restart Redis
docker-compose restart redis
# or
sudo systemctl restart redis
```

### Issue: Queue Jobs Not Processing

```bash
# Check queue stats
curl http://localhost:3000/metrics | jq '.queues'

# View BullMQ board
# Open http://localhost:3001 (if using docker-compose)

# Solution: Restart workers
pm2 reload email-app
```

---

## 🔐 Security Checklist

Before going live:

```bash
# 1. Change all secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# 2. Enable production mode
NODE_ENV=production

# 3. Enable security features
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true

# 4. Configure CORS for your domain
CORS_ORIGIN=https://yourdomain.com

# 5. Use SSL in production
# Configure NGINX or load balancer for HTTPS
```

---

## 📈 Performance Tips

### 1. Database
```sql
-- Run these periodically
ANALYZE;
VACUUM;

-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### 2. Redis
```bash
# Monitor Redis
redis-cli --stat

# Check memory
redis-cli INFO memory

# Clear cache if needed (dev only!)
redis-cli FLUSHALL
```

### 3. Application
```bash
# Monitor response times
pm2 describe email-app | grep "Mean latency"

# Check for memory leaks
node --inspect dist/index.js
# Then open chrome://inspect
```

---

## 🎯 Common Patterns

### Pattern 1: Cache-Aside

```typescript
async function getUser(id: string) {
  return await CacheService.getOrSet(
    `user:${id}`,
    async () => {
      return await db.query.users.findFirst({
        where: eq(users.id, id)
      });
    },
    CACHE_TTL.LONG
  );
}
```

### Pattern 2: Queue Processing

```typescript
// Don't wait for slow operations
app.post('/api/email/sync', async (req, res) => {
  // Queue the job (returns immediately)
  await QueueManager.addEmailSyncJob({...});
  
  // Return success
  res.json({ message: 'Sync started', queued: true });
});
```

### Pattern 3: Rate Limiting with Retry

```typescript
const rateLimit = await EmailAccountService.checkAccountRateLimit(
  accountId,
  'send'
);

if (!rateLimit.allowed) {
  return res.status(429).json({
    error: 'Rate limit exceeded',
    retryAfter: rateLimit.resetAt,
    remaining: 0,
  });
}

// Proceed with operation
```

---

## 📖 Additional Resources

- **Full Guide**: See `PRODUCTION_READY_GUIDE.md`
- **Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Gmail API Docs**: https://developers.google.com/gmail/api
- **PM2 Docs**: https://pm2.keymetrics.io/
- **Redis Docs**: https://redis.io/documentation

---

## ✅ You're Ready!

Your application now has:
- ✅ Enterprise-grade caching
- ✅ Advanced rate limiting
- ✅ Background job processing
- ✅ Resource monitoring
- ✅ Auto-scaling
- ✅ Security best practices
- ✅ 100+ user capacity

**Start building! 🚀**

---

Need help? Check the docs or open an issue on GitHub.
