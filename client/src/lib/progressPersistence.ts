import { useCallback, useEffect, useState, useRef } from 'react';
import { debounce } from './validation';

export interface ProgressState {
  lastSaved: Date | null;
  isDirty: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  saveProgress: number; // 0-100
  autoSaveEnabled: boolean;
  conflictDetected: boolean;
  lastLocalChange: Date | null;
  lastServerSync: Date | null;
}

export interface SavedState {
  id: string;
  timestamp: Date;
  data: any;
  version: number;
  checksum: string;
  metadata?: {
    userAgent: string;
    location: string;
    sessionId: string;
    [key: string]: any;
  };
}

export interface ProgressPersistenceOptions {
  autoSaveInterval?: number; // milliseconds
  maxLocalBackups?: number;
  conflictResolution?: 'local' | 'server' | 'merge' | 'prompt';
  enableVersioning?: boolean;
  enableCompression?: boolean;
}

// Local storage keys
const STORAGE_KEYS = {
  PROGRESS: 'resume_progress',
  BACKUP: 'resume_backup',
  SESSIONS: 'resume_sessions',
  PREFERENCES: 'autosave_preferences'
};

// Progress persistence hook
export function useProgressPersistence(
  dataId: string,
  data: any,
  onSave: (data: any) => Promise<void>,
  options: ProgressPersistenceOptions = {}
) {
  const {
    autoSaveInterval = 30000, // 30 seconds
    maxLocalBackups = 10,
    conflictResolution = 'prompt',
    enableVersioning = true,
    enableCompression = false
  } = options;

  const [progressState, setProgressState] = useState<ProgressState>({
    lastSaved: null,
    isDirty: false,
    isSaving: false,
    hasUnsavedChanges: false,
    saveProgress: 0,
    autoSaveEnabled: true,
    conflictDetected: false,
    lastLocalChange: null,
    lastServerSync: null
  });

  const [recoveryData, setRecoveryData] = useState<SavedState[]>([]);
  const lastDataRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const versionRef = useRef(1);
  const sessionIdRef = useRef(generateSessionId());

  // Initialize recovery data
  useEffect(() => {
    loadRecoveryData();
    loadPreferences();
    
    // Set up beforeunload handler
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (progressState.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [progressState.hasUnsavedChanges]);

  // Track data changes
  useEffect(() => {
    const dataChanged = JSON.stringify(data) !== JSON.stringify(lastDataRef.current);
    
    if (dataChanged && lastDataRef.current !== null) {
      setProgressState(prev => ({
        ...prev,
        isDirty: true,
        hasUnsavedChanges: true,
        lastLocalChange: new Date()
      }));

      // Save to local storage immediately
      saveToLocalStorage(data);
      
      // Schedule auto-save
      if (progressState.autoSaveEnabled) {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
          performAutoSave();
        }, autoSaveInterval);
      }
    }
    
    lastDataRef.current = data;
  }, [data, autoSaveInterval, progressState.autoSaveEnabled]);

  const loadRecoveryData = useCallback(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEYS.BACKUP}_${dataId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedState[];
        setRecoveryData(parsed.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      }
    } catch (error) {
      console.warn('Failed to load recovery data:', error);
    }
  }, [dataId]);

  const saveToLocalStorage = useCallback((dataToSave: any) => {
    try {
      const savedState: SavedState = {
        id: dataId,
        timestamp: new Date(),
        data: dataToSave,
        version: versionRef.current++,
        checksum: generateChecksum(dataToSave),
        metadata: {
          userAgent: navigator.userAgent,
          location: window.location.href,
          sessionId: sessionIdRef.current
        }
      };

      // Add to recovery data
      const newRecoveryData = [savedState, ...recoveryData]
        .slice(0, maxLocalBackups)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setRecoveryData(newRecoveryData);
      
      // Save to localStorage
      localStorage.setItem(
        `${STORAGE_KEYS.BACKUP}_${dataId}`,
        JSON.stringify(newRecoveryData.map(item => ({
          ...item,
          timestamp: item.timestamp.toISOString()
        })))
      );

      // Save current progress state
      localStorage.setItem(
        `${STORAGE_KEYS.PROGRESS}_${dataId}`,
        JSON.stringify({
          ...progressState,
          lastLocalChange: new Date().toISOString()
        })
      );

    } catch (error) {
      console.warn('Failed to save to local storage:', error);
    }
  }, [dataId, recoveryData, maxLocalBackups, progressState]);

  const performAutoSave = useCallback(async () => {
    if (!data || progressState.isSaving) return;

    setProgressState(prev => ({
      ...prev,
      isSaving: true,
      saveProgress: 0
    }));

    try {
      // Simulate progress updates
      const progressUpdates = [10, 30, 50, 70, 90];
      for (const progress of progressUpdates) {
        setProgressState(prev => ({ ...prev, saveProgress: progress }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await onSave(data);

      setProgressState(prev => ({
        ...prev,
        isSaving: false,
        isDirty: false,
        hasUnsavedChanges: false,
        lastSaved: new Date(),
        lastServerSync: new Date(),
        saveProgress: 100,
        conflictDetected: false
      }));

      // Clear progress after success
      setTimeout(() => {
        setProgressState(prev => ({ ...prev, saveProgress: 0 }));
      }, 2000);

    } catch (error) {
      console.error('Auto-save failed:', error);
      
      setProgressState(prev => ({
        ...prev,
        isSaving: false,
        saveProgress: 0,
        conflictDetected: true
      }));

      throw error;
    }
  }, [data, onSave, progressState.isSaving]);

  const manualSave = useCallback(async () => {
    return performAutoSave();
  }, [performAutoSave]);

  const recoverFromBackup = useCallback((backupId: string) => {
    const backup = recoveryData.find(item => 
      item.timestamp.toISOString() === backupId || item.checksum === backupId
    );
    
    if (backup) {
      return backup.data;
    }
    
    throw new Error('Backup not found');
  }, [recoveryData]);

  const clearBackups = useCallback(() => {
    setRecoveryData([]);
    localStorage.removeItem(`${STORAGE_KEYS.BACKUP}_${dataId}`);
    localStorage.removeItem(`${STORAGE_KEYS.PROGRESS}_${dataId}`);
  }, [dataId]);

  const toggleAutoSave = useCallback((enabled: boolean) => {
    setProgressState(prev => ({ ...prev, autoSaveEnabled: enabled }));
    
    // Save preference
    const preferences = {
      autoSaveEnabled: enabled,
      autoSaveInterval
    };
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    
    if (enabled && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, [autoSaveInterval]);

  const loadPreferences = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        const prefs = JSON.parse(stored);
        setProgressState(prev => ({
          ...prev,
          autoSaveEnabled: prefs.autoSaveEnabled ?? true
        }));
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
    }
  }, []);

  const getTimeSinceLastSave = useCallback(() => {
    if (!progressState.lastSaved) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - progressState.lastSaved.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return progressState.lastSaved.toLocaleDateString();
  }, [progressState.lastSaved]);

  const detectConflicts = useCallback(async () => {
    // This would typically check server timestamp vs local timestamp
    // For now, we'll simulate conflict detection
    const serverTimestamp = new Date(); // This would come from server
    const localTimestamp = progressState.lastLocalChange;
    
    if (localTimestamp && serverTimestamp > localTimestamp) {
      setProgressState(prev => ({ ...prev, conflictDetected: true }));
      return true;
    }
    
    return false;
  }, [progressState.lastLocalChange]);

  const resolveConflict = useCallback((resolution: 'local' | 'server' | 'merge') => {
    switch (resolution) {
      case 'local':
        performAutoSave();
        break;
      case 'server':
        // Reload from server - this would be implemented based on your API
        console.log('Resolving conflict: using server version');
        break;
      case 'merge':
        // Implement merge logic - this is application-specific
        console.log('Resolving conflict: merging changes');
        break;
    }
    
    setProgressState(prev => ({ ...prev, conflictDetected: false }));
  }, [performAutoSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    progressState,
    recoveryData,
    manualSave,
    recoverFromBackup,
    clearBackups,
    toggleAutoSave,
    getTimeSinceLastSave,
    detectConflicts,
    resolveConflict,
  };
}

// Progress indicator component hook
export function useProgressIndicator() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'saving' | 'loading' | 'processing' | 'syncing'>('saving');

  const show = useCallback((
    progressValue: number = 0, 
    messageText: string = '',
    indicatorType: typeof type = 'saving'
  ) => {
    setProgress(progressValue);
    setMessage(messageText);
    setType(indicatorType);
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setProgress(0);
    setMessage('');
  }, []);

  const update = useCallback((progressValue: number, messageText?: string) => {
    setProgress(progressValue);
    if (messageText !== undefined) {
      setMessage(messageText);
    }
  }, []);

  return {
    visible,
    progress,
    message,
    type,
    show,
    hide,
    update,
  };
}

// Utility functions
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Recovery manager for handling multiple recovery scenarios
export class RecoveryManager {
  private static instance: RecoveryManager;
  
  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }

  async scanForRecoveryData(): Promise<{[key: string]: SavedState[]}> {
    const recoveryData: {[key: string]: SavedState[]} = {};
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEYS.BACKUP)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          const id = key.replace(`${STORAGE_KEYS.BACKUP}_`, '');
          recoveryData[id] = data.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp)
          }));
        } catch (error) {
          console.warn(`Failed to parse recovery data for ${key}:`, error);
        }
      }
    }
    
    return recoveryData;
  }

  async cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = new Date(Date.now() - maxAge);
    const recoveryData = await this.scanForRecoveryData();
    
    for (const [id, backups] of Object.entries(recoveryData)) {
      const validBackups = backups.filter(backup => backup.timestamp > cutoff);
      
      if (validBackups.length !== backups.length) {
        localStorage.setItem(
          `${STORAGE_KEYS.BACKUP}_${id}`,
          JSON.stringify(validBackups.map(item => ({
            ...item,
            timestamp: item.timestamp.toISOString()
          })))
        );
      }
    }
  }

  async exportRecoveryData(): Promise<Blob> {
    const recoveryData = await this.scanForRecoveryData();
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: recoveryData
    };
    
    return new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
  }

  async importRecoveryData(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const importData = JSON.parse(reader.result as string);
          
          for (const [id, backups] of Object.entries(importData.data || {})) {
            localStorage.setItem(
              `${STORAGE_KEYS.BACKUP}_${id}`,
              JSON.stringify(backups)
            );
          }
          
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }
}