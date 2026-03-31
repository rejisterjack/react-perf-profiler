/**
 * Collaboration Manager
 * Unified interface for hosting and joining sessions
 * @module shared/collab/CollabManager
 */

import { CollabHost, type HostEvent } from './CollabHost';
import { CollabClient, type ClientEvent } from './CollabClient';
import type {
  CollabOptions,
  CollabState,
  CollabParticipant,
  CollabAnnotation,
  ExportedProfileV1,
} from './types';
import { generateDisplayName, normalizeSessionCode } from './utils';
import { logger } from '@/shared/logger';

/**
 * Collaboration Manager
 * Manages both hosting and joining sessions
 */
export class CollabManager {
  private host: CollabHost | null = null;
  private client: CollabClient | null = null;
  private state: CollabState = {
    isConnected: false,
    isHost: false,
    sessionCode: null,
    participants: [],
    annotations: [],
    messages: [],
    error: null,
  };
  private listeners: Set<(state: CollabState) => void> = new Set();
  private options: CollabOptions;

  constructor(options?: Partial<CollabOptions>) {
    this.options = {
      userName: generateDisplayName(),
      ...options,
    };
  }

  // =============================================================================
  // Host Actions
  // =============================================================================

  /**
   * Create and host a new session
   */
  async createSession(profile?: ExportedProfileV1): Promise<string> {
    // Disconnect from any existing session
    await this.disconnect();

    this.host = new CollabHost(this.options);
    
    // Subscribe to host events
    this.host.subscribe((event) => this.handleHostEvent(event));

    const sessionCode = await this.host.createSession(profile);

    this.setState({
      isHost: true,
      sessionCode,
      isConnected: true,
    });

    return sessionCode;
  }

  /**
   * Handle incoming WebRTC signaling from a client
   * This would be called from your signaling server or manual exchange
   */
  async handleSignalingMessage(
    message: 
      | { type: 'offer'; offer: RTCSessionDescriptionInit; participantName: string }
      | { type: 'answer'; participantId: string; answer: RTCSessionDescriptionInit }
      | { type: 'ice-candidate'; participantId: string; candidate: RTCIceCandidateInit }
  ): Promise<RTCSessionDescriptionInit | null> {
    if (!this.host) return null;

    switch (message.type) {
      case 'offer': {
        const result = await this.host.handleJoinRequest(
          message.offer,
          message.participantName
        );
        return result?.answer || null;
      }
      case 'ice-candidate':
        await this.host.addIceCandidate(message.participantId, message.candidate);
        return null;
      default:
        return null;
    }
  }

  // =============================================================================
  // Client Actions
  // =============================================================================

  /**
   * Join an existing session
   */
  async joinSession(sessionCode: string): Promise<{
    offer: RTCSessionDescriptionInit;
    userName: string;
  }> {
    // Disconnect from any existing session
    await this.disconnect();

    this.client = new CollabClient(this.options);
    
    // Subscribe to client events
    this.client.subscribe((event) => this.handleClientEvent(event));

    const normalizedCode = normalizeSessionCode(sessionCode);
    const result = await this.client.joinSession(normalizedCode);

    this.setState({
      isHost: false,
      sessionCode: normalizedCode,
    });

    return result;
  }

  /**
   * Complete connection with host's answer
   */
  async completeJoin(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.client) {
      throw new Error('Not in joining state');
    }

