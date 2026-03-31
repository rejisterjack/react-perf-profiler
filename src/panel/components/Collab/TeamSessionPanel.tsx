/**
 * Team Session Panel
 * UI for creating and joining collaboration sessions with WebRTC signaling
 * @module panel/components/Collab/TeamSessionPanel
 */

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { getCollabManager } from '@/shared/collab/CollabManager';
import { SignalingService } from '@/shared/collab/SignalingService';
import type { CollabState, CollabParticipant, ChatMessage } from '@/shared/collab/types';
import { formatSessionCode, copyToClipboard } from '@/shared/collab/utils';
import { useProfilerStore } from '@/panel/stores';
import styles from './TeamSessionPanel.module.css';

/**
 * Team Session Panel Component
 */
export const TeamSessionPanel: React.FC = () => {
  const [state, setState] = useState<CollabState | null>(null);
  const [userName, setUserName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Manual signaling state
  const [signalingMode, setSignalingMode] = useState<'auto' | 'manual'>('auto');
  const [pendingOffer, setPendingOffer] = useState<string>('');
  const [pendingAnswer, setPendingAnswer] = useState<string>('');
  const [signalingStep, setSignalingStep] = useState<'idle' | 'offer-created' | 'answer-created' | 'connected'>('idle');
  const signalingServiceRef = useRef<SignalingService | null>(null);

  const collabManager = getCollabManager();
  const profile = useProfilerStore((s) => s.analysisResults);

  // Subscribe to collab state
  useEffect(() => {
    const unsubscribe = collabManager.subscribe((newState) => {
      setState(newState);
      if (newState.isConnected) {
        setSignalingStep('connected');
      }
    });

    setUserName(collabManager.getUserName());

    return unsubscribe;
  }, [collabManager]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.messages]);

  // Initialize signaling service
  useEffect(() => {
    const service = new SignalingService({ 
      mode: signalingMode === 'manual' ? 'manual' : 'relay',
      relayUrl: signalingMode === 'auto' ? 'ws://localhost:8080' : undefined,
    });
    
    service.setCallbacks({
      onOffer: (offer, senderId) => {
        if (state?.isHost) {
          // Host received an offer from a client
          handleIncomingOffer(offer, senderId);
        }
      },
      onAnswer: (answer) => {
        if (!state?.isHost) {
          // Client received answer from host
          handleIncomingAnswer(answer);
        }
      },
      onIceCandidate: (candidate, senderId) => {
        handleIncomingIceCandidate(candidate, senderId);
      },
      onError: (err) => setError(err),
    });

    signalingServiceRef.current = service;
    service.init();

    // Listen for manual signaling messages
    const handleManualMessage = (event: CustomEvent) => {
      if (signalingMode === 'manual') {
        const { serialized } = event.detail;
        if (state?.isHost && signalingStep === 'idle') {
          setPendingOffer(serialized);
        }
      }
    };

    window.addEventListener('signaling-message', handleManualMessage as EventListener);

    return () => {
      service.dispose();
      window.removeEventListener('signaling-message', handleManualMessage as EventListener);
    };
  }, [signalingMode, state?.isHost, signalingStep]);

  const handleCreateSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentProfile = profile
        ? {
            version: '1',
            metadata: {
              version: '1',
              exportedAt: new Date().toISOString(),
              sourceUrl: window.location.href,
              totalCommits: 0,
              totalComponents: 0,
            },
            commits: [],
            componentData: {},
            ...profile,
          }
        : undefined;

      const sessionCode = await collabManager.createSession(currentProfile as any);
      
      if (signalingMode === 'manual') {
        setSignalingStep('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }

    setIsLoading(false);
  };

  const handleJoinSession = async () => {
    if (!joinCode.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await collabManager.joinSession(joinCode);
      const offer = result?.offer;
      
      if (signalingMode === 'manual' && offer) {
        // Serialize the offer for manual exchange
        const serialized = SignalingService.serializeMessage({
          type: 'offer',
          sdp: offer.sdp!,
          senderId: signalingServiceRef.current?.getMyId() || '',
          sessionCode: joinCode,
        });
        setPendingOffer(serialized);
        setSignalingStep('offer-created');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    }

    setIsLoading(false);
  };

  const handleIncomingOffer = async (offer: RTCSessionDescriptionInit, participantId: string) => {
    try {
      // Process the offer through the collab manager
      const answer = await collabManager.handleJoinRequest(offer, participantId, userName);
      
      if (answer && signalingMode === 'manual') {
        const serialized = SignalingService.serializeMessage({
          type: 'answer',
          sdp: answer.sdp!,
          senderId: signalingServiceRef.current?.getMyId() || '',
          targetId: participantId,
        });
        setPendingAnswer(serialized);
        setSignalingStep('answer-created');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process offer');
    }
  };

  const handleIncomingAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      await collabManager.handleAnswer(answer);
      setSignalingStep('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process answer');
    }
  };

  const handleIncomingIceCandidate = async (candidate: RTCIceCandidateInit, participantId: string) => {
    await collabManager.addIceCandidate(participantId, candidate);
  };

  const processManualAnswer = () => {
    if (!pendingAnswer.trim()) return;
    
    const message = SignalingService.deserializeMessage(pendingAnswer);
    if (message?.type === 'answer') {
      handleIncomingAnswer({ type: 'answer', sdp: message.sdp });
    }
  };

  const processManualOffer = () => {
    if (!pendingOffer.trim()) return;
    
    const message = SignalingService.deserializeMessage(pendingOffer);
    if (message?.type === 'offer') {
      handleIncomingOffer({ type: 'offer', sdp: message.sdp }, message.senderId);
    }
  };

  const handleDisconnect = async () => {
    await collabManager.disconnect();
    setSignalingStep('idle');
    setPendingOffer('');
    setPendingAnswer('');
  };

  const handleCopyCode = async () => {
    if (state?.sessionCode) {
      const success = await copyToClipboard(state.sessionCode);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleCopySignalingData = async (data: string) => {
    await copyToClipboard(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    collabManager.sendChat(chatMessage);
    setChatMessage('');
  };

  const handleUpdateUserName = () => {
    collabManager.setUserName(userName);
  };

  const getParticipantColor = (participant: CollabParticipant): string => {
    return participant.color || '#888';
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const renderManualSignaling = () => {
    if (signalingMode !== 'manual') return null;

    if (state?.isHost) {
      // Host view for manual signaling
      if (signalingStep === 'idle' && pendingOffer) {
        return (
          <div className={styles.signalingBox}>
            <h5>📥 Incoming Connection Request</h5>
            <p>A peer wants to join. Process their offer:</p>
            <textarea
              value={pendingOffer}
              readOnly
              rows={4}
              className={styles.signalingTextarea}
            />
            <button onClick={processManualOffer} className={styles.primaryButton}>
              Process Offer & Create Answer
            </button>
          </div>
        );
      }

      if (signalingStep === 'answer-created' && pendingAnswer) {
        return (
          <div className={styles.signalingBox}>
            <h5>📤 Send Answer to Client</h5>
            <p>Copy this answer and send it to the joining peer:</p>
            <textarea
              value={pendingAnswer}
              readOnly
              rows={6}
              className={styles.signalingTextarea}
            />
            <button 
              onClick={() => handleCopySignalingData(pendingAnswer)} 
              className={styles.secondaryButton}
            >
              {copied ? '✓ Copied!' : '📋 Copy Answer'}
            </button>
          </div>
        );
      }
    } else {
      // Client view for manual signaling
      if (signalingStep === 'offer-created' && pendingOffer) {
        return (
          <div className={styles.signalingBox}>
            <h5>📤 Send Offer to Host</h5>
            <p>Copy this offer and send it to the host:</p>
            <textarea
              value={pendingOffer}
              readOnly
              rows={6}
              className={styles.signalingTextarea}
            />
            <button 
              onClick={() => handleCopySignalingData(pendingOffer)} 
              className={styles.secondaryButton}
            >
              {copied ? '✓ Copied!' : '📋 Copy Offer'}
            </button>
            
            <div className={styles.signalingDivider}>
              <span>Then paste the answer below:</span>
            </div>
            
            <textarea
              value={pendingAnswer}
              onChange={(e) => setPendingAnswer(e.target.value)}
              placeholder="Paste answer from host here..."
              rows={4}
              className={styles.signalingTextarea}
            />
            <button 
              onClick={processManualAnswer}
              disabled={!pendingAnswer.trim()}
              className={styles.primaryButton}
            >
              Connect
            </button>
          </div>
        );
      }
    }

    return null;
  };

  const renderHostView = () => {
    if (!state?.isConnected) {
      return (
        <div className={styles.initialView}>
          <div className={styles.userNameSection}>
            <label>Your Name</label>
            <div className={styles.userNameInput}>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
              />
              <button onClick={handleUpdateUserName} className={styles.smallButton}>
                Update
              </button>
            </div>
          </div>

          <div className={styles.signalingMode}>
            <label>Signaling Mode</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="auto"
                  checked={signalingMode === 'auto'}
                  onChange={() => setSignalingMode('auto')}
                />
                Auto (WebSocket relay)
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="manual"
                  checked={signalingMode === 'manual'}
                  onChange={() => setSignalingMode('manual')}
                />
                Manual (Copy-paste SDP)
              </label>
            </div>
            {signalingMode === 'manual' && (
              <p className={styles.signalingHint}>
                Manual mode allows P2P connection without a relay server. 
                You'll exchange SDP offers/answers via copy-paste.
              </p>
            )}
          </div>

          <div className={styles.actionSection}>
            <h4>Host a Session</h4>
            <p>Share your current profile with your team in real-time.</p>
            <button
              className={styles.primaryButton}
              onClick={handleCreateSession}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : '🚀 Create Session'}
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>
      );
    }

    return (
      <div className={styles.sessionView}>
        <div className={styles.sessionHeader}>
          <div className={styles.sessionCode}>
            <span className={styles.codeLabel}>Session Code</span>
            <div className={styles.codeValue}>
              <strong>{formatSessionCode(state.sessionCode || '')}</strong>
              <button
                onClick={handleCopyCode}
                className={styles.copyButton}
                title="Copy to clipboard"
              >
                {copied ? '✓' : '📋'}
              </button>
            </div>
            <span className={styles.codeHint}>Share this code with your team</span>
          </div>

          <button onClick={handleDisconnect} className={styles.dangerButton}>
            End Session
          </button>
        </div>

        {renderManualSignaling()}

        <div className={styles.participantsSection}>
          <h4>Participants ({state.participants.length})</h4>
          <div className={styles.participantsList}>
            {state.participants.map((participant) => (
              <div
                key={participant.id}
                className={styles.participantItem}
                style={{ borderLeftColor: getParticipantColor(participant) }}
              >
                <div
                  className={styles.participantAvatar}
                  style={{ backgroundColor: getParticipantColor(participant) }}
                >
                  {participant.name.charAt(0).toUpperCase()}
                </div>
                <div className={styles.participantInfo}>
                  <span className={styles.participantName}>
                    {participant.name}
                    {participant.isHost && (
                      <span className={styles.hostBadge}>Host</span>
                    )}
                  </span>
                  <span className={styles.participantStatus}>
                    {participant.cursor ? 'Active' : 'Connected'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.chatSection}>
          <h4>Team Chat</h4>
          <div className={styles.chatMessages}>
            {state.messages.length === 0 ? (
              <div className={styles.emptyChat}>
                No messages yet. Start the conversation!
              </div>
            ) : (
              state.messages.map((msg: ChatMessage, idx) => (
                <div key={idx} className={styles.chatMessage}>
                  <span className={styles.chatSender}>{msg.senderId}</span>
                  <span className={styles.chatText}>{msg.text}</span>
                  <span className={styles.chatTime}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className={styles.chatInput}>
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Type a message..."
            />
            <button onClick={handleSendChat} disabled={!chatMessage.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderJoinView = () => {
    if (state?.isConnected) {
      return (
        <div className={styles.sessionView}>
          <div className={styles.sessionHeader}>
            <div className={styles.sessionInfo}>
              <span className={styles.connectedBadge}>● Connected</span>
              <span className={styles.sessionCodeDisplay}>
                Session: {formatSessionCode(state.sessionCode || '')}
              </span>
            </div>
            <button onClick={handleDisconnect} className={styles.dangerButton}>
              Leave Session
            </button>
          </div>

          <div className={styles.participantsSection}>
            <h4>Participants ({state.participants.length})</h4>
            <div className={styles.participantsList}>
              {state.participants.map((participant) => (
                <div
                  key={participant.id}
                  className={styles.participantItem}
                  style={{ borderLeftColor: getParticipantColor(participant) }}
                >
                  <div
                    className={styles.participantAvatar}
                    style={{ backgroundColor: getParticipantColor(participant) }}
                  >
                    {participant.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.participantInfo}>
                    <span className={styles.participantName}>
                      {participant.name}
                      {participant.isHost && (
                        <span className={styles.hostBadge}>Host</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.initialView}>
        <div className={styles.userNameSection}>
          <label>Your Name</label>
          <div className={styles.userNameInput}>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
            />
            <button onClick={handleUpdateUserName} className={styles.smallButton}>
              Update
            </button>
          </div>
        </div>

        <div className={styles.signalingMode}>
          <label>Signaling Mode</label>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                value="auto"
                checked={signalingMode === 'auto'}
                onChange={() => setSignalingMode('auto')}
              />
              Auto (WebSocket relay)
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                value="manual"
                checked={signalingMode === 'manual'}
                onChange={() => setSignalingMode('manual')}
              />
              Manual (Copy-paste SDP)
            </label>
          </div>
        </div>

        <div className={styles.actionSection}>
          <h4>Join a Session</h4>
          <p>Enter the 6-digit code shared by your teammate.</p>
          
          <div className={styles.joinInput}>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XX-XX-00"
              maxLength={8}
              className={styles.codeInput}
            />
            <button
              className={styles.primaryButton}
              onClick={handleJoinSession}
              disabled={isLoading || joinCode.length < 6}
            >
              {isLoading ? 'Joining...' : '🔗 Join'}
            </button>
          </div>
        </div>

        {renderManualSignaling()}

        {error && <div className={styles.error}>{error}</div>}
      </div>
    );
  };

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>👥 Team Session</h2>
        {state?.isConnected && (
          <span className={styles.liveIndicator}>
            <span className={styles.liveDot} /> LIVE
          </span>
        )}
      </div>

      {!state?.isConnected && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'host' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('host')}
          >
            Host Session
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'join' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('join')}
          >
            Join Session
          </button>
        </div>
      )}

      <div className={styles.content}>
        {activeTab === 'host' || state?.isHost ? renderHostView() : renderJoinView()}
      </div>

      {state?.isConnected && (
        <div className={styles.featuresInfo}>
          <h5>Session Features</h5>
          <ul>
            <li>✓ Real-time profile sharing</li>
            <li>✓ Shared annotations on components</li>
            <li>✓ Live cursor tracking</li>
            <li>✓ Team chat</li>
            <li>✓ Synchronized time-travel</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default TeamSessionPanel;
