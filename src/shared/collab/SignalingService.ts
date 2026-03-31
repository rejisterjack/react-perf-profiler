/**
 * WebRTC Signaling Service
 * Handles SDP offer/answer exchange between peers
 * Supports both manual (copy-paste) and relay server modes
 * @module shared/collab/SignalingService
 */

import { logger } from '@/shared/logger';

/**
 * Signaling message types
 */
export type SignalingMessage =
  | { type: 'offer'; sdp: string; senderId: string; sessionCode: string }
  | { type: 'answer'; sdp: string; senderId: string; targetId: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; senderId: string; targetId: string }
  | { type: 'join-request'; senderId: string; sessionCode: string; participantName: string };

/**
 * Signaling event callbacks
 */
interface SignalingCallbacks {
  onOffer?: (offer: RTCSessionDescriptionInit, senderId: string) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit, senderId: string) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit, senderId: string) => void;
  onJoinRequest?: (senderId: string, sessionCode: string, name: string) => void;
  onError?: (error: string) => void;
}

/**
 * Signaling Service
 * Manages the exchange of SDP data between peers
 */
export class SignalingService {
  private callbacks: SignalingCallbacks = {};
  private pendingMessages: SignalingMessage[] = [];
  private isManualMode: boolean;
  private relaySocket?: WebSocket;
  private relayUrl?: string;
  private sessionCode?: string;
  private myId: string;

  constructor(options: { 
    mode: 'manual' | 'relay'; 
    relayUrl?: string;
    sessionCode?: string;
  }) {
    this.isManualMode = options.mode === 'manual';
    this.relayUrl = options.relayUrl;
    this.sessionCode = options.sessionCode;
    this.myId = crypto.randomUUID();
  }

  /**
   * Initialize the signaling service
   */
  async init(): Promise<void> {
    if (!this.isManualMode && this.relayUrl) {
      await this.connectRelay();
    }
    logger.info(`Signaling service initialized (${this.isManualMode ? 'manual' : 'relay'} mode)`, {
      source: 'SignalingService',
    });
  }

  /**
   * Set callback handlers
   */
  setCallbacks(callbacks: SignalingCallbacks): void {
    this.callbacks = callbacks;
    
    // Process any pending messages
    for (const message of this.pendingMessages) {
      this.handleMessage(message);
    }
    this.pendingMessages = [];
  }

  /**
   * Send an offer to a target peer
   */
  async sendOffer(offer: RTCSessionDescriptionInit, targetSessionCode: string): Promise<void> {
    const message: SignalingMessage = {
      type: 'offer',
      sdp: offer.sdp!,
      senderId: this.myId,
      sessionCode: targetSessionCode,
    };
    await this.send(message);
  }

  /**
   * Send an answer back to the offerer
   */
  async sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): Promise<void> {
    const message: SignalingMessage = {
      type: 'answer',
      sdp: answer.sdp!,
      senderId: this.myId,
      targetId,
    };
    await this.send(message);
  }

  /**
   * Send ICE candidate to peer
   */
  async sendIceCandidate(candidate: RTCIceCandidateInit, targetId: string): Promise<void> {
    const message: SignalingMessage = {
      type: 'ice-candidate',
      candidate,
      senderId: this.myId,
      targetId,
    };
    await this.send(message);
  }

  /**
   * Send join request to a session
   */
  async sendJoinRequest(sessionCode: string, name: string): Promise<void> {
    const message: SignalingMessage = {
      type: 'join-request',
      senderId: this.myId,
      sessionCode,
      participantName: name,
    };
    await this.send(message);
  }

  /**
   * Get my peer ID
   */
  getMyId(): string {
    return this.myId;
  }

  /**
   * Serialize a message for manual exchange (copy-paste)
   */
  static serializeMessage(message: SignalingMessage): string {
    return btoa(JSON.stringify(message));
  }

  /**
   * Deserialize a message from manual exchange
   */
  static deserializeMessage(serialized: string): SignalingMessage | null {
    try {
      return JSON.parse(atob(serialized)) as SignalingMessage;
    } catch {
      return null;
    }
  }

  /**
   * Process a manually received message
   */
  processManualMessage(serialized: string): boolean {
    const message = SignalingService.deserializeMessage(serialized);
    if (!message) return false;
    
    this.handleMessage(message);
    return true;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.relaySocket?.close();
    this.callbacks = {};
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async connectRelay(): Promise<void> {
    if (!this.relayUrl) return;

    return new Promise((resolve, reject) => {
      this.relaySocket = new WebSocket(this.relayUrl!);

      this.relaySocket.onopen = () => {
        // Register with session code
        this.relaySocket!.send(JSON.stringify({
          type: 'register',
          sessionCode: this.sessionCode,
          peerId: this.myId,
        }));
        resolve();
      };

      this.relaySocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as SignalingMessage;
          this.handleMessage(message);
        } catch {
          // Ignore invalid messages
        }
      };

      this.relaySocket.onerror = (error) => {
        this.callbacks.onError?.('WebSocket connection failed');
        reject(error);
      };

      this.relaySocket.onclose = () => {
        // Attempt reconnection after delay
        setTimeout(() => this.connectRelay(), 5000);
      };
    });
  }

  private async send(message: SignalingMessage): Promise<void> {
    if (this.isManualMode) {
      // In manual mode, messages are queued for copy-paste
      this.pendingMessages.push(message);
      this.emitManualMessage(message);
    } else if (this.relaySocket?.readyState === WebSocket.OPEN) {
      this.relaySocket.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: SignalingMessage): void {
    // If no callbacks registered yet, queue the message
    const hasCallbacks = this.callbacks.onOffer || this.callbacks.onAnswer || 
                         this.callbacks.onIceCandidate || this.callbacks.onJoinRequest;
    if (!hasCallbacks) {
      this.pendingMessages.push(message);
      return;
    }

    switch (message.type) {
      case 'offer':
        this.callbacks.onOffer?.(
          { type: 'offer', sdp: message.sdp },
          message.senderId
        );
        break;
      case 'answer':
        this.callbacks.onAnswer?.(
          { type: 'answer', sdp: message.sdp },
          message.senderId
        );
        break;
      case 'ice-candidate':
        this.callbacks.onIceCandidate?.(message.candidate, message.senderId);
        break;
      case 'join-request':
        this.callbacks.onJoinRequest?.(
          message.senderId,
          message.sessionCode,
          message.participantName
        );
        break;
    }
  }

  private emitManualMessage(message: SignalingMessage): void {
    // Dispatch a custom event that UI can listen to
    const event = new CustomEvent('signaling-message', {
      detail: {
        serialized: SignalingService.serializeMessage(message),
        message,
      },
    });
    window.dispatchEvent(event);
  }
}

/**
 * Create a manual signaling exchange
 * Returns functions for copy-paste workflow
 */
export function createManualSignaling() {
  const service = new SignalingService({ mode: 'manual' });
  
  return {
    service,
    
    /**
     * Get pending messages that need to be sent
     */
    getPendingMessages(): string[] {
      return service['pendingMessages'].map(SignalingService.serializeMessage);
    },

    /**
     * Process an incoming message from the other peer
     */
    receiveMessage(serialized: string): boolean {
      return service.processManualMessage(serialized);
    },

    /**
     * Clear pending messages after copying
     */
    clearPending(): void {
      service['pendingMessages'] = [];
    },
  };
}