    await this.client.completeConnection(answer);
  }

  /**
   * Handle host's answer (for client)
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    return this.completeJoin(answer);
  }

  /**
   * Handle join request and create answer (for host)
   */
  async handleJoinRequest(
    offer: RTCSessionDescriptionInit,
    participantId: string,
    participantName: string
  ): Promise<RTCSessionDescriptionInit | null> {
    if (!this.host) return null;
    
    const result = await this.host.handleJoinRequest(offer, participantName);
    return result?.answer || null;
  }

  /**
   * Add ICE candidate
   */
  async addIceCandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
    if (this.host) {
      await this.host.addIceCandidate(participantId, candidate);
    } else if (this.client) {
      await this.client.addIceCandidate(candidate);
    }
  }

  /**
   * Handle signaling message as client
   */
  async handleClientSignalingMessage(
    message: { type: 'ice-candidate'; candidate: RTCIceCandidateInit }
  ): Promise<void> {
    if (!this.client) return;

    if (message.type === 'ice-candidate') {
      await this.client.addIceCandidate(message.candidate);
    }
  }

  // =============================================================================
  // Common Actions
  // =============================================================================

  /**
   * Disconnect from current session
   */
  async disconnect(): Promise<void> {
    if (this.host) {
      await this.host.closeSession();
      this.host = null;
    }

    if (this.client) {
      this.client.leaveSession();
      this.client = null;
    }

    this.setState({
      isConnected: false,
      isHost: false,
      sessionCode: null,
      participants: [],
      annotations: [],
      messages: [],
      error: null,
    });
  }

  /**
   * Send cursor position update
   */
  sendCursor(x: number, y: number): void {
    this.client?.sendCursor(x, y);
  }

  /**
   * Send component selection
   */
  sendSelection(componentName: string, commitId?: string): void {
    this.client?.sendSelection(componentName, commitId);
    this.host?.broadcast({
      type: 'select',
      senderId: 'host',
      timestamp: Date.now(),
      componentName,
      commitId,
    });
  }

  /**
   * Send annotation
   */
  sendAnnotation(annotation: Omit<CollabAnnotation, 'id' | 'authorId' | 'createdAt'>): void {
    const fullAnnotation: CollabAnnotation = {
      ...annotation,
      id: crypto.randomUUID(),
      authorId: this.getCurrentUserId(),
      createdAt: Date.now(),
    };

    this.client?.sendAnnotation(annotation);
    
    // Add to local state
    this.setState({
      annotations: [...this.state.annotations, fullAnnotation],
    });
  }

  /**
   * Send chat message
   */
  sendChat(text: string): void {
    this.client?.sendChat(text);
  }

  /**
   * Share profile (host only)
   */
  shareProfile(profile: ExportedProfileV1): void {
    if (this.host) {
      this.host.shareProfile(profile);
    } else {
      // Request sync as client
      this.client?.requestSync();
    }
  }

  // =============================================================================
  // Event Handlers
  // =============================================================================

  private handleHostEvent(event: HostEvent): void {
    switch (event.type) {
      case 'participant-joined':
        this.setState({
          participants: [...this.state.participants, event.participant],
        });
        break;
      case 'participant-left':
        this.setState({
          participants: this.state.participants.filter(
            (p) => p.id !== event.participant.id
          ),
        });
        break;
      case 'message-received':
        this.handleMessage(event.message);
        break;
      case 'profile-shared':
        // Host already has the profile
        break;
    }
  }

  private handleClientEvent(event: ClientEvent): void {
    switch (event.type) {
      case 'connected':
        this.setState({ isConnected: true });
        break;
      case 'disconnected':
        this.setState({ isConnected: false });
        break;
      case 'participant-joined':
        this.setState({
          participants: [...this.state.participants, event.participant],
        });
        break;
      case 'participant-left':
        this.setState({
          participants: this.state.participants.filter(
            (p) => p.id !== event.participantId
          ),
        });
        break;
      case 'message-received':
        this.handleMessage(event.message);
        break;
      case 'profile-received':
        // Emit event for UI to handle
        this.emitStateChange();
        break;
      case 'cursor-update':
        this.updateParticipantCursor(event.participantId, event.x, event.y);
        break;
      case 'selection-update':
        this.updateParticipantSelection(
          event.participantId,
          event.componentName,
          event.commitId
        );
        break;
      case 'annotation-received':
        this.setState({
          annotations: [...this.state.annotations, event.annotation],
        });
        break;
      case 'chat-received':
        this.setState({
          messages: [...this.state.messages, event.message],
        });
        break;
      case 'error':
        this.setState({ error: event.error });
        break;
    }
  }

  private handleMessage(message: { type: string }): void {
    // Additional message handling if needed
    logger.debug('Collab message received', { type: message.type, source: 'CollabManager' });
  }

  private updateParticipantCursor(participantId: string, x: number, y: number): void {
    this.setState({
      participants: this.state.participants.map((p) =>
        p.id === participantId
          ? { ...p, cursor: { x, y, timestamp: Date.now() } }
          : p
      ),
    });
  }

  private updateParticipantSelection(
    participantId: string,
    componentName: string,
    commitId?: string
  ): void {
    this.setState({
      participants: this.state.participants.map((p) =>
        p.id === participantId ? { ...p, selection: { componentName, commitId } } : p
      ),
    });
  }

  // =============================================================================
  // State Management
  // =============================================================================

  getState(): CollabState {
    return { ...this.state };
  }

  private setState(updates: Partial<CollabState>): void {
    this.state = { ...this.state, ...updates };
    this.emitStateChange();
  }

  subscribe(listener: (state: CollabState) => void): () => void {
    this.listeners.add(listener);
    // Initial state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emitStateChange(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Ignore listener errors
      }
    }
  }

  // =============================================================================
  // Getters
  // =============================================================================

  isConnected(): boolean {
    return this.state.isConnected;
  }

  isHost(): boolean {
    return this.state.isHost;
  }

  getSessionCode(): string | null {
    return this.state.sessionCode;
  }

  getParticipants(): CollabParticipant[] {
    return this.state.participants;
  }

  getCurrentUserId(): string {
    if (this.host) {
      return this.host.getSession()?.hostId || 'unknown';
    }
    if (this.client) {
      return this.client.getLocalId();
    }
    return 'unknown';
  }

  getUserName(): string {
    return this.options.userName;
  }

  setUserName(name: string): void {
    this.options.userName = name;
  }

  // =============================================================================
  // Cleanup
  // =============================================================================

  destroy(): void {
    this.disconnect();
    this.listeners.clear();
  }
}

// Singleton instance
let collabManager: CollabManager | null = null;

export function getCollabManager(options?: Partial<CollabOptions>): CollabManager {
  if (!collabManager) {
    collabManager = new CollabManager(options);
  }
  return collabManager;
}

export function resetCollabManager(): void {
  collabManager?.destroy();
  collabManager = null;
}
