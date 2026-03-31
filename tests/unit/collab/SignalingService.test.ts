/**
 * Signaling Service Tests
 * @module tests/unit/collab/SignalingService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignalingService, createManualSignaling } from '@/shared/collab/SignalingService';

describe('SignalingService', () => {
  let service: SignalingService;

  beforeEach(() => {
    service = new SignalingService({ mode: 'manual' });
  });

  afterEach(() => {
    service.dispose();
  });

  describe('initialization', () => {
    it('should initialize in manual mode', async () => {
      await expect(service.init()).resolves.not.toThrow();
    });

    it('should generate a unique peer ID', () => {
      const id1 = service.getMyId();
      const id2 = service.getMyId();
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('message serialization', () => {
    it('should serialize and deserialize messages correctly', () => {
      const message = {
        type: 'offer' as const,
        sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
        senderId: 'test-sender',
        sessionCode: 'AB-CD-12',
      };

      const serialized = SignalingService.serializeMessage(message);
      const deserialized = SignalingService.deserializeMessage(serialized);

      expect(deserialized).toEqual(message);
    });

    it('should return null for invalid serialized data', () => {
      const result = SignalingService.deserializeMessage('invalid-base64');
      expect(result).toBeNull();
    });

    it('should handle complex SDP content', () => {
      const complexSdp = `v=0
o=- 1234567890 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 0.0.0.0
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1`;

      const message = {
        type: 'offer' as const,
        sdp: complexSdp,
        senderId: 'test-sender',
        sessionCode: 'XX-XX-00',
      };

      const serialized = SignalingService.serializeMessage(message);
      const deserialized = SignalingService.deserializeMessage(serialized);

      expect(deserialized).toEqual(message);
    });
  });

  describe('callbacks', () => {
    it('should call onOffer callback when offer is received', () => {
      const onOffer = vi.fn();
      service.setCallbacks({ onOffer });

      const message = {
        type: 'offer' as const,
        sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
        senderId: 'peer-1',
        sessionCode: 'AB-CD-12',
      };

      service.processManualMessage(SignalingService.serializeMessage(message));

      expect(onOffer).toHaveBeenCalledWith(
        { type: 'offer', sdp: message.sdp },
        'peer-1'
      );
    });

    it('should call onAnswer callback when answer is received', () => {
      const onAnswer = vi.fn();
      service.setCallbacks({ onAnswer });

      const message = {
        type: 'answer' as const,
        sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
        senderId: 'peer-1',
        targetId: 'peer-2',
      };

      service.processManualMessage(SignalingService.serializeMessage(message));

      expect(onAnswer).toHaveBeenCalledWith(
        { type: 'answer', sdp: message.sdp },
        'peer-1'
      );
    });

    it('should call onIceCandidate callback when ICE candidate is received', () => {
      const onIceCandidate = vi.fn();
      service.setCallbacks({ onIceCandidate });

      const message = {
        type: 'ice-candidate' as const,
        candidate: {
          candidate: 'candidate:123456 1 udp 2113937151 192.168.1.1 54321 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0,
        },
        senderId: 'peer-1',
        targetId: 'peer-2',
      };

      service.processManualMessage(SignalingService.serializeMessage(message));

      expect(onIceCandidate).toHaveBeenCalledWith(message.candidate, 'peer-1');
    });

    it('should queue messages before callbacks are set', () => {
      const onOffer = vi.fn();

      const message = {
        type: 'offer' as const,
        sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
        senderId: 'peer-1',
        sessionCode: 'AB-CD-12',
      };

      // Process before setting callbacks
      service.processManualMessage(SignalingService.serializeMessage(message));
      expect(onOffer).not.toHaveBeenCalled();

      // Set callbacks - should process pending
      service.setCallbacks({ onOffer });
      expect(onOffer).toHaveBeenCalled();
    });
  });

  describe('createManualSignaling', () => {
    it('should create manual signaling helper', () => {
      const signaling = createManualSignaling();
      
      expect(signaling.service).toBeInstanceOf(SignalingService);
      expect(signaling.getPendingMessages).toBeTypeOf('function');
      expect(signaling.receiveMessage).toBeTypeOf('function');
      expect(signaling.clearPending).toBeTypeOf('function');
    });

    it('should track pending messages', async () => {
      const signaling = createManualSignaling();
      await signaling.service.init();

      // Initially empty
      expect(signaling.getPendingMessages()).toHaveLength(0);

      // Send a message - in manual mode it becomes pending
      await signaling.service.sendOffer(
        { type: 'offer', sdp: 'test-sdp' },
        'TEST-01'
      );

      const pending = signaling.getPendingMessages();
      expect(pending.length).toBeGreaterThan(0);

      signaling.clearPending();
      expect(signaling.getPendingMessages()).toHaveLength(0);
    });
  });
});
