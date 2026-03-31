/**
 * Collaboration Client
 * Manages joining a P2P collaboration session
 * @module shared/collab/CollabClient
 */

import type {
  CollabParticipant,
  AnyCollabMessage,
  ChatMessage,
  CollabAnnotation,
  CollabOptions,
  ExportedProfileV1,
} from './types';
import { logger } from '@/shared/logger';

/**
 * Collaboration Client
 * Joins a host's P2P session
 */
export class CollabClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private options: CollabOptions;
  private listeners: Set<(event: ClientEvent) => void> = new Set();
  private localId: string = crypto.randomUUID();
  private sessionCode: string | null = null;
  private isConnected = false;
  private iceCandidatesQueue: RTCIceCandidate[] = [];

  constructor(options: CollabOptions) {
    this.options = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      ...options,
    };
  }

  // =============================================================================
  // Connection
  // =============================================================================

  /**
   * Join a session using the provided session code
   * Returns the SDP offer to send to the host
   */
  async joinSession(sessionCode: string): Promise<{
    offer: RTCSessionDescriptionInit;
    userName: string;
  }> {
    this.sessionCode = sessionCode;

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.options.iceServers,
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      logger.debug(`Connection state: ${state}`, { source: 'CollabClient' });

      if (state === 'connected') {
        this.isConnected = true;
        this.emit({ type: 'connected' });
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.isConnected = false;
        this.emit({ type: 'disconnected' });
      }
    };

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('collab', {
      ordered: true,
    });

    this.setupDataChannel();

    // Create offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete (or timeout)
    await this.gatherIceCandidates();

    return {
      offer: this.peerConnection.localDescription!,
      userName: this.options.userName,
    };
  }

  /**
   * Complete connection with host's answer
   */
  async completeConnection(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection');
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  /**
   * Add ICE candidate from host
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      this.iceCandidatesQueue.push(new RTCIceCandidate(candidate));
      return;
    }

    if (this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      this.iceCandidatesQueue.push(new RTCIceCandidate(candidate));
    }
  }

  /**
   * Leave the session
   */
  leaveSession(): void {
    this.send({
      type: 'leave',
      senderId: this.localId,
      timestamp: Date.now(),
      participantId: this.localId,
    });

    this.dataChannel?.close();
    this.peerConnection?.close();

    this.dataChannel = null;
    this.peerConnection = null;
    this.isConnected = false;
    this.sessionCode = null;
    this.iceCandidatesQueue = [];

    this.emit({ type: 'disconnected' });
    logger.info('Left collab session', { source: 'CollabClient' });
  }

  // =============================================================================
  // Messaging
  // =============================================================================

  /**
   * Send message to host (and other participants via host relay)
   */
  send(message: AnyCollabMessage): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      logger.warn('Data channel not open, message dropped', { source: 'CollabClient' });
    }
  }

  /**
   * Send cursor position update
   */
  sendCursor(x: number, y: number): void {
    this.send({
      type: 'cursor',
      senderId: this.localId,
      timestamp: Date.now(),
      x,
      y,
    });
  }

  /**
   * Send component selection
   */
  sendSelection(componentName: string, commitId?: string): void {
    this.send({
      type: 'select',
      senderId: this.localId,
      timestamp: Date.now(),
      componentName,
      commitId,
    });
  }

  /**
   * Send annotation
   */
  sendAnnotation(annotation: Omit<CollabAnnotation, 'id' | 'authorId' | 'createdAt'>): void {
    this.send({
      type: 'annotation',
      senderId: this.localId,
      timestamp: Date.now(),
      annotation: {
        ...annotation,
        id: crypto.randomUUID(),
        authorId: this.localId,
        createdAt: Date.now(),
      },
    });
  }

  /**
   * Send chat message
   */
  sendChat(text: string): void {
    this.send({
      type: 'chat',
      senderId: this.localId,
      timestamp: Date.now(),
      text,
    });
  }

  /**
   * Request profile sync
   */
  requestSync(): void {
    this.send({
      type: 'sync-request',
      senderId: this.localId,
      timestamp: Date.now(),
    });
  }

  // =============================================================================
  // Data Channel Setup
  // =============================================================================

  private setupDataChannel(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      logger.info('Data channel opened', { source: 'CollabClient' });
      this.isConnected = true;
      this.emit({ type: 'connected' });

      // Process queued ICE candidates
      for (const candidate of this.iceCandidatesQueue) {
        this.peerConnection?.addIceCandidate(candidate);
      }
      this.iceCandidatesQueue = [];
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as AnyCollabMessage;
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse message', {
          error: error instanceof Error ? error.message : String(error),
          source: 'CollabClient',
        });
      }
    };

    this.dataChannel.onclose = () => {
      logger.info('Data channel closed', { source: 'CollabClient' });
      this.isConnected = false;
      this.emit({ type: 'disconnected' });
    };

    this.dataChannel.onerror = (error) => {
      logger.error('Data channel error', { error, source: 'CollabClient' });
      this.emit({ type: 'error', error: 'Data channel error' });
    };
  }

  private handleMessage(message: AnyCollabMessage): void {
    switch (message.type) {
      case 'profile':
        this.emit({ type: 'profile-received', profile: message.profile });
        break;
      case 'join':
        this.emit({ type: 'participant-joined', participant: message.participant });
        break;
      case 'leave':
        this.emit({ type: 'participant-left', participantId: message.participantId });
        break;
      case 'cursor':
        this.emit({
          type: 'cursor-update',
          participantId: message.senderId,
          x: message.x,
          y: message.y,
        });
        break;
      case 'select':
        this.emit({
          type: 'selection-update',
          participantId: message.senderId,
          componentName: message.componentName,
          commitId: message.commitId,
        });
        break;
      case 'annotation':
        this.emit({ type: 'annotation-received', annotation: message.annotation });
        break;
      case 'chat':
        this.emit({ type: 'chat-received', message });
        break;
    }

    // Emit generic message event
    this.emit({ type: 'message-received', message });
  }

  // =============================================================================
  // ICE Gathering
  // =============================================================================

  private gatherIceCandidates(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve();
        return;
      }

      // If already gathered, resolve immediately
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        resolve(); // Resolve after timeout even if not complete
      }, 3000);

      this.peerConnection.onicegatheringstatechange = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve();
        }
      };
    });
  }

  // =============================================================================
  // State
  // =============================================================================

  isConnectedToSession(): boolean {
    return this.isConnected;
  }

  getSessionCode(): string | null {
    return this.sessionCode;
  }

  getLocalId(): string {
    return this.localId;
  }

  // =============================================================================
  // Event Handling
  // =============================================================================

  subscribe(listener: (event: ClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ClientEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Client events
 */
export type ClientEvent =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'error'; error: string }
  | { type: 'message-received'; message: AnyCollabMessage }
  | { type: 'profile-received'; profile: ExportedProfileV1 }
  | { type: 'participant-joined'; participant: CollabParticipant }
  | { type: 'participant-left'; participantId: string }
  | { type: 'cursor-update'; participantId: string; x: number; y: number }
  | { type: 'selection-update'; participantId: string; componentName: string; commitId?: string }
  | { type: 'annotation-received'; annotation: CollabAnnotation }
  | { type: 'chat-received'; message: ChatMessage }
  | { type: 'ice-candidate'; candidate: RTCIceCandidate };
