# Team sessions (WebRTC collaboration)

The **Team** view in the DevTools panel uses peer-to-peer WebRTC for optional real-time profile sharing. Signaling can run in two modes:

## Manual (copy-paste SDP)

Works without any server: peers exchange SDP offer/answer (and ICE candidates) out-of-band (chat, ticket, etc.). Best for quick demos or locked-down networks.

## Auto (WebSocket relay)

Requires a **signaling server** that forwards SDP messages between peers. The panel does not ship a hosted relay; you run your own compatible WebSocket service or use a team-internal deployment.

### Configure the relay URL at build time

Set the Vite env variable **`VITE_COLLAB_RELAY_URL`** to your WebSocket URL (e.g. `wss://signaling.example.com`).

```bash
VITE_COLLAB_RELAY_URL=wss://your-relay.example.com pnpm build
```

If **Auto** mode is selected but no URL is configured, the UI prompts you to use **Manual** mode or set `VITE_COLLAB_RELAY_URL` — the extension does not assume a public third-party relay.

### Relay protocol

The client uses [SignalingService](../src/shared/collab/SignalingService.ts): JSON messages over WebSocket (`offer`, `answer`, `ice-candidate`, etc.). A minimal relay forwards messages by `sessionCode` / peer id; production relays should authenticate and rate-limit.

## Privacy

Session data is exchanged peer-to-peer (or via your relay for signaling only). See the [privacy policy](store-assets/privacy/index.html) for optional features that leave the device.
