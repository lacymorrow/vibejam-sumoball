# Sumo Ball Game Deployment Guide

## Overview
This document outlines the deployment process for the Sumo Ball Game on Fly.io, a multiplayer WebSocket-based game. The application consists of a Node.js backend and a browser-based front-end.

## Prerequisites
- Node.js v18+
- npm
- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io account

## Deployment Steps

### 1. Initial Setup
```bash
# Install the Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Log in to Fly.io
fly auth login

# Initialize the app (if not already done)
fly launch
```

### 2. Configuration
The application is configured through `fly.toml`:

```toml
# Key configuration points:
# - Uses Node.js 18
# - Listens on port 4111
# - Exposes HTTP and WebSocket traffic
```

Ensure your `fly.toml` includes these important settings:

```toml
[http_service]
  internal_port = 4111
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[services]]
  protocol = "tcp"
  internal_port = 4111
  processes = ["app"]
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true
  
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

### 3. Deployment
Deploy the application with:

```bash
fly deploy
```

### 4. Checking Status and Logs
```bash
# Check the status of your app
fly status

# View the logs
fly logs
```

## Technical Details

### WebSocket Configuration

#### Server-Side (server/index.js)
The Socket.IO server is configured with:
```javascript
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});
```

Key settings:
- **CORS**: Allows connections from any origin
- **Transport**: Only uses WebSocket (no polling fallback)
- **Ping Timing**: Extended timeouts for better connection stability
- **EIO Compatibility**: Enabled for broader client support

#### Client-Side (src/client/Game.js)
The Socket.IO client connects with:
```javascript
this.socket = io('wss://sumo-ball-game.fly.dev', {
  transports: ['websocket'],
  secure: true,
  rejectUnauthorized: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

Key settings:
- **WebSocket URL**: Uses secure WebSocket protocol (wss://)
- **Transport**: Forces WebSocket transport
- **Security**: Allows connections with self-signed certificates
- **Reconnection**: Automatically attempts to reconnect on disconnection

### Server Port Configuration
The server listens on port 4111 (configured in server/index.js):
```javascript
const PORT = process.env.PORT || 4111;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
```

## Troubleshooting

### Common Issues

#### Connection Issues
If the client shows "connecting" but never connects:
1. Check server logs with `fly logs`
2. Verify the correct WebSocket URL is used in client code
3. Ensure the server's CORS settings allow your client origin

#### Stack Size Error
If you see `RangeError: Maximum call stack size exceeded`:
1. Check for circular JSON references in your Socket.IO messages
2. Avoid sending complex nested objects with circular references

#### Proxy Errors
If you see errors about a route not found:
1. Verify the `fly.toml` configuration includes TCP service setup
2. Make sure internal_port matches the port your server listens on

### Fixes Applied
1. Removed duplicate socket initialization calls
2. Updated Socket.IO server CORS configuration
3. Fixed client-side WebSocket URL to use secure protocol
4. Added reconnection handling to client configuration

## Scaling and Performance
- Fly.io automatically scales the application based on traffic
- The application is configured to automatically stop when inactive and start on demand
- For consistent availability, adjust the `min_machines_running` setting in `fly.toml`

## Security Considerations
- The current configuration allows connections from any origin (`"*"`)
- For production, restrict CORS to specific domains if possible
- Consider implementing authentication for WebSocket connections 
