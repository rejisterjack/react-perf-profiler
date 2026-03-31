/**
 * Collaboration Host
 * Manages hosting a P2P collaboration session
 * @module shared/collab/CollabHost
 */

import type {
  CollabSession,
  CollabParticipant,
  AnyCollabMessage,
  CollabOptions,
  ExportedProfileV1,
} from './types';
import { generateSessionCode } from './utils';
import { logger } from '@/shared/logger';

/**
 * Collaboration Host
 * Creates and manages a P2P session for sharing profiles
 */
export class CollabHost {
  private session: CollabSession | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private localStream: MediaStream | null = null;
  private options: CollabOptions;
  private listeners: Set<(event: HostEvent) => void> = new Set();
  private heartbeatInterval?: number;

  constructor(options: CollabOptions) {
    this.options = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      ...options,
    };
  }

  // =============================================================================
  // Session Management
  // =============================================================================

  /**
   * Create and host a new session
   */
  async createSession(profile?: ExportedProfileV1): Promise<string> {
    const sessionCode = generateSessionCode();
    const hostId = crypto.randomUUID();

    this.session = {
      id: crypto.randomUUID(),
      code: sessionCode,
      hostId,
      participants: new Map(),
      profile,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Add self as host participant
    const hostParticipant: CollabParticipant = {
      id: hostId,
      name: this.options.userName,
      color: this.generateColor(0),
      isHost: true,
      joinedAt: Date.now(),
    };
    this.session.participants.set(hostId, hostParticipant);

    // Start heartbeat to keep session alive
    this.startHeartbeat();

    this.emit({ type: 'session-created', sessionCode });
    logger.info(`Collab session created: ${sessionCode}`, { source: 'CollabHost' });

    return sessionCode;
  }

  /**
   * Close the session and disconnect all participants
   */
  async closeSession(): Promise<void> {
    // Notify all participants
    this.broadcast({
      type: 'leave',
      senderId: this.session?.hostId || '',
      timestamp: Date.now(),
      participantId: this.session?.hostId || '',
    });

    // Close all connections
    for (const [peerId, pc] of this.peerConnections) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    this.dataChannels.clear();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.session = null;
    this.emit({ type: 'session-closed' });
    logger.info('Collab session closed', { source: 'CollabHost' });
  }

  /**
   * Get current session info
   */
  getSession(): CollabSession | null {
    return this.session;
  }

  // =============================================================================
  // Peer Connection Management
  // =============================================================================

  /**
   * Handle incoming join request (SDP offer from client)
   */
  async handleJoinRequest(offer: RTCSessionDescriptionInit, participantName: string): Promise<{
    answer: RTCSessionDescriptionInit;
    participantId: string;
  } | null> {
    if (!this.session) return null;

    const participantId = crypto.randomUUID();

    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers: this.options.iceServers,
    });

    this.peerConnections.set(participantId, pc);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit({
          type: 'ice-candidate',
          participantId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      logger.debug(`Peer ${participantId} connection state: ${pc.connectionState}`, {
        source: 'CollabHost',
      });

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.handleParticipantLeave(participantId);
      }
    };

    // Handle data channel from client
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.dataChannels.set(participantId, channel);

      channel.onopen = () => {
        logger.info(`Data channel opened with ${participantId}`, { source: 'CollabHost' });
        
        // Add participant
        const participant: CollabParticipant = {
          id: participantId,
          name: participantName,
          color: this.generateColor(this.session!.participants.size),
          isHost: false,
          joinedAt: Date.now(),
        };
        this.session!.participants.set(participantId, participant);

        // Send current profile
        if (this.session!.profile) {
          this.sendTo(participantId, {
            type: 'profile',
            senderId: this.session!.hostId,
            timestamp: Date.now(),
            profile: this.session!.profile,
          });
        }

        // Broadcast join to all participants
        this.broadcast({
          type: 'join',
          senderId: this.session!.hostId,
          timestamp: Date.now(),
          participant,
        }, participantId); // Exclude the new participant

        this.emit({ type: 'participant-joined', participant });
      };

      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as AnyCollabMessage;
          this.handleMessage(participantId, message);
        } catch {
          // Ignore invalid messages
        }
      };

      channel.onclose = () => {
        this.handleParticipantLeave(participantId);
      };
    };

    // Set remote description (offer)
    await pc.setRemoteDescription(offer);

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    return { answer, participantId };
  }

  /**
   * Add ICE candidate from client
   */
  async addIceCandidate(participantId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  /**
   * Handle participant leaving
   */
  private handleParticipantLeave(participantId: string): void {
    const participant = this.session?.participants.get(participantId);
    if (!participant) return;

    // Close connection
    const pc = this.peerConnections.get(participantId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(participantId);
    }

    this.dataChannels.delete(participantId);

    // Remove from session
    this.session?.participants.delete(participantId);

    // Broadcast leave
    this.broadcast({
      type: 'leave',
      senderId: this.session?.hostId || '',
      timestamp: Date.now(),
      participantId,
    });

    this.emit({ type: 'participant-left', participant });
    logger.info(`Participant ${participant.name} left`, { source: 'CollabHost' });
  }

  // =============================================================================
  // Messaging
  // =============================================================================

  /**
   * Send message to specific participant
   */
  private sendTo(participantId: string, message: AnyCollabMessage): void {
    const channel = this.dataChannels.get(participantId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all participants
   */
  broadcast(message: AnyCollabMessage, excludeParticipantId?: string): void {
    for (const [participantId, channel] of this.dataChannels) {
      if (participantId !== excludeParticipantId && channel.readyState === 'open') {
        channel.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Handle incoming message from participant
   */
  private handleMessage(participantId: string, message: AnyCollabMessage): void {
    // Update participant activity
    const participant = this.session?.participants.get(participantId);
    if (!participant) return;

    // Forward to other participants
    this.broadcast(message, participantId);

    // Emit event for UI
    this.emit({
      type: 'message-received',
      participantId,
      message,
    });
  }

  // =============================================================================
  // Profile Sharing
  // =============================================================================

  /**
   * Share/update profile with all participants
   */
  shareProfile(profile: ExportedProfileV1): void {
    if (!this.session) return;

    this.session.profile = profile;

    this.broadcast({
      type: 'profile',
      senderId: this.session.hostId,
      timestamp: Date.now(),
      profile,
    });

    this.emit({ type: 'profile-shared', profile });
  }

  // =============================================================================
  // Utilities
  // =============================================================================

  private generateColor(index: number): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    ];
    return colors[index % colors.length]!;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (!this.session) return;

      // Check for expired participants
      const now = Date.now();
      for (const [participantId, participant] of this.session.participants) {
        if (participantId === this.session.hostId) continue;

        // Check if still connected
        const channel = this.dataChannels.get(participantId);
        if (!channel || channel.readyState !== 'open') {
          // Connection lost
          this.handleParticipantLeave(participantId);
        }
      }
    }, 30000); // Every 30 seconds
  }

  // =============================================================================
  // Event Handling
  // =============================================================================

  subscribe(listener: (event: HostEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: HostEvent): void {
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
 * Host events
 */
export type HostEvent =
  | { type: 'session-created'; sessionCode: string }
  | { type: 'session-closed' }
  | { type: 'participant-joined'; participant: CollabParticipant }
  | { type: 'participant-left'; participant: CollabParticipant }
  | { type: 'message-received'; participantId: string; message: AnyCollabMessage }
  | { type: 'profile-shared'; profile: ExportedProfileV1 }
  | { type: 'ice-candidate'; participantId: string; candidate: RTCIceCandidate };
