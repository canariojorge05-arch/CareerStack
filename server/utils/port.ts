import { createServer } from 'http';
import { logger } from './logger';

export async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  let port = startPort;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      await new Promise((resolve, reject) => {
        const server = createServer()
          .listen(port, () => {
            server.close();
            resolve(port);
          })
          .on('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
              port++;
              attempts++;
              resolve(null);
            } else {
              reject(err);
            }
          });
      });

      if (port !== startPort) {
        logger.info(`Port ${startPort} was in use, using port ${port} instead`);
      }
      return port;
    } catch (err) {
      attempts++;
      port++;
    }
  }
  
  throw new Error(`No available ports found after ${maxAttempts} attempts starting from ${startPort}`);
}