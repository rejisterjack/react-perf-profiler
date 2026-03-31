/**
 * Cloud Sync Panel
 * UI for configuring and managing cloud sync
 * @module panel/components/Cloud/CloudSyncPanel
 */

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { getCloudSyncManager } from '@/shared/cloud/CloudSyncManager';
import type { CloudSyncConfig, CloudSyncState, CloudProfileInfo } from '@/shared/cloud/types';
import { logger } from '@/shared/logger';
import styles from './CloudSyncPanel.module.css';

/**
 * Cloud Sync Panel Component
 */
export const CloudSyncPanel: React.FC = () => {
  const [config, setConfig] = useState<CloudSyncConfig | null>(null);
  const [state, setState] = useState<CloudSyncState | null>(null);
  const [profiles, setProfiles] = useState<CloudProfileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'profiles' | 'status'>('settings');

  // Form states
  const [provider, setProvider] = useState<CloudSyncConfig['provider']>('local');
  const [s3Config, setS3Config] = useState({
    endpoint: '',
    bucket: '',
    region: '',
    accessKeyId: '',
    folder: '',
  });
  const [dropboxConfig, setDropboxConfig] = useState({
    appKey: '',
    folder: 'react-perf-profiles',
  });
  const [gdriveConfig, setGdriveConfig] = useState({
    clientId: '',
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(60);

  const cloudManager = getCloudSyncManager();

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = cloudManager.subscribe((newState) => {
      setState(newState);
    });

    // Initial load
    const initialConfig = cloudManager.getConfig();
    if (initialConfig) {
      setConfig(initialConfig);
      setProvider(initialConfig.provider);
      setAutoSyncEnabled(initialConfig.autoSync?.enabled ?? false);
      setAutoSyncInterval(initialConfig.autoSync?.interval ?? 60);
    }

    setState(cloudManager.getState());

    return unsubscribe;
  }, [cloudManager]);

  // Load profiles when switching to profiles tab
  useEffect(() => {
    if (activeTab === 'profiles' && cloudManager.isReady()) {
      loadProfiles();
    }
  }, [activeTab]);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await cloudManager.listProfiles({ limit: 50 });
    
    if (result.success && result.profiles) {
      setProfiles(result.profiles);
    } else {
      setError(result.error || 'Failed to load profiles');
    }

    setIsLoading(false);
  }, [cloudManager]);

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setError(null);

    let settings: CloudSyncConfig['settings'];

    switch (provider) {
      case 's3':
        settings = {
          type: 's3',
          endpoint: s3Config.endpoint,
          bucket: s3Config.bucket,
          region: s3Config.region,
          accessKeyId: s3Config.accessKeyId,
          usePresignedUrls: !s3Config.accessKeyId,
          folder: s3Config.folder || undefined,
        };
        break;
      case 'dropbox':
        settings = {
          type: 'dropbox',
          appKey: dropboxConfig.appKey,
          folder: dropboxConfig.folder,
        };
        break;
      case 'google-drive':
        settings = {
          type: 'google-drive',
          clientId: gdriveConfig.clientId,
        };
        break;
      case 'local':
      default:
        settings = {
          type: 'local',
          maxStorageSize: 50 * 1024 * 1024,
          storageKey: 'react-perf-profiles',
        };
    }

    const newConfig: CloudSyncConfig = {
      enabled: true,
      provider,
      settings,
      autoSync: {
        enabled: autoSyncEnabled,
        interval: autoSyncInterval,
        onExport: true,
      },
    };

    const success = await cloudManager.initialize(newConfig);

    if (success) {
      setConfig(newConfig);
      logger.info('Cloud sync configured successfully', { source: 'CloudSyncPanel' });
    } else {
      setError('Authentication failed. Please check your credentials.');
    }

    setIsLoading(false);
  };

  const handleDisconnect = async () => {
    await cloudManager.initialize({
      enabled: false,
      provider: 'local',
      settings: { type: 'local', maxStorageSize: 50 * 1024 * 1024, storageKey: '' },
    });
    setConfig(null);
    setProfiles([]);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    const result = await cloudManager.deleteProfile(profileId);
    
    if (result.success) {
      setProfiles(profiles.filter(p => p.id !== profileId));
    } else {
      setError(result.error || 'Failed to delete profile');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  const renderSettingsTab = () => (
    <div className={styles.tabContent}>
      <h3>Cloud Provider</h3>
      
      <div className={styles.providerSelector}>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            value="local"
            checked={provider === 'local'}
            onChange={() => setProvider('local')}
          />
          <span>Local Storage (Browser)</span>
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            value="s3"
            checked={provider === 's3'}
            onChange={() => setProvider('s3')}
          />
          <span>Amazon S3 / S3-Compatible</span>
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            value="dropbox"
            checked={provider === 'dropbox'}
            onChange={() => setProvider('dropbox')}
          />
          <span>Dropbox</span>
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            value="google-drive"
            checked={provider === 'google-drive'}
            onChange={() => setProvider('google-drive')}
          />
          <span>Google Drive</span>
        </label>
      </div>

      {provider === 's3' && (
        <div className={styles.providerConfig}>
          <h4>S3 Configuration</h4>
          <div className={styles.formGroup}>
            <label>Endpoint URL</label>
            <input
              type="text"
              value={s3Config.endpoint}
              onChange={(e) => setS3Config({ ...s3Config, endpoint: e.target.value })}
              placeholder="https://s3.amazonaws.com"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Bucket Name</label>
            <input
              type="text"
              value={s3Config.bucket}
              onChange={(e) => setS3Config({ ...s3Config, bucket: e.target.value })}
              placeholder="my-bucket"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Region</label>
            <input
              type="text"
              value={s3Config.region}
              onChange={(e) => setS3Config({ ...s3Config, region: e.target.value })}
              placeholder="us-east-1"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Access Key ID (optional)</label>
            <input
              type="text"
              value={s3Config.accessKeyId}
              onChange={(e) => setS3Config({ ...s3Config, accessKeyId: e.target.value })}
              placeholder="AKIA..."
            />
            <small>Leave empty for presigned URLs</small>
          </div>
          <div className={styles.formGroup}>
            <label>Folder Path (optional)</label>
            <input
              type="text"
              value={s3Config.folder}
              onChange={(e) => setS3Config({ ...s3Config, folder: e.target.value })}
              placeholder="profiles"
            />
          </div>
        </div>
      )}

      {provider === 'dropbox' && (
        <div className={styles.providerConfig}>
          <h4>Dropbox Configuration</h4>
          <div className={styles.formGroup}>
            <label>App Key</label>
            <input
              type="text"
              value={dropboxConfig.appKey}
              onChange={(e) => setDropboxConfig({ ...dropboxConfig, appKey: e.target.value })}
              placeholder="your-app-key"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Folder</label>
            <input
              type="text"
              value={dropboxConfig.folder}
              onChange={(e) => setDropboxConfig({ ...dropboxConfig, folder: e.target.value })}
            />
          </div>
        </div>
      )}

      {provider === 'google-drive' && (
        <div className={styles.providerConfig}>
          <h4>Google Drive Configuration</h4>
          <div className={styles.formGroup}>
            <label>OAuth Client ID</label>
            <input
              type="text"
              value={gdriveConfig.clientId}
              onChange={(e) => setGdriveConfig({ ...gdriveConfig, clientId: e.target.value })}
              placeholder="your-client-id.apps.googleusercontent.com"
            />
          </div>
        </div>
      )}

      <div className={styles.autoSyncSection}>
        <h4>Auto Sync</h4>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
          />
          <span>Enable automatic sync</span>
        </label>
        {autoSyncEnabled && (
          <div className={styles.formGroup}>
            <label>Sync Interval (minutes)</label>
            <input
              type="number"
              min={5}
              max={1440}
              value={autoSyncInterval}
              onChange={(e) => setAutoSyncInterval(Number.parseInt(e.target.value, 10))}
            />
          </div>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.buttonGroup}>
        <button
          className={styles.primaryButton}
          onClick={handleSaveConfig}
          disabled={isLoading}
        >
          {isLoading ? 'Connecting...' : 'Connect & Save'}
        </button>
        {config?.enabled && (
          <button
            className={styles.dangerButton}
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );

  const renderProfilesTab = () => (
    <div className={styles.tabContent}>
      <div className={styles.tabHeader}>
        <h3>Cloud Profiles</h3>
        <button
          className={styles.secondaryButton}
          onClick={loadProfiles}
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>

      {!cloudManager.isReady() ? (
        <div className={styles.emptyState}>
          <p>Cloud sync is not configured.</p>
          <button
            className={styles.linkButton}
            onClick={() => setActiveTab('settings')}
          >
            Configure now
          </button>
        </div>
      ) : isLoading ? (
        <div className={styles.loading}>Loading profiles...</div>
      ) : profiles.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No profiles found in cloud storage.</p>
        </div>
      ) : (
        <div className={styles.profileList}>
          {profiles.map((profile) => (
            <div key={profile.id} className={styles.profileCard}>
              <div className={styles.profileInfo}>
                <div className={styles.profileName}>{profile.name}</div>
                <div className={styles.profileMeta}>
                  <span>{formatBytes(profile.size)}</span>
                  <span>Modified: {formatDate(profile.modifiedAt)}</span>
                  <span>v{profile.version}</span>
                </div>
              </div>
              <div className={styles.profileActions}>
                <button
                  className={styles.iconButton}
                  onClick={() => cloudManager.downloadProfile(profile.id)}
                  title="Download"
                >
                  ↓
                </button>
                <button
                  className={styles.iconButtonDanger}
                  onClick={() => handleDeleteProfile(profile.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStatusTab = () => (
    <div className={styles.tabContent}>
      <h3>Sync Status</h3>
      
      <div className={styles.statusGrid}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Status</span>
          <span className={state?.isOnline ? styles.statusOnline : styles.statusOffline}>
            {state?.isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Cloud Sync</span>
          <span className={cloudManager.isReady() ? styles.statusReady : styles.statusNotReady}>
            {cloudManager.isReady() ? '✅ Connected' : '❌ Not connected'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Last Sync</span>
          <span>
            {state?.lastSyncAt
              ? formatDate(new Date(state.lastSyncAt).toISOString())
              : 'Never'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Queued Items</span>
          <span>{state?.queue.length || 0}</span>
        </div>
      </div>

      {state?.isSyncing && (
        <div className={styles.syncingIndicator}>
          <div className={styles.spinner} />
          <span>Syncing...</span>
        </div>
      )}

      {state?.lastError && (
        <div className={styles.errorAlert}>
          <strong>Last Error:</strong> {state.lastError}
        </div>
      )}

      {state && state.queue.length > 0 && (
        <div className={styles.queueSection}>
          <h4>Sync Queue</h4>
          <div className={styles.queueList}>
            {state.queue.map((item) => (
              <div key={item.id} className={styles.queueItem}>
                <span className={styles.queueAction}>{item.action}</span>
                <span className={styles.queueProfile}>{item.profileId}</span>
                <span className={styles.queueRetry}>Retry: {item.retryCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>☁️ Cloud Sync</h2>
        <div className={styles.connectionStatus}>
          {cloudManager.isReady() ? (
            <span className={styles.connected}>● Connected</span>
          ) : (
            <span className={styles.disconnected}>● Not connected</span>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'settings' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'profiles' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          Profiles ({profiles.length})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'status' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Status
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'settings' && renderSettingsTab()}
        {activeTab === 'profiles' && renderProfilesTab()}
        {activeTab === 'status' && renderStatusTab()}
      </div>
    </div>
  );
};

export default CloudSyncPanel;
