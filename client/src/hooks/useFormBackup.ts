import { useCallback, useEffect, useRef } from 'react';
import { UseFormReset, UseFormWatch, FieldValues } from 'react-hook-form';
import { debounce } from 'lodash';

const MAX_BACKUPS = 5;

export interface FormBackup<T> {
  timestamp: string;
  data: T;
}

export function useFormBackup<T extends FieldValues>(
  formId: string,
  watch: UseFormWatch<T>,
  reset: UseFormReset<T>,
  options = { autoBackupInterval: 5 * 60 * 1000 } // Default 5 minutes
) {
  const backupIntervalRef = useRef<NodeJS.Timeout>();

  // Create a backup
  const createBackup = useCallback(
    (data: T) => {
      try {
        // Get existing backups
        const backupsJson = localStorage.getItem(`form_backups_${formId}`);
        const backups: FormBackup<T>[] = backupsJson ? JSON.parse(backupsJson) : [];

        // Add new backup
        const newBackup: FormBackup<T> = {
          timestamp: new Date().toISOString(),
          data,
        };

        // Keep only the most recent backups
        const updatedBackups = [newBackup, ...backups].slice(0, MAX_BACKUPS);
        localStorage.setItem(`form_backups_${formId}`, JSON.stringify(updatedBackups));

        return true;
      } catch (error) {
        console.error('Error creating form backup:', error);
        return false;
      }
    },
    [formId]
  );

  // Debounced backup function
  const debouncedBackup = useCallback(
    debounce((data: T) => {
      createBackup(data);
    }, 1000),
    [createBackup]
  );

  // Get all backups
  const getBackups = useCallback((): FormBackup<T>[] => {
    try {
      const backupsJson = localStorage.getItem(`form_backups_${formId}`);
      return backupsJson ? JSON.parse(backupsJson) : [];
    } catch (error) {
      console.error('Error getting form backups:', error);
      return [];
    }
  }, [formId]);

  // Recover from a specific backup
  const recoverBackup = useCallback(
    (timestamp: string) => {
      const backups = getBackups();
      const backup = backups.find((b) => b.timestamp === timestamp);
      if (backup) {
        reset(backup.data);
        return true;
      }
      return false;
    },
    [getBackups, reset]
  );

  // Recover from last backup
  const recoverLastBackup = useCallback(() => {
    const backups = getBackups();
    if (backups.length > 0) {
      reset(backups[0].data);
      return true;
    }
    return false;
  }, [getBackups, reset]);

  // Clear all backups
  const clearBackups = useCallback(() => {
    localStorage.removeItem(`form_backups_${formId}`);
  }, [formId]);

  // Setup auto-backup
  useEffect(() => {
    if (options.autoBackupInterval > 0) {
      backupIntervalRef.current = setInterval(() => {
        const formData = watch();
        createBackup(formData);
      }, options.autoBackupInterval);

      return () => {
        if (backupIntervalRef.current) {
          clearInterval(backupIntervalRef.current);
        }
      };
    }
  }, [watch, createBackup, options.autoBackupInterval]);

  // Watch for form changes and create backups
  useEffect(() => {
    const subscription = watch((value) => {
      debouncedBackup(value as T);
    });

    return () => subscription.unsubscribe();
  }, [watch, debouncedBackup]);

  return {
    createBackup,
    getBackups,
    recoverBackup,
    recoverLastBackup,
    clearBackups,
  };
}