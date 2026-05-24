/**
 * WebSocket connection to the Chrome extension background service worker.
 * Receives analysis results and commit data in real-time.
 */

import * as vscode from 'vscode';
import type { AnalysisPayload, WSMessage } from './types';

type MessageHandler = (message: WSMessage) => void;

export class PanelConnection {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private port: number;
  private _isConnected = false;

  constructor(port: number) {
    this.port = port;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.onopen = () => {
        this._isConnected = true;
        vscode.window.setStatusBarMessage('$(check) React Perf: Connected', 3000);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data as string);
          for (const handler of this.handlers) {
            handler(message);
          }
        } catch {
          // ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this._isConnected = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this._isConnected = false;
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
  }

  dispose(): void {
    this.disconnect();
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }
}
