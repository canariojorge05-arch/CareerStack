import React, { useState } from 'react';
import {
  Clock,
  Save,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings,
  Download,
  Upload,
  X,
  History,
  Trash2,
  AlertTriangle,
  Loader,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  ProgressState,
  SavedState,
  useProgressIndicator,
  RecoveryManager,
} from '../../lib/progressPersistence';

export interface ProgressIndicatorProps {
  progressState: ProgressState;
  recoveryData: SavedState[];
  onSave?: () => Promise<void>;
  onRecover?: (backupId: string) => void;
  onToggleAutoSave?: (enabled: boolean) => void;
  onClearBackups?: () => void;
  onResolveConflict?: (resolution: 'local' | 'server' | 'merge') => void;
  getTimeSinceLastSave?: () => string | null;
  className?: string;
}

export function ProgressIndicator({
  progressState,
  recoveryData,
  onSave,
  onRecover,
  onToggleAutoSave,
  onClearBackups,
  onResolveConflict,
  getTimeSinceLastSave,
  className = ''
}: ProgressIndicatorProps) {
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<SavedState | null>(null);

  const getSaveStatusIcon = () => {
    if (progressState.isSaving) {
      return <Loader className="w-4 h-4 animate-spin text-blue-500" />;
    }
    
    if (progressState.conflictDetected) {
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    }
    
    if (progressState.hasUnsavedChanges) {
      return <Clock className="w-4 h-4 text-orange-500" />;
    }
    
    if (progressState.lastSaved) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    return <Save className="w-4 h-4 text-gray-400" />;
  };

  const getSaveStatusText = () => {
    if (progressState.isSaving) {
      return `Saving... ${progressState.saveProgress}%`;
    }
    
    if (progressState.conflictDetected) {
      return 'Sync conflict detected';
    }
    
    if (progressState.hasUnsavedChanges) {
      return 'Unsaved changes';
    }
    
    const timeSince = getTimeSinceLastSave?.();
    if (timeSince) {
      return `Saved ${timeSince}`;
    }
    
    return 'Not saved yet';
  };

  const getSaveStatusColor = () => {
    if (progressState.isSaving) return 'text-blue-600';
    if (progressState.conflictDetected) return 'text-amber-600';
    if (progressState.hasUnsavedChanges) return 'text-orange-600';
    if (progressState.lastSaved) return 'text-green-600';
    return 'text-gray-500';
  };

  const handleExportBackups = async () => {
    try {
      const manager = RecoveryManager.getInstance();
      const blob = await manager.exportRecoveryData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-backups-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export backups:', error);
    }
  };

  const handleImportBackups = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const manager = RecoveryManager.getInstance();
    manager.importRecoveryData(file)
      .then(() => {
        alert('Backups imported successfully');
        window.location.reload(); // Refresh to load new backups
      })
      .catch(error => {
        console.error('Failed to import backups:', error);
        alert('Failed to import backups');
      });
  };

  return (
    <>
      <div className={`flex items-center gap-3 px-4 py-2 bg-white border-t border-gray-200 ${className}`}>
        {/* Save Status */}
        <div className="flex items-center gap-2">
          {getSaveStatusIcon()}
          <span className={`text-sm ${getSaveStatusColor()}`}>
            {getSaveStatusText()}
          </span>
        </div>

        {/* Progress Bar (when saving) */}
        {progressState.isSaving && (
          <div className="flex-1 max-w-48">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${progressState.saveProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="flex items-center gap-1">
          {navigator.onLine ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Manual Save Button */}
          <button
            onClick={onSave}
            disabled={progressState.isSaving || !progressState.hasUnsavedChanges}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save now"
          >
            <Save className="w-4 h-4" />
          </button>

          {/* Recovery Button */}
          {recoveryData.length > 0 && (
            <button
              onClick={() => setShowRecoveryModal(true)}
              className="p-1.5 rounded hover:bg-gray-100"
              title="View recovery options"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {/* Conflict Resolution */}
          {progressState.conflictDetected && (
            <div className="flex gap-1">
              <button
                onClick={() => onResolveConflict?.('local')}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Use local version"
              >
                Local
              </button>
              <button
                onClick={() => onResolveConflict?.('server')}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                title="Use server version"
              >
                Server
              </button>
            </div>
          )}

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded hover:bg-gray-100"
            title="Auto-save settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Recovery Options</h3>
              <button
                onClick={() => setShowRecoveryModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {recoveryData.map((backup, index) => (
                  <div
                    key={backup.checksum}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        Version {backup.version}
                      </div>
                      <div className="text-xs text-gray-500">
                        {backup.timestamp.toLocaleString()}
                      </div>
                      {backup.metadata && (
                        <div className="text-xs text-gray-400 mt-1">
                          Session: {backup.metadata.sessionId?.slice(0, 8)}...
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedBackup(backup)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => {
                          onRecover?.(backup.checksum);
                          setShowRecoveryModal(false);
                        }}
                        className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <div className="flex gap-2">
                <button
                  onClick={handleExportBackups}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-white"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                
                <label className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded hover:bg-white cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackups}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear all backups?')) {
                    onClearBackups?.();
                    setShowRecoveryModal(false);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Preview Modal */}
      {selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Backup Preview - Version {selectedBackup.version}
              </h3>
              <button
                onClick={() => setSelectedBackup(null)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">
                {JSON.stringify(selectedBackup.data, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                <div>Created: {selectedBackup.timestamp.toLocaleString()}</div>
                <div>Checksum: {selectedBackup.checksum}</div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedBackup(null)}
                  className="px-4 py-2 text-sm border rounded hover:bg-white"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onRecover?.(selectedBackup.checksum);
                    setSelectedBackup(null);
                    setShowRecoveryModal(false);
                  }}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Restore This Version
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Auto-Save Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Auto-Save Enabled</label>
                <button
                  onClick={() => onToggleAutoSave?.(!progressState.autoSaveEnabled)}
                  className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                    progressState.autoSaveEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                      progressState.autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status Information</label>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Auto-Save: {progressState.autoSaveEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div>Backups Available: {recoveryData.length}</div>
                  <div>Connection: {navigator.onLine ? 'Online' : 'Offline'}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-sm border rounded hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ProgressIndicator;