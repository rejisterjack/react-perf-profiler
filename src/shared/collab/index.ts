/**
 * Collaboration Module
 * P2P session sharing for team collaboration
 * @module shared/collab
 */

export { CollabManager, getCollabManager, resetCollabManager } from './CollabManager';
export { CollabHost } from './CollabHost';
export { CollabClient } from './CollabClient';
export {
  generateSessionCode,
  formatSessionCode,
  isValidSessionCode,
  normalizeSessionCode,
  generateDisplayName,
  copyToClipboard,
} from './utils';
export type {
  CollabSession,
  CollabParticipant,
  CollabMessage,
  JoinMessage,
  LeaveMessage,
  CursorMessage,
  SelectMessage,
  ProfileMessage,
  AnnotationMessage,
  ChatMessage,
  AnyCollabMessage,
  CollabAnnotation,
  CollabState,
  CollabOptions,
} from './types';
