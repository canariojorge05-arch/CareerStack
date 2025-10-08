import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface WebSocketMessage {
  type: string;
  payload: any;
  userId?: string;
  documentId?: string;
  timestamp: number;
}

interface WebSocketOptions {
  userId: string;
  documentId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export function useWebSocket(options: WebSocketOptions) {
  const {
    userId,
    documentId,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    reconnectAttempts: 0
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const params = new URLSearchParams({ userId });
    if (documentId) {
      params.append('documentId', documentId);
    }

    const wsUrl = `${protocol}//${host}/ws?${params.toString()}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState(prev => ({ 
          ...prev, 
          connected: true, 
          connecting: false, 
          error: null,
          reconnectAttempts: 0 
        }));
        
        onConnect?.();
        startHeartbeat();
        
        // Send initial ping
        sendMessage({ type: 'ping', payload: {}, timestamp: Date.now() });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle system messages
          if (message.type === 'pong') {
            // Heartbeat response - connection is alive
            return;
          }
          
          if (message.type === 'system_message') {
            const { message: text, type: msgType } = message.payload;
            if (msgType === 'error') {
              toast.error(text);
            } else if (msgType === 'warning') {
              toast.warning(text);
            } else {
              toast.info(text);
            }
            return;
          }

          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        setState(prev => ({ ...prev, connected: false, connecting: false }));
        stopHeartbeat();
        onDisconnect?.();

        // Auto-reconnect if enabled and not a clean close
        if (autoReconnect && event.code !== 1000) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        setState(prev => ({ 
          ...prev, 
          error: 'Connection error', 
          connecting: false 
        }));
        onError?.(error);
      };

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to create WebSocket connection', 
        connecting: false 
      }));
    }
  }, [userId, documentId, onConnect, onDisconnect, onError, onMessage, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      connected: false, 
      connecting: false,
      reconnectAttempts: 0 
    }));
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (state.reconnectAttempts >= maxReconnectAttempts) {
      setState(prev => ({ 
        ...prev, 
        error: 'Max reconnection attempts reached' 
      }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      reconnectAttempts: prev.reconnectAttempts + 1 
    }));

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectInterval * Math.pow(2, state.reconnectAttempts)); // Exponential backoff
  }, [connect, state.reconnectAttempts, maxReconnectAttempts, reconnectInterval]);

  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping', payload: {}, timestamp: Date.now() });
      }
    }, 30000); // 30 seconds
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'userId'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fullMessage: WebSocketMessage = {
        ...message,
        userId,
        timestamp: Date.now()
      };
      wsRef.current.send(JSON.stringify(fullMessage));
      return true;
    }
    return false;
  }, [userId]);

  // Document-specific methods
  const joinDocument = useCallback((docId: string) => {
    return sendMessage({
      type: 'join_document',
      payload: { documentId: docId },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  const leaveDocument = useCallback((docId: string) => {
    return sendMessage({
      type: 'leave_document',
      payload: { documentId: docId },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  const sendDocumentUpdate = useCallback((content: string, operation?: any, cursor?: any) => {
    return sendMessage({
      type: 'document_update',
      payload: { content, operation, cursor },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  const sendAutosave = useCallback((content: string, docId: string) => {
    return sendMessage({
      type: 'autosave',
      payload: { content, documentId: docId },
      timestamp: Date.now()
    });
  }, [sendMessage]);


  // Initialize connection
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle document changes
  useEffect(() => {
    if (state.connected && documentId) {
      joinDocument(documentId);
      
      return () => {
        leaveDocument(documentId);
      };
    }
  }, [state.connected, documentId, joinDocument, leaveDocument]);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    joinDocument,
    leaveDocument,
    sendDocumentUpdate,
    sendAutosave,
  };
}


// Hook for document collaboration
export function useDocumentCollaboration(documentId: string, userId: string) {
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [documentUpdates, setDocumentUpdates] = useState<any[]>([]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'user_joined') {
      const { userId: joinedUserId, documentId: docId } = message.payload;
      if (docId === documentId && joinedUserId !== userId) {
        setCollaborators(prev => [...new Set([...prev, joinedUserId])]);
        toast.info(`${joinedUserId} joined the document`);
      }
    } else if (message.type === 'user_left') {
      const { userId: leftUserId, documentId: docId } = message.payload;
      if (docId === documentId) {
        setCollaborators(prev => prev.filter(id => id !== leftUserId));
        toast.info(`${leftUserId} left the document`);
      }
    } else if (message.type === 'document_updated') {
      const { userId: updateUserId, documentId: docId } = message.payload;
      if (docId === documentId && updateUserId !== userId) {
        setDocumentUpdates(prev => [...prev, message.payload]);
      }
    } else if (message.type === 'autosave_notification') {
      const { userId: saveUserId, documentId: docId } = message.payload;
      if (docId === documentId && saveUserId !== userId) {
        toast.success(`Document auto-saved by ${saveUserId}`, { duration: 2000 });
      }
    }
  }, [documentId, userId]);

  return {
    collaborators,
    documentUpdates,
    handleMessage
  };
}
