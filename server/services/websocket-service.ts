import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { enhancedRedisService } from './enhanced-redis-service';
import { EventEmitter } from 'events';

interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
  documentId?: string;
  timestamp: number;
}

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  documentId?: string;
  lastActivity: Date;
}

interface DocumentSession {
  documentId: string;
  clients: Set<string>;
  lastUpdate: Date;
  content?: string;
}

class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ConnectedClient>();
  private documentSessions = new Map<string, DocumentSession>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      clientTracking: true
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    // Start heartbeat to keep connections alive
    this.startHeartbeat();

    logger.info('WebSocket service initialized');
  }

  private handleConnection(ws: WebSocket, request: any) {
    const clientId = this.generateClientId();
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const userId = url.searchParams.get('userId');
    const documentId = url.searchParams.get('documentId');

    if (!userId) {
      ws.close(1008, 'User ID required');
      return;
    }

    const client: ConnectedClient = {
      ws,
      userId,
      documentId: documentId || undefined,
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);

    // Join document session if specified
    if (documentId) {
      this.joinDocumentSession(clientId, documentId);
    }

    logger.info(`WebSocket client connected: ${clientId} (user: ${userId}, doc: ${documentId})`);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      payload: { clientId, timestamp: Date.now() },
      timestamp: Date.now()
    });

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}: ` + (error instanceof Error ? error.message : String(error)));
      this.handleDisconnection(clientId);
    });

    // Update activity on pong
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastActivity = new Date();
      }
    });
  }

  private handleMessage(clientId: string, data: any) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      client.lastActivity = new Date();

      const message: WebSocketMessage = JSON.parse(data.toString());
      message.userId = client.userId;
      message.timestamp = Date.now();

      logger.debug(`WebSocket message from ${clientId}: ${message.type}`);

      switch (message.type) {
        case 'join_document':
          this.handleJoinDocument(clientId, message);
          break;
        case 'leave_document':
          this.handleLeaveDocument(clientId, message);
          break;
        case 'document_update':
          this.handleDocumentUpdate(clientId, message);
          break;
        case 'autosave':
          this.handleAutosave(clientId, message);
          break;
        // Conversion progress handlers removed - no longer needed with SuperDoc
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            payload: { timestamp: Date.now() },
            timestamp: Date.now()
          });
          break;
        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }

    } catch (error) {
      logger.error(`Error handling WebSocket message from ${clientId}: ` + (error instanceof Error ? error.message : String(error)));
    }
  }

  private handleJoinDocument(clientId: string, message: WebSocketMessage) {
    const { documentId } = message.payload;
    if (!documentId) return;

    this.joinDocumentSession(clientId, documentId);
    
    // Notify other clients in the document
    this.broadcastToDocument(documentId, {
      type: 'user_joined',
      payload: { 
        userId: message.userId,
        documentId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }, clientId);
  }

  private handleLeaveDocument(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    const documentId = client.documentId;
    this.leaveDocumentSession(clientId);

    // Notify other clients
    this.broadcastToDocument(documentId, {
      type: 'user_left',
      payload: { 
        userId: message.userId,
        documentId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });
  }

  private async handleDocumentUpdate(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    const { content, operation, cursor } = message.payload;
    const documentId = client.documentId;

    // Update document session
    const session = this.documentSessions.get(documentId);
    if (session) {
      session.lastUpdate = new Date();
      if (content !== undefined) {
        session.content = content;
      }
    }

    // Cache the update
    try {
      await enhancedRedisService.set(
        `doc_update:${documentId}`,
        {
          content,
          operation,
          cursor,
          userId: client.userId,
          timestamp: Date.now()
        },
        { ttl: 300, namespace: 'realtime' } // 5 minutes
      );
    } catch (error) {
      logger.error('Failed to cache document update: ' + (error instanceof Error ? error.message : String(error)));
    }

    // Broadcast to other clients in the document
    this.broadcastToDocument(documentId, {
      type: 'document_updated',
      payload: {
        content,
        operation,
        cursor,
        userId: client.userId,
        documentId,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }, clientId);
  }

  private async handleAutosave(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { content, documentId } = message.payload;

    try {
      // Cache autosave data
      await enhancedRedisService.set(
        `autosave:${documentId}:${client.userId}`,
        {
          content,
          timestamp: Date.now(),
          userId: client.userId
        },
        { ttl: 3600, namespace: 'autosave' } // 1 hour
      );

      // Confirm autosave to client
      this.sendToClient(clientId, {
        type: 'autosave_complete',
        payload: {
          documentId,
          timestamp: Date.now(),
          status: 'success'
        },
        timestamp: Date.now()
      });

      // Notify other clients about autosave
      if (client.documentId === documentId) {
        this.broadcastToDocument(documentId, {
          type: 'autosave_notification',
          payload: {
            userId: client.userId,
            documentId,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        }, clientId);
      }

    } catch (error) {
      logger.error('Autosave failed: ' + (error instanceof Error ? error.message : String(error)));
      
      this.sendToClient(clientId, {
        type: 'autosave_error',
        payload: {
          documentId,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      });
    }
  }

  // Conversion progress handler removed - no longer needed with SuperDoc

  private handleDisconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.info(`WebSocket client disconnected: ${clientId}`);

    // Leave document session
    if (client.documentId) {
      this.leaveDocumentSession(clientId);
      
      // Notify other clients
      this.broadcastToDocument(client.documentId, {
        type: 'user_left',
        payload: { 
          userId: client.userId,
          documentId: client.documentId,
          timestamp: Date.now()
        },
        timestamp: Date.now()
      });
    }

    this.clients.delete(clientId);
  }

  private joinDocumentSession(clientId: string, documentId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update client's document
    client.documentId = documentId;

    // Get or create document session
    let session = this.documentSessions.get(documentId);
    if (!session) {
      session = {
        documentId,
        clients: new Set(),
        lastUpdate: new Date()
      };
      this.documentSessions.set(documentId, session);
    }

    session.clients.add(clientId);
    logger.debug(`Client ${clientId} joined document ${documentId}`);
  }

  private leaveDocumentSession(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client || !client.documentId) return;

    const session = this.documentSessions.get(client.documentId);
    if (session) {
      session.clients.delete(clientId);
      
      // Clean up empty sessions
      if (session.clients.size === 0) {
        this.documentSessions.delete(client.documentId);
      }
    }

    client.documentId = undefined;
  }

  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}: ` + (error instanceof Error ? error.message : String(error)));
    }
  }

  private broadcastToDocument(documentId: string, message: WebSocketMessage, excludeClientId?: string) {
    const session = this.documentSessions.get(documentId);
    if (!session) return;

    for (const clientId of session.clients) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private broadcastToUser(userId: string, message: WebSocketMessage, excludeClientId?: string) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId && clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private broadcastToAll(message: WebSocketMessage, excludeClientId?: string) {
    for (const clientId of this.clients.keys()) {
      if (clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 30000; // 30 seconds

      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceActivity = now.getTime() - client.lastActivity.getTime();
        
        if (timeSinceActivity > staleThreshold) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          } else {
            this.handleDisconnection(clientId);
          }
        }
      }
    }, 15000); // Check every 15 seconds
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external use
  // Conversion notification methods removed - no longer needed with SuperDoc

  public notifySystemMessage(message: string, type: 'info' | 'warning' | 'error' = 'info') {
    this.broadcastToAll({
      type: 'system_message',
      payload: { message, type },
      timestamp: Date.now()
    });
  }

  public getStats() {
    return {
      connectedClients: this.clients.size,
      activeSessions: this.documentSessions.size,
      clients: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        userId: client.userId,
        documentId: client.documentId,
        lastActivity: client.lastActivity
      })),
      sessions: Array.from(this.documentSessions.entries()).map(([id, session]) => ({
        documentId: id,
        clientCount: session.clients.size,
        lastUpdate: session.lastUpdate
      }))
    };
  }

  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all connections
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close(1001, 'Server shutting down');
    }

    if (this.wss) {
      this.wss.close();
    }

    this.clients.clear();
    this.documentSessions.clear();

    logger.info('WebSocket service shut down');
  }
}

export const websocketService = new WebSocketService();
