// Game settings
const PHYSICS_TICK = 1/60;
const PLATFORM_RADIUS = 15;
const PLATFORM_HEIGHT = 1;
const BALL_RADIUS = 1;
const BALL_MASS = 8;
const GRAVITY = 9.8;
const MAX_PLAYERS = 8;
const MOVEMENT_FORCE = 35;
const SHRINK_RATE = 0.08;
const SHRINK_INTERVAL = 4000;
const COLORS = [
  '#ff0000', // red
  '#00ff00', // green
  '#0066ff', // blue
  '#ffff00', // yellow
  '#ff00ff', // magenta
  '#00ffff', // cyan
  '#ff8000', // orange
  '#8000ff'  // purple
];

// Physics defaults for control panel
const PHYSICS_DEFAULTS = {
  movementForce: MOVEMENT_FORCE,
  baseFriction: 0.92,
  edgeFriction: 0.15,
  centerPull: 0.2,
  restitution: 2.2,
  randomFactor: 0.4
};

// Powerup types (for future implementation)
const POWERUP_TYPES = {
  SPEED: 'speed',
  MASS: 'mass',
  BOUNCE: 'bounce',
  FREEZE: 'freeze',
  PUSH: 'push'
};

// Game states
const GAME_STATES = {
  WAITING: 'waiting',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  GAME_OVER: 'gameOver'
};

// Message types
const MSG_TYPES = {
  JOIN_GAME: 'joinGame',
  GAME_STATE: 'gameState',
  PLAYER_MOVE: 'playerMove',
  PLAYER_UPDATE: 'playerUpdate',
  PLAYER_LEFT: 'playerLeft',
  GAME_OVER: 'gameOver',
  RESTART_GAME: 'restartGame',
  POWERUP_SPAWN: 'powerupSpawn',
  POWERUP_COLLECT: 'powerupCollect',
  UPDATE_PHYSICS: 'updatePhysics'
};

module.exports = {
  PHYSICS_TICK,
  PLATFORM_RADIUS,
  PLATFORM_HEIGHT,
  BALL_RADIUS,
  BALL_MASS,
  GRAVITY,
  MAX_PLAYERS,
  MOVEMENT_FORCE,
  SHRINK_RATE,
  SHRINK_INTERVAL,
  COLORS,
  POWERUP_TYPES,
  PHYSICS_DEFAULTS,
  GAME_STATES,
  MSG_TYPES
};
