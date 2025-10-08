module.exports = {
  apps: [
    {
      name: 'resume-customizer-pro',
      script: 'dist/index.js',
      instances: process.env.MIN_INSTANCES || 2,
      exec_mode: 'cluster',
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/pm2/error.log',
      out_file: './logs/pm2/out.log',
      merge_logs: true,
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,

      // Auto-scaling configuration
      instances: 'max',
      instance_var: 'INSTANCE_ID',
      pmx: true,
      automation: true,

      // Load balancing
      exec_mode: 'cluster',
      wait_ready: true,
      listen_timeout: 3000,

      // Health checks
      status_endpoint: '/health',
      healthcheck_endpoint: '/health',

      // Metrics for auto-scaling
      metrics: {
        transaction_processing: true,
        http: true,
        runtime: true,
        eventLoop: true,
        network: true,
        v8: true,
      },

      // Auto-scaling rules
      scaling: {
        max: process.env.MAX_INSTANCES || 10,
        min: process.env.MIN_INSTANCES || 2,
        rules: [
          {
            metric: 'cpu',
            threshold: process.env.SCALE_CPU_THRESHOLD || 70,
            above: true,
            action: 'up',
            value: 1,
          },
          {
            metric: 'memory',
            threshold: 80,
            above: true,
            action: 'up',
            value: 1,
          },
        ],
      },
    },
  ],
  deploy: {
    production: {
      key: '~/.ssh/id_rsa',
      user: 'ubuntu',
      host: ['prod-1', 'prod-2'],
      ref: 'origin/main',
      repo: 'git@github.com:username/resume-customizer-pro.git',
      path: '/var/www/resume-customizer-pro',
      'post-deploy':
        'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
