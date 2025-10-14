import { WebSocket } from 'ws';
import { logger } from '../utils/logger';

interface WebSocketConnection {
  ws: WebSocket;
  userId: string;
  accountIds: Set<string>;
  lastActivity: number;
  pingInterval?: NodeJS.Timeout;
}

export class EmailWebSocketManager {
  private connections: Map<string, WebSocketConnection> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly PING_INTERVAL = 30000;
  private readonly CONNECTION_TIMEOUT = 120000;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  addConnection(connectionId: string, ws: WebSocket, userId: string) {
    this.removeConnection(connectionId);

    const connection: WebSocketConnection = {
      ws,
      userId,
      accountIds: new Set(),
      lastActivity: Date.now(),
    };

    connection.pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, this.PING_INTERVAL);

    ws.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) {
        conn.lastActivity = Date.now();
      }
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        logger.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.removeConnection(connectionId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for connection ${connectionId}:`, error);
      this.removeConnection(connectionId);
    });

    this.connections.set(connectionId, connection);
    logger.info(`WebSocket connection added: ${connectionId} for user ${userId}`);
  }

  removeConnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (connection.pingInterval) {
        clearInterval(connection.pingInterval);
      }

      if (connection.ws.readyState === WebSocket.OPEN || connection.ws.readyState === WebSocket.CONNECTING) {
        connection.ws.close(1000, 'Connection closed by server');
      }

      this.connections.delete(connectionId);
      logger.info(`WebSocket connection removed: ${connectionId}`);
    }
  }

  private handleMessage(connectionId: string, message: any) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = Date.now();

    switch (message.type) {
      case 'subscribe_account':
        if (message.accountId) {
          connection.accountIds.add(message.accountId);
          logger.info(`User ${connection.userId} subscribed to account ${message.accountId}`);
        }
        break;

      case 'unsubscribe_account':
        if (message.accountId) {
          connection.accountIds.delete(message.accountId);
          logger.info(`User ${connection.userId} unsubscribed from account ${message.accountId}`);
        }
        break;

      case 'ping':
        this.sendMessage(connectionId, { type: 'pong' });
        break;
    }
  }

  sendMessage(connectionId: string, message: any) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error(`Error sending message to ${connectionId}:`, error);
      }
    }
  }

  broadcastToAccount(accountId: string, message: any) {
    let sentCount = 0;
    this.connections.forEach((connection, connectionId) => {
      if (connection.accountIds.has(accountId)) {
        this.sendMessage(connectionId, message);
        sentCount++;
      }
    });
    if (sentCount > 0) {
      logger.info(`Broadcast message to ${sentCount} connections for account ${accountId}`);
    }
  }

  broadcastToUser(userId: string, message: any) {
    let sentCount = 0;
    this.connections.forEach((connection, connectionId) => {
      if (connection.userId === userId) {
        this.sendMessage(connectionId, message);
        sentCount++;
      }
    });
    if (sentCount > 0) {
      logger.info(`Broadcast message to ${sentCount} connections for user ${userId}`);
    }
  }

  private cleanup() {
    const now = Date.now();
    const staleConnections: string[] = [];

    this.connections.forEach((connection, connectionId) => {
      if (now - connection.lastActivity > this.CONNECTION_TIMEOUT) {
        staleConnections.push(connectionId);
      }
    });

    staleConnections.forEach(connectionId => {
      logger.warn(`Removing stale connection: ${connectionId}`);
      this.removeConnection(connectionId);
    });

    if (staleConnections.length > 0) {
      logger.info(`Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getUserConnectionCount(userId: string): number {
    let count = 0;
    this.connections.forEach(connection => {
      if (connection.userId === userId) count++;
    });
    return count;
  }

  destroy() {
    this.connections.forEach((_, connectionId) => {
      this.removeConnection(connectionId);
    });
    clearInterval(this.cleanupInterval);
    logger.info('EmailWebSocketManager destroyed');
  }
}

export const emailWebSocketManager = new EmailWebSocketManager();
