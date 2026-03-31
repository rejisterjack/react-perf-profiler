/**
 * Collaboration Types
 * @module shared/collab/types
 */

import type { ExportedProfileV1 } from '@/shared/types/export';
export type { ExportedProfileV1 } from '@/shared/types/export';

/**
 * Participant in a collaboration session
 */
export interface CollabParticipant {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  joinedAt: number;
  cursor?: {
    x: number;
    y: number;
    timestamp: number;
  };
  selection?: {
    componentName: string;
    commitId?: string;
  };
}

/**
 * Collaboration session
 */
export interface CollabSession {
  id: string;
  code: string;
  hostId: string;
  participants: Map<string, CollabParticipant>;
  profile?: ExportedProfileV1;
  createdAt: number;
  expiresAt: number;
}

/**
 * Collab message types
 */
export type CollabMessageType =
  | 'join'
  | 'leave'
  | 'cursor'
  | 'select'
  | 'profile'
  | 'annotation'
  | 'chat'
  | 'sync-request'
  | 'sync-response';

/**
 * Base collab message
 */
export interface CollabMessage {
  type: CollabMessageType;
  senderId: string;
  timestamp: number;
}

/**
 * Join message
 */
export interface JoinMessage extends CollabMessage {
  type: 'join';
  participant: CollabParticipant;
}

/**
 * Leave message
 */
export interface LeaveMessage extends CollabMessage {
  type: 'leave';
  participantId: string;
}

/**
 * Cursor position message
 */
export interface CursorMessage extends CollabMessage {
  type: 'cursor';
  x: number;
  y: number;
}

/**
 * Component selection message
 */
export interface SelectMessage extends CollabMessage {
  type: 'select';
  componentName: string;
  commitId?: string;
}

/**
 * Profile sync message
 */
export interface ProfileMessage extends CollabMessage {
  type: 'profile';
  profile: ExportedProfileV1;
}

/**
 * Annotation message
 */
export interface AnnotationMessage extends CollabMessage {
  type: 'annotation';
  annotation: CollabAnnotation;
}

/**
 * Chat message
 */
export interface ChatMessage extends CollabMessage {
  type: 'chat';
  text: string;
}

/**
 * Sync request/response
 */
export interface SyncRequestMessage extends CollabMessage {
  type: 'sync-request';
}

export interface SyncResponseMessage extends CollabMessage {
  type: 'sync-response';
  profile: ExportedProfileV1;
}

/**
 * Union type for all collab messages
 */
export type AnyCollabMessage =
  | JoinMessage
  | LeaveMessage
  | CursorMessage
  | SelectMessage
  | ProfileMessage
  | AnnotationMessage
  | ChatMessage
  | SyncRequestMessage
  | SyncResponseMessage;

/**
 * Annotation on a component or commit
 */
export interface CollabAnnotation {
  id: string;
  authorId: string;
  type: 'note' | 'issue' | 'optimization';
  target: {
    type: 'component' | 'commit' | 'range';
    componentName?: string;
    commitId?: string;
    startTime?: number;
    endTime?: number;
  };
  text: string;
  createdAt: number;
  resolved: boolean;
}

/**
 * Collab session state
 */
export interface CollabState {
  isConnected: boolean;
  isHost: boolean;
  sessionCode: string | null;
  participants: CollabParticipant[];
  annotations: CollabAnnotation[];
  messages: ChatMessage[];
  error: string | null;
}

/**
 * ICE server configuration
 */
export interface ICEConfig {
  servers: RTCIceServer[];
}

/**
 * Default ICE servers (free public STUN servers)
 */
export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Collab connection options
 */
export interface CollabOptions {
  userName: string;
  iceServers?: RTCIceServer[];
  signalServerUrl?: string; // Optional: for relay if P2P fails
}
