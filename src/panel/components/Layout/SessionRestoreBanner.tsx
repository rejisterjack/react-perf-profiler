/**
 * SessionRestoreBanner Component
 * Banner shown when a previous session can be restored from IndexedDB
 */

import type React from 'react';
import { t } from '@/shared/i18n';
import styles from './SessionRestoreBanner.module.css';

interface SessionRestoreBannerProps {
  commitCount: number;
  savedAt: number;
  onRestore: () => void;
  onDiscard: () => void;
}

export const SessionRestoreBanner: React.FC<SessionRestoreBannerProps> = ({
  commitCount,
  savedAt,
  onRestore,
  onDiscard,
}) => (
  <div className={styles.restoreBanner} role="alert">
    <span className={styles.bannerText}>
      {t('session.previousAvailable')} ({commitCount} commits, saved{' '}
      {new Date(savedAt).toLocaleTimeString()})
    </span>
    <button type="button" onClick={onRestore} className={styles.restoreButton}>
      Restore
    </button>
    <button type="button" onClick={onDiscard} className={styles.discardButton}>
      Discard
    </button>
  </div>
);

export default SessionRestoreBanner;
