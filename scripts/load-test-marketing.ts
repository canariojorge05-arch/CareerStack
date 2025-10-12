/**
 * Load Test Script for Marketing Module
 * 
 * Tests the marketing module with multiple concurrent users
 * to verify performance improvements and scalability
 * 
 * Usage: npx tsx scripts/load-test-marketing.ts
 */

import http from 'http';
import https from 'https';

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT_USERS || '50');
const TEST_DURATION_MS = parseInt(process.env.TEST_DURATION_MS || '30000'); // 30 seconds
const RAMP_UP_MS = 5000; // Ramp up time - gradually increase load

// Test user credentials (replace with test user)
const TEST_USER = {
  username: process.env.TEST_USERNAME || 'test@example.com',
  password: process.env.TEST_PASSWORD || 'testpassword123'
};

interface TestResult {
  operation: string;
  success: boolean;
  duration: number;
  error?: string;
  statusCode?: number;
}

interface TestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  operationBreakdown: Record<string, {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  }>;
  errors: Record<string, number>;
}

class LoadTester {
  private results: TestResult[] = [];
  private authCookie: string = '';
  private startTime: number = 0;
  private activeUsers: number = 0;

  async authenticate(): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password
      });

      const url = new URL('/api/login', BASE_URL);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        const cookies = res.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          resolve(cookies[0].split(';')[0]);
        } else {
          reject(new Error('No auth cookie received'));
        }
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async makeRequest(method: string, path: string, body?: any): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const url = new URL(path, BASE_URL);
      const postData = body ? JSON.stringify(body) : undefined;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Cookie': this.authCookie,
          ...(postData && {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          })
        }
      };

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const duration = Date.now() - startTime;
          resolve({
            operation: `${method} ${path}`,
            success: res.statusCode! >= 200 && res.statusCode! < 400,
            duration,
            statusCode: res.statusCode,
            error: res.statusCode! >= 400 ? data : undefined
          });
        });
      });

      req.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          operation: `${method} ${path}`,
          success: false,
          duration,
          error: error.message
        });
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  // Simulate user operations
  async simulateUserSession(): Promise<void> {
    const operations = [
      // Read operations (GET requests)
      () => this.makeRequest('GET', '/api/marketing/consultants'),
      () => this.makeRequest('GET', '/api/marketing/requirements'),
      () => this.makeRequest('GET', '/api/marketing/interviews'),
      () => this.makeRequest('GET', '/api/marketing/consultants?page=1&limit=50'),
      () => this.makeRequest('GET', '/api/marketing/requirements?page=1&limit=50'),
      
      // Write operations (POST requests) - less frequent
      () => this.makeRequest('POST', '/api/marketing/consultants', {
        consultant: {
          status: 'Active',
          name: `Test User ${Date.now()}`,
          email: `test${Date.now()}@example.com`,
          phone: '+1234567890',
          visaStatus: 'H1B',
          address: 'Test Address',
          timezone: 'EST'
        },
        projects: [
          {
            projectName: 'Test Project',
            projectDomain: 'IT',
            projectCity: 'New York',
            projectState: 'NY',
            projectStartDate: '01/2023',
            projectEndDate: '12/2023',
            isCurrentlyWorking: false,
            projectDescription: 'Test project description for load testing'
          }
        ]
      }),
      
      () => this.makeRequest('POST', '/api/marketing/requirements', {
        single: true,
        jobTitle: `Test Job ${Date.now()}`,
        status: 'New',
        appliedFor: 'Rahul',
        primaryTechStack: 'React, Node.js',
        clientCompany: 'Test Company',
        completeJobDescription: 'This is a test job description for load testing purposes. It needs to be at least 50 characters long.'
      })
    ];

    // Weighted random selection (80% reads, 20% writes)
    const randomOperation = Math.random() < 0.8 
      ? operations[Math.floor(Math.random() * 5)] // Read operation
      : operations[5 + Math.floor(Math.random() * 2)]; // Write operation

    const result = await randomOperation();
    this.results.push(result);
  }

  async runUser(userId: number, duration: number): Promise<void> {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      await this.simulateUserSession();
      // Random delay between requests (100ms - 1s)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 900));
    }
  }

  async run(): Promise<TestStats> {
    console.log('🚀 Marketing Module Load Test Starting...\n');
    console.log(`📊 Configuration:`);
    console.log(`   - Base URL: ${BASE_URL}`);
    console.log(`   - Concurrent Users: ${CONCURRENT_USERS}`);
    console.log(`   - Test Duration: ${TEST_DURATION_MS / 1000}s`);
    console.log(`   - Ramp-up Time: ${RAMP_UP_MS / 1000}s\n`);

    try {
      console.log('🔐 Authenticating...');
      this.authCookie = await this.authenticate();
      console.log('✅ Authenticated successfully\n');
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      console.error('💡 Make sure the server is running and test user exists');
      process.exit(1);
    }

    this.startTime = Date.now();
    const userPromises: Promise<void>[] = [];

    console.log('👥 Starting user sessions...\n');

    // Ramp up users gradually
    const rampUpDelay = RAMP_UP_MS / CONCURRENT_USERS;
    
    for (let i = 0; i < CONCURRENT_USERS; i++) {
      await new Promise(resolve => setTimeout(resolve, rampUpDelay));
      this.activeUsers++;
      console.log(`   User ${i + 1}/${CONCURRENT_USERS} started (${this.activeUsers} active)`);
      userPromises.push(this.runUser(i, TEST_DURATION_MS - (i * rampUpDelay)));
    }

    console.log('\n⏱️  Test running...\n');

    // Show progress
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const requestCount = this.results.length;
      const rps = requestCount / elapsed;
      console.log(`   Elapsed: ${elapsed.toFixed(1)}s | Requests: ${requestCount} | RPS: ${rps.toFixed(1)}`);
    }, 5000);

    await Promise.all(userPromises);
    clearInterval(progressInterval);

    const totalDuration = (Date.now() - this.startTime) / 1000;
    console.log(`\n✅ Test completed in ${totalDuration.toFixed(2)}s\n`);

    return this.calculateStats();
  }

  calculateStats(): TestStats {
    const totalRequests = this.results.length;
    const successfulRequests = this.results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const durations = this.results.map(r => r.duration);
    const averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minResponseTime = Math.min(...durations);
    const maxResponseTime = Math.max(...durations);

    const totalDuration = (Date.now() - this.startTime) / 1000;
    const requestsPerSecond = totalRequests / totalDuration;

    // Operation breakdown
    const operationBreakdown: Record<string, any> = {};
    this.results.forEach(result => {
      if (!operationBreakdown[result.operation]) {
        operationBreakdown[result.operation] = {
          total: 0,
          successful: 0,
          failed: 0,
          totalDuration: 0
        };
      }
      const op = operationBreakdown[result.operation];
      op.total++;
      if (result.success) op.successful++;
      else op.failed++;
      op.totalDuration += result.duration;
    });

    // Calculate averages
    Object.keys(operationBreakdown).forEach(key => {
      const op = operationBreakdown[key];
      op.avgDuration = op.totalDuration / op.total;
      delete op.totalDuration;
    });

    // Error breakdown
    const errors: Record<string, number> = {};
    this.results.filter(r => !r.success).forEach(result => {
      const errorKey = result.error || `Status ${result.statusCode}`;
      errors[errorKey] = (errors[errorKey] || 0) + 1;
    });

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      operationBreakdown,
      errors
    };
  }

  printStats(stats: TestStats): void {
    console.log('📈 Load Test Results');
    console.log('═'.repeat(80));
    console.log(`\n🎯 Overall Performance:`);
    console.log(`   Total Requests:       ${stats.totalRequests}`);
    console.log(`   Successful:           ${stats.successfulRequests} (${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`   Failed:               ${stats.failedRequests} (${((stats.failedRequests / stats.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`   Requests/Second:      ${stats.requestsPerSecond.toFixed(2)}`);
    
    console.log(`\n⚡ Response Times:`);
    console.log(`   Average:              ${stats.averageResponseTime.toFixed(0)}ms`);
    console.log(`   Min:                  ${stats.minResponseTime}ms`);
    console.log(`   Max:                  ${stats.maxResponseTime}ms`);

    console.log(`\n📊 Operation Breakdown:`);
    Object.entries(stats.operationBreakdown).forEach(([operation, data]) => {
      const successRate = ((data.successful / data.total) * 100).toFixed(1);
      console.log(`\n   ${operation}:`);
      console.log(`      Total:     ${data.total}`);
      console.log(`      Success:   ${data.successful} (${successRate}%)`);
      console.log(`      Failed:    ${data.failed}`);
      console.log(`      Avg Time:  ${data.avgDuration.toFixed(0)}ms`);
    });

    if (Object.keys(stats.errors).length > 0) {
      console.log(`\n❌ Errors:`);
      Object.entries(stats.errors).forEach(([error, count]) => {
        console.log(`   ${error}: ${count} occurrences`);
      });
    }

    console.log('\n' + '═'.repeat(80));

    // Performance assessment
    const passThreshold = 95; // 95% success rate
    const successRate = (stats.successfulRequests / stats.totalRequests) * 100;
    const avgResponseOk = stats.averageResponseTime < 500; // Less than 500ms average
    const maxResponseOk = stats.maxResponseTime < 3000; // Less than 3s max

    console.log(`\n🎯 Performance Assessment:`);
    console.log(`   Success Rate:         ${successRate >= passThreshold ? '✅ PASS' : '❌ FAIL'} (${successRate.toFixed(1)}% >= ${passThreshold}%)`);
    console.log(`   Avg Response Time:    ${avgResponseOk ? '✅ PASS' : '❌ FAIL'} (${stats.averageResponseTime.toFixed(0)}ms < 500ms)`);
    console.log(`   Max Response Time:    ${maxResponseOk ? '✅ PASS' : '⚠️  WARNING'} (${stats.maxResponseTime}ms < 3000ms)`);
    console.log(`   Throughput:           ${stats.requestsPerSecond.toFixed(2)} req/s`);

    const overallPass = successRate >= passThreshold && avgResponseOk;
    console.log(`\n${overallPass ? '✅ Overall: PASS' : '❌ Overall: FAIL'} - ${overallPass ? 'System is scalable' : 'System needs optimization'}\n`);
  }
}

// Run the load test
async function main() {
  const tester = new LoadTester();
  try {
    const stats = await tester.run();
    tester.printStats(stats);
    process.exit(stats.successfulRequests / stats.totalRequests >= 0.95 ? 0 : 1);
  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

main();
