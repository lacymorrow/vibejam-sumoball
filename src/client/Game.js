import gsap from 'gsap';
import io from 'socket.io-client';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GAME_STATES, MSG_TYPES, PHYSICS_DEFAULTS, POWERUP_TYPES } from '../shared/constants';

export default class Game {
  constructor() {
    // Game properties
    this.players = {};
    this.playerId = null;
    this.gameState = GAME_STATES.WAITING;
    this.platformSize = 15;
    this.powerups = {}; // Track active powerups

    // Physics parameters
    this.physicsParams = { ...PHYSICS_DEFAULTS };

    // Timer properties for solo play
    this.soloTimer = 0;
    this.soloTimerInterval = null;
    this.bestTime = localStorage.getItem('sumo-best-time') || 0;

    // THREE.js properties
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.platform = null;
    this.water = null;

    // Input state
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    // Joystick properties
    this.joystickActive = false;
    this.joystickPosition = { x: 0, y: 0 };
    this.isMobile = false;

    // Control panel
    this.controlPanelVisible = false;
    this.controlPanel = null;

    // Socket connection
    this.socket = io('wss://sumo-ball-game.fly.dev', {
      transports: ['websocket'],
      secure: true,
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Bind methods
    this.animate = this.animate.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    this.initJoystick = this.initJoystick.bind(this);
    this.onJoystickStart = this.onJoystickStart.bind(this);
    this.onJoystickMove = this.onJoystickMove.bind(this);
    this.onJoystickEnd = this.onJoystickEnd.bind(this);
    this.toggleControlPanel = this.toggleControlPanel.bind(this);
    this.updatePhysicsParameter = this.updatePhysicsParameter.bind(this);
    this.resetPhysicsParameters = this.resetPhysicsParameters.bind(this);

    // Socket events
    this.setupSocketEvents();
  }

  init() {
    // Check if device is mobile
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    this.initRenderer();
    this.initScene();
    this.initLights();
    this.initControls();
    this.createPlatform();
    this.createWater();
    this.createAtmosphere();
    this.initInputEvents();
    this.createControlPanel();

    // Initialize joystick for mobile devices
    if (this.isMobile) {
      this.initJoystick();
    }

    // Start animation loop
    this.animate();

    // Auto-join game with a generated username
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit number
    const playerName = `Player${randomSuffix}`;
    this.joinGame(playerName);

    // Add window resize handler
    window.addEventListener('resize', this.onWindowResize);
  }

  initRenderer() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);
  }

  initScene() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 1000
    );
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // Add particle system for ambient atmosphere
    this.createAtmosphere();
  }

  initLights() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    // Add directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 15, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    this.scene.add(dirLight);
  }

  initControls() {
    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 50;
    this.controls.maxPolarAngle = Math.PI / 2;
  }

  createPlatform() {
    // Create platform geometry with improved materials
    const geometry = new THREE.CylinderGeometry(this.platformSize, this.platformSize, 1, 32);

    // Create texture-based material for better visuals
    const platformTexture = this.createPlatformTexture();
    const material = new THREE.MeshStandardMaterial({
      map: platformTexture,
      roughness: 0.7,
      metalness: 0.2,
      bumpMap: platformTexture,
      bumpScale: 0.05
    });

    this.platform = new THREE.Mesh(geometry, material);
    this.platform.position.y = -0.5;
    this.platform.receiveShadow = true;
    this.scene.add(this.platform);

    // Add platform edge with glow effect
    const edgeGeometry = new THREE.TorusGeometry(this.platformSize, 0.3, 16, 100);
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3030,
      transparent: true,
      opacity: 0.9
    });

    this.platformEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    this.platformEdge.rotation.x = Math.PI / 2;
    this.platformEdge.position.y = 0;
    this.scene.add(this.platformEdge);

    // Add helper arrows for solo play guidance
    this.soloPlayHelpers = new THREE.Group();
    this.scene.add(this.soloPlayHelpers);
    this.updateSoloPlayHelpers();
  }

  createPlatformTexture() {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    // Fill background
    context.fillStyle = '#777777';
    context.fillRect(0, 0, size, size);

    // Add circular pattern
    for (let i = 0; i < 5; i++) {
      const radius = size * (0.2 + i * 0.15);
      context.strokeStyle = `rgba(100,100,100,${0.7 - i * 0.1})`;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(size/2, size/2, radius, 0, Math.PI * 2);
      context.stroke();
    }

    // Add some noise for texture
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const brightness = Math.random() * 30 + 50;
      const radius = Math.random() * 2 + 1;

      context.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  updateSoloPlayHelpers() {
    // Clear existing helpers
    while(this.soloPlayHelpers.children.length > 0) {
      this.soloPlayHelpers.remove(this.soloPlayHelpers.children[0]);
    }

    // Count active players
    const activePlayers = Object.values(this.players).filter(p => p.active).length;

    // Show helpers only in solo play and when game is playing
    if (activePlayers === 1 && this.gameState === GAME_STATES.PLAYING) {
      // Create directional arrows to guide the player
      const directions = [
        { x: 0, z: -1, angle: 0 },          // North
        { x: 1, z: -1, angle: Math.PI/4 },  // Northeast
        { x: 1, z: 0, angle: Math.PI/2 },   // East
        { x: 1, z: 1, angle: 3*Math.PI/4 }, // Southeast
        { x: 0, z: 1, angle: Math.PI },     // South
        { x: -1, z: 1, angle: 5*Math.PI/4 },// Southwest
        { x: -1, z: 0, angle: 3*Math.PI/2 },// West
        { x: -1, z: -1, angle: 7*Math.PI/4 }// Northwest
      ];

      directions.forEach(dir => {
        const arrowMesh = this.createArrow();
        // Position around the platform perimeter
        arrowMesh.position.set(
          dir.x * (this.platformSize - 1),
          0.5,
          dir.z * (this.platformSize - 1)
        );
        arrowMesh.rotation.y = dir.angle;
        this.soloPlayHelpers.add(arrowMesh);
      });
    }
  }

  createArrow() {
    const arrowGroup = new THREE.Group();

    // Arrow body
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.1, 1.5);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x33aaff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.z = -0.5;
    arrowGroup.add(body);

    // Arrow head
    const headGeometry = new THREE.ConeGeometry(0.4, 0.8, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0x33aaff });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.z = -1.5;
    head.rotation.x = Math.PI / 2;
    arrowGroup.add(head);

    // Make the arrow pulse
    arrowGroup.userData = {
      pulseTime: Math.random() * Math.PI * 2 // Random start phase
    };

    return arrowGroup;
  }

  createWater() {
    // Create water plane with improved visual effects
    const waterGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);

    // Create custom water shader material
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide
    });

    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -5;
    this.scene.add(this.water);

    // Animate water vertices for wave effect
    const vertices = waterGeometry.attributes.position.array;
    waterGeometry.userData = {
      originalVertices: [...vertices],
      time: 0
    };
  }

  createPlayerBall(player) {
    // Create ball geometry
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: player.color,
      roughness: 0.3,
      metalness: 0.7
    });

    const ball = new THREE.Mesh(geometry, material);
    ball.castShadow = true;
    ball.receiveShadow = true;

    // Add name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText(player.name, 128, 24);

    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(4, 1, 1);
    label.position.y = 2;

    // Add trail effect
    const trail = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const trailGeometry = new THREE.SphereGeometry(0.8 - i * 0.15, 16, 16);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: player.color,
        transparent: true,
        opacity: 0.7 - i * 0.15
      });
      const trailSphere = new THREE.Mesh(trailGeometry, trailMaterial);
      trailSphere.visible = false;
      trail.add(trailSphere);
    }
    this.scene.add(trail);

    // Add force ring effect for when player is moving fast
    const ringGeometry = new THREE.RingGeometry(1.2, 1.5, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: player.color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const forceRing = new THREE.Mesh(ringGeometry, ringMaterial);
    forceRing.rotation.x = Math.PI / 2;
    ball.add(forceRing);

    ball.add(label);
    this.scene.add(ball);

    return {
      mesh: ball,
      trail: trail,
      trailPositions: [],
      lastPosition: new THREE.Vector3(),
      forceRing: forceRing
    };
  }

  updatePlatformSize(size) {
    if (!this.platform) return; // Guard against the platform not being initialized yet

    // Store current platform position and rotation
    const currentPosition = this.platform.position.clone();
    const currentRotation = this.platform.rotation.clone();

    // Remove the current platform and edge
    if (this.platformEdge) {
      this.scene.remove(this.platformEdge);
    }

    // Update with new size, but don't remove from scene
    const geometry = new THREE.CylinderGeometry(size, size, 1, 32);
    this.platform.geometry.dispose();
    this.platform.geometry = geometry;

    // Restore position and rotation
    this.platform.position.copy(currentPosition);
    this.platform.rotation.copy(currentRotation);

    // Add platform edge with glow effect
    const edgeGeometry = new THREE.TorusGeometry(size, 0.3, 16, 100);
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3030,
      transparent: true,
      opacity: 0.9
    });

    this.platformEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    this.platformEdge.rotation.x = Math.PI / 2;
    this.platformEdge.position.y = 0;
    this.scene.add(this.platformEdge);

    // Update the visuals of the platform
    this.updateSoloPlayHelpers();
  }

  joinGame(playerName) {
    this.socket.emit(MSG_TYPES.JOIN_GAME, { name: playerName });
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = 'Connected';
    }
  }

  setupSocketEvents() {
    // Game state update
    this.socket.on(MSG_TYPES.GAME_STATE, (data) => {
      const previousState = this.gameState;
      this.gameState = data.state;

      // Only update platform size when the value actually changes
      if (data.platformSize !== undefined && data.platformSize !== this.platformSize) {
        this.platformSize = data.platformSize;
        this.updatePlatformSize(this.platformSize);
      }

      // Update UI with better state information
      const statusElement = document.getElementById('status');
      const statusIndicator = document.getElementById('status-indicator');
      const gameStatusElement = document.getElementById('game-status');

      // Add null checks before accessing properties
      if (statusElement) {
        // Clear previous state classes
        statusElement.classList.remove('game-state-waiting', 'game-state-countdown', 'game-state-playing', 'game-state-gameover');

        // Add appropriate state class
        statusElement.classList.add(`game-state-${this.gameState.toLowerCase()}`);
      }

      // Update status messages and indicator
      switch (this.gameState) {
        case GAME_STATES.WAITING:
          if (statusElement) statusElement.textContent = 'Waiting for Players ';
          if (statusIndicator) statusIndicator.style.backgroundColor = '#FFC107'; // Yellow
          if (gameStatusElement) {
            gameStatusElement.textContent = 'Waiting for Players';
            gameStatusElement.style.opacity = '0.8';
            setTimeout(() => {
              if (gameStatusElement) gameStatusElement.style.opacity = '0';
            }, 2000);
          }
          break;
        case GAME_STATES.COUNTDOWN:
          if (statusElement) statusElement.textContent = 'Game Starting ';
          if (statusIndicator) statusIndicator.style.backgroundColor = '#2196F3'; // Blue
          // Countdown handled by showCountdown method
          break;
        case GAME_STATES.PLAYING:
          if (statusElement) statusElement.textContent = 'Game In Progress ';
          if (statusIndicator) statusIndicator.style.backgroundColor = '#4CAF50'; // Green
          if (gameStatusElement) {
            gameStatusElement.textContent = 'Go!';
            gameStatusElement.style.opacity = '0.8';
            setTimeout(() => {
              if (gameStatusElement) gameStatusElement.style.opacity = '0';
            }, 1000);
          }
          break;
        case GAME_STATES.GAME_OVER:
          if (statusElement) statusElement.textContent = 'Game Over ';
          if (statusIndicator) statusIndicator.style.backgroundColor = '#F44336'; // Red
          if (gameStatusElement) {
            gameStatusElement.textContent = 'Game Over';
            gameStatusElement.style.opacity = '0.8';
            setTimeout(() => {
              if (gameStatusElement) gameStatusElement.style.opacity = '0';
            }, 2000);
          }
          break;
      }

      // Add status indicator back to the status element
      if (statusElement && statusIndicator) {
        statusElement.appendChild(statusIndicator);
      }

      // Show countdown if in countdown state
      if (this.gameState === GAME_STATES.COUNTDOWN) {
        this.showCountdown();
      }

      // Create players if provided
      if (data.players) {
        data.players.forEach(player => {
          if (!this.players[player.id]) {
            this.players[player.id] = {
              ...player,
              ...this.createPlayerBall(player)
            };
          }
        });
      }

      // Set player ID
      if (data.playerId) {
        this.playerId = data.playerId;
      }

      // Handle solo play UI
      this.updateSoloPlayUI();

      // Reset and start timer if the game is starting
      if (previousState !== GAME_STATES.PLAYING && this.gameState === GAME_STATES.PLAYING) {
        this.resetSoloTimer();
        this.startSoloTimer();
      }

      // Stop timer if game ended
      if (previousState === GAME_STATES.PLAYING && this.gameState !== GAME_STATES.PLAYING) {
        this.stopSoloTimer();
      }

      // Hide fallen message if game restarting
      if (this.gameState === GAME_STATES.WAITING || this.gameState === GAME_STATES.COUNTDOWN) {
        const fallenMsg = document.getElementById('fallen-message');
        if (fallenMsg) {
          fallenMsg.style.display = 'none';
        }
      }

      // Update physics parameters if provided
      if (data.physicsParams) {
        this.physicsParams = data.physicsParams;
        this.updateControlPanelValues();
      }
    });

    // Player updates
    this.socket.on(MSG_TYPES.PLAYER_UPDATE, (data) => {
      // Handle both single player and array updates
      const players = Array.isArray(data) ? data : [data];

      players.forEach(player => {
        // Create new player if needed
        if (!this.players[player.id]) {
          this.players[player.id] = {
            ...player,
            ...this.createPlayerBall(player)
          };
        } else {
          // Update existing player
          this.players[player.id] = {
            ...this.players[player.id],
            ...player
          };

          // Apply visual effects for powerups if present
          if (player.activePowerup) {
            this.applyPowerupVisualEffect(player.id, player.activePowerup, player.activePowerupEndsAt);
          }
        }
      });

      // Update player list UI
      this.updatePlayerList();
    });

    // Player left
    this.socket.on(MSG_TYPES.PLAYER_LEFT, (playerId) => {
      if (this.players[playerId]) {
        if (this.players[playerId].mesh) {
          this.scene.remove(this.players[playerId].mesh);
        }
        if (this.players[playerId].trail) {
          this.scene.remove(this.players[playerId].trail);
        }
        delete this.players[playerId];
      }

      // Update player list UI
      this.updatePlayerList();
    });

    // Game over
    this.socket.on(MSG_TYPES.GAME_OVER, (data) => {
      const gameOverUI = document.getElementById('game-over');
      const winnerText = document.getElementById('winner-text');
      const scoreText = document.getElementById('score-text');

      // Stop the timer if running
      this.stopSoloTimer();

      if (data.winnerId) {
        if (this.isSoloPlay() && data.winnerId === this.playerId) {
          // Solo play victory
          winnerText.textContent = 'Practice Complete!';

          // Update best time
          if (this.soloTimer > this.bestTime) {
            this.bestTime = this.soloTimer;
            localStorage.setItem('sumo-best-time', this.bestTime);
            scoreText.textContent = `New best time: ${this.formatTime(this.soloTimer)}`;
          } else {
            scoreText.textContent = `Time: ${this.formatTime(this.soloTimer)} (Best: ${this.formatTime(this.bestTime)})`;
          }
        } else {
          // Multiplayer victory
          winnerText.textContent = `Winner: ${data.winnerName || 'Unknown'}`;
          scoreText.textContent = '';
        }
      } else {
        winnerText.textContent = 'Game Over';

        if (this.isSoloPlay()) {
          scoreText.textContent = `Time: ${this.formatTime(this.soloTimer)} (Best: ${this.formatTime(this.bestTime)})`;
        } else {
          scoreText.textContent = '';
        }
      }

      gameOverUI.style.display = 'block';

      // Hide game over UI after 5 seconds
      setTimeout(() => {
        gameOverUI.style.display = 'none';
      }, 5000);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(`Error: ${error.message}`);
    });

    // Restart button
    document.getElementById('restart-button').addEventListener('click', () => {
      this.restartGame();
    });

    // Handle physics parameter updates
    this.socket.on(MSG_TYPES.UPDATE_PHYSICS, (params) => {
      this.physicsParams = params;
      this.updateControlPanelValues();
    });

    // Handle powerup spawning
    this.socket.on(MSG_TYPES.POWERUP_SPAWN, (powerup) => {
      this.createPowerup(powerup);
    });

    // Handle powerup collection
    this.socket.on(MSG_TYPES.POWERUP_COLLECT, (data) => {
      this.collectPowerup(data.powerupId, data.playerId, data.type);
    });
  }

  initInputEvents() {
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  initJoystick() {
    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystick-knob');

    // Touch events for joystick
    joystick.addEventListener('touchstart', this.onJoystickStart);
    joystick.addEventListener('touchmove', this.onJoystickMove);
    joystick.addEventListener('touchend', this.onJoystickEnd);

    // For testing on desktop
    joystick.addEventListener('mousedown', this.onJoystickStart);
    document.addEventListener('mousemove', this.onJoystickMove);
    document.addEventListener('mouseup', this.onJoystickEnd);
  }

  onJoystickStart(e) {
    e.preventDefault();
    this.joystickActive = true;

    // Update joystick position
    this.updateJoystickKnob(e);
  }

  onJoystickMove(e) {
    e.preventDefault();
    if (!this.joystickActive) return;

    // Update joystick position
    this.updateJoystickKnob(e);

    // Update input based on joystick position
    this.updateJoystickInput();
  }

  onJoystickEnd(e) {
    e.preventDefault();
    this.joystickActive = false;

    // Reset joystick position
    const joystickKnob = document.getElementById('joystick-knob');
    joystickKnob.style.transform = 'translate(-50%, -50%)';
    this.joystickPosition = { x: 0, y: 0 };

    // Reset input
    this.keys.up = false;
    this.keys.down = false;
    this.keys.left = false;
    this.keys.right = false;
    this.sendInput();
  }

  updateJoystickKnob(e) {
    const joystick = document.getElementById('joystick');
    const joystickKnob = document.getElementById('joystick-knob');
    const joystickRect = joystick.getBoundingClientRect();

    // Get touch or mouse position
    let clientX, clientY;
    if (e.type.startsWith('touch')) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate joystick position relative to center
    const centerX = joystickRect.left + joystickRect.width / 2;
    const centerY = joystickRect.top + joystickRect.height / 2;
    let x = clientX - centerX;
    let y = clientY - centerY;

    // Limit joystick movement to within the boundary
    const radius = joystickRect.width / 2;
    const distance = Math.sqrt(x * x + y * y);
    if (distance > radius) {
      x = (x / distance) * radius;
      y = (y / distance) * radius;
    }

    // Update joystick knob position
    joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    // Save normalized position (-1 to 1)
    this.joystickPosition = {
      x: x / radius,
      y: y / radius
    };
  }

  updateJoystickInput() {
    // Convert joystick position to input
    const threshold = 0.3;
    const x = this.joystickPosition.x;
    const y = this.joystickPosition.y;

    // First set the keys based on raw joystick input
    this.keys.up = y < -threshold;
    this.keys.down = y > threshold;
    this.keys.left = x < -threshold;
    this.keys.right = x > threshold;

    // The camera-relative transformation happens in sendInput via getTransformedInput
    this.sendInput();
  }

  onKeyDown(event) {
    if (this.gameState !== GAME_STATES.PLAYING) return;

    switch (event.key) {
      case 'w':
      case 'ArrowUp':
        this.keys.up = true;
        break;
      case 's':
      case 'ArrowDown':
        this.keys.down = true;
        break;
      case 'a':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'd':
      case 'ArrowRight':
        this.keys.right = true;
        break;
    }

    this.sendInput();
  }

  onKeyUp(event) {
    switch (event.key) {
      case 'w':
      case 'ArrowUp':
        this.keys.up = false;
        break;
      case 's':
      case 'ArrowDown':
        this.keys.down = false;
        break;
      case 'a':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'd':
      case 'ArrowRight':
        this.keys.right = false;
        break;
    }

    this.sendInput();
  }

  sendInput() {
    // Transform the input based on camera orientation before sending
    const transformedInput = this.getTransformedInput();
    this.socket.emit(MSG_TYPES.PLAYER_MOVE, transformedInput);
  }

  /**
   * Transform raw input keys to camera-relative directions
   * This makes player movement relative to the camera view
   */
  getTransformedInput() {
    if (!this.camera) {
      return this.keys;
    }

    // Create a copy of the current input state
    const transformedInput = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    // Get camera forward and right vectors
    // We're only concerned with horizontal movement, so we zero out the Y component
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    cameraForward.y = 0;
    cameraForward.normalize();

    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    cameraRight.y = 0;
    cameraRight.normalize();

    // Determine movement vector based on input type
    let movementVector = new THREE.Vector3();

    // If using joystick and it's active, use direct joystick vector
    if (this.isMobile && this.joystickActive && (Math.abs(this.joystickPosition.x) > 0.1 || Math.abs(this.joystickPosition.y) > 0.1)) {
      // Use joystick vector directly for smoother control
      // Convert joystick input (which is in screen space) to world space
      movementVector.add(cameraForward.clone().multiplyScalar(-this.joystickPosition.y));
      movementVector.add(cameraRight.clone().multiplyScalar(this.joystickPosition.x));
    } else {
      // For keyboard input, use the cardinal directions
      if (this.keys.up) movementVector.add(cameraForward.clone());
      if (this.keys.down) movementVector.add(cameraForward.clone().negate());
      if (this.keys.left) movementVector.add(cameraRight.clone().negate());
      if (this.keys.right) movementVector.add(cameraRight.clone());
    }

    // If there's no input, return empty input
    if (movementVector.length() === 0) {
      return transformedInput;
    }

    // Normalize the movement vector
    movementVector.normalize();

    // Calculate which cardinal direction the movement vector is closest to
    // This converts our analog direction back to digital for the server
    const dotProducts = {
      up: movementVector.dot(new THREE.Vector3(0, 0, -1)),
      down: movementVector.dot(new THREE.Vector3(0, 0, 1)),
      left: movementVector.dot(new THREE.Vector3(-1, 0, 0)),
      right: movementVector.dot(new THREE.Vector3(1, 0, 0))
    };

    // Activate inputs based on strongest direction components
    // Use threshold to allow diagonal movement
    const threshold = 0.3;
    transformedInput.up = dotProducts.up > threshold;
    transformedInput.down = dotProducts.down > threshold;
    transformedInput.left = dotProducts.left > threshold;
    transformedInput.right = dotProducts.right > threshold;

    return transformedInput;
  }

  updatePlayerList() {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';

    Object.values(this.players).forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.style.color = player.color;

      // Add crown for current player
      const playerName = player.id === this.playerId ?
        `👑 ${player.name} (You)` : player.name;

      // Strike through text for inactive players
      playerDiv.innerHTML = player.active ?
        playerName : `<s>${playerName}</s>`;

      playerList.appendChild(playerDiv);
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const time = Date.now() * 0.001; // Current time in seconds

    // Animate water for wave effect
    if (this.water && this.water.geometry.userData) {
      const geometry = this.water.geometry;
      const originalVertices = geometry.userData.originalVertices;
      const positions = geometry.attributes.position.array;

      for (let i = 0; i < positions.length; i += 3) {
        const x = originalVertices[i];
        const z = originalVertices[i + 2];
        // Create wave pattern
        positions[i + 1] =
          Math.sin(x * 0.05 + time) * 0.5 +
          Math.sin(z * 0.05 + time * 0.8) * 0.5;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    }

    // Animate platform edge glow
    if (this.platformEdge) {
      const edgePulse = (Math.sin(time * 2) * 0.2) + 0.8;
      this.platformEdge.material.opacity = edgePulse;
      this.platformEdge.scale.set(1, 1, edgePulse);
    }

    // Animate solo play helper arrows
    if (this.soloPlayHelpers) {
      this.soloPlayHelpers.children.forEach(arrow => {
        if (arrow.userData) {
          arrow.userData.pulseTime += 0.05;
          const pulse = Math.sin(arrow.userData.pulseTime) * 0.2 + 0.8;
          arrow.scale.set(pulse, pulse, pulse);
        }
      });

      // Check if we need to update helpers (player fell, etc)
      const activePlayers = Object.values(this.players).filter(p => p.active).length;
      if (activePlayers <= 1) {
        this.updateSoloPlayHelpers();
      }
    }

    // Animate particles
    if (this.particleSystem) {
      this.particleSystem.rotation.y += this.particleSystem.userData.rotationSpeed;

      // Make particles twinkle
      const particleMaterial = this.particleSystem.material;
      particleMaterial.opacity = 0.4 + Math.sin(time * 3) * 0.1;
    }

    // Update player positions
    Object.values(this.players).forEach(player => {
      if (player.mesh) {
        // Update main ball position
        player.mesh.position.x = player.x;
        player.mesh.position.y = player.y;
        player.mesh.position.z = player.z;

        // Add rotation based on movement
        if (player.active) {
          // Calculate rotation based on velocity
          const speed = Math.sqrt(player.vx * player.vx + player.vz * player.vz);

          if (speed > 0.1) {
            // Calculate rotation axis (perpendicular to movement direction)
            const rotationAxis = new THREE.Vector3(-player.vz, 0, player.vx).normalize();
            player.mesh.quaternion.setFromAxisAngle(
              rotationAxis,
              speed * 0.1 // Rotation amount
            );

            // Update force ring effect based on speed
            if (player.forceRing) {
              player.forceRing.material.opacity = Math.min(0.7, speed / 10);
              player.forceRing.scale.set(1 + speed / 20, 1 + speed / 20, 1);
            }
          } else if (player.forceRing) {
            player.forceRing.material.opacity = 0;
          }
        }

        // Update trail effect
        if (player.trail) {
          // Calculate speed for trail intensity
          const currentPos = new THREE.Vector3(player.x, player.y, player.z);
          const speed = currentPos.distanceTo(player.lastPosition);

          // Only show trail when moving fast enough
          const showTrail = speed > 0.1 && player.active;

          // Add current position to trail positions if moving
          if (showTrail) {
            player.trailPositions.unshift({
              position: currentPos.clone(),
              time: Date.now()
            });

            // Limit trail length
            if (player.trailPositions.length > 5) {
              player.trailPositions.pop();
            }

            // Update trail meshes
            player.trail.children.forEach((trailSphere, i) => {
              if (i < player.trailPositions.length) {
                const trailPos = player.trailPositions[i].position;
                trailSphere.position.copy(trailPos);
                trailSphere.visible = true;

                // Scale trail based on speed
                const scale = Math.min(1, speed / 2);
                trailSphere.scale.set(scale, scale, scale);
              } else {
                trailSphere.visible = false;
              }
            });
          } else {
            // Hide trail when not moving
            player.trail.children.forEach(trailSphere => {
              trailSphere.visible = false;
            });
          }

          // Store position for next frame
          player.lastPosition.copy(currentPos);
        }

        // Add splash effect when player falls off
        if (player.id === this.playerId && !player.active && player.y > -8) {
          // Create splash particles
          if (!player.splashCreated && player.y < -4) {
            this.createSplashEffect(player.x, -5, player.z, player.color);
            player.splashCreated = true;

            // Show "Fallen!" message and automatic restart for the player who fell
            this.showFallenMessage();

            // Add camera animation to follow the fall
            if (this.camera) {
              const fallAnimation = { progress: 0 };
              const startPos = new THREE.Vector3().copy(this.camera.position);
              const waterLevel = -5;

              // Animate camera to follow player into the water
              gsap.to(fallAnimation, {
                progress: 1,
                duration: 1.5,
                ease: "power2.inOut",
                onUpdate: () => {
                  if (this.camera) {
                    // Move camera down to watch the splash
                    this.camera.position.y = startPos.y - fallAnimation.progress * 5;
                    // Also get closer to the splash point
                    this.camera.position.x = THREE.MathUtils.lerp(startPos.x, player.x, fallAnimation.progress * 0.5);
                    this.camera.position.z = THREE.MathUtils.lerp(startPos.z, player.z, fallAnimation.progress * 0.5);
                  }
                },
                onComplete: () => {
                  // Return camera to original position
                  gsap.to(this.camera.position, {
                    x: startPos.x,
                    y: startPos.y,
                    z: startPos.z,
                    duration: 2,
                    ease: "power2.inOut"
                  });
                }
              });
            }
          }
        } else if (!player.active && player.y > -8) {
          // Create splash for other players too
          if (!player.splashCreated && player.y < -4) {
            this.createSplashEffect(player.x, -5, player.z, player.color);
            player.splashCreated = true;
          }
        }
      }
    });

    // Follow current player with camera if playing
    if (this.gameState === GAME_STATES.PLAYING && this.players[this.playerId]) {
      const player = this.players[this.playerId];
      if (player.active) {
        this.controls.target.set(player.x, player.y, player.z);
      }
    }

    // Update controls
    this.controls.update();

    // Render scene
    this.renderer.render(this.scene, this.camera);

    // Animate powerups
    Object.values(this.powerups).forEach(powerup => {
      if (powerup.mesh) {
        // Add rotation animation if not already added
        if (!powerup.mesh.userData.rotating) {
          powerup.mesh.userData.rotating = true;
          gsap.to(powerup.mesh.rotation, {
            y: Math.PI * 2,
            duration: 3,
            repeat: -1,
            ease: "none"
          });
        }
      }
    });
  }

  createSplashEffect(x, y, z, color) {
    // Create splash particles
    const group = new THREE.Group();
    this.scene.add(group);

    // Play splash sound
    const splashSound = new Audio('/sounds/splash.mp3');
    splashSound.volume = 0.8;
    try {
      splashSound.play().catch(e => console.log('Sound play prevented by browser policy'));
    } catch (e) {
      console.log('Error playing sound:', e);
    }

    // Create particles
    for (let i = 0; i < 30; i++) { // Increased number of particles
      const geometry = new THREE.SphereGeometry(0.2, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: i < 10 ? color : 0x00aaff, // Mix player color and water color
        transparent: true,
        opacity: 0.8
      });

      const particle = new THREE.Mesh(geometry, material);

      // Random position within splash radius
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 3; // Larger splash radius
      particle.position.set(
        x + Math.cos(angle) * radius,
        y,
        z + Math.sin(angle) * radius
      );

      // Random velocity
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.8, // Increased horizontal spread
        Math.random() * 0.8 + 0.5,   // Increased upward velocity
        (Math.random() - 0.5) * 0.8
      );

      // Add to group
      group.add(particle);
    }

    // Add ripple effect on water
    this.createWaterRipple(x, z);

    // Animate splash
    let time = 0;
    const animate = () => {
      time += 0.05;

      group.children.forEach(particle => {
        // Update position with velocity
        particle.position.add(particle.userData.velocity);

        // Apply gravity
        particle.userData.velocity.y -= 0.03;

        // Fade out
        particle.material.opacity -= 0.01;
      });

      // Remove when done
      if (time > 2) {
        this.scene.remove(group);
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  createWaterRipple(x, z) {
    // Create ripple effect
    const rippleGeometry = new THREE.RingGeometry(0.5, 0.7, 32);
    const rippleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
    ripple.position.set(x, -4.9, z);
    ripple.rotation.x = Math.PI / 2;
    this.scene.add(ripple);

    // Animate ripple
    const animate = () => {
      // Expand and fade
      ripple.scale.x += 0.1;
      ripple.scale.y += 0.1;
      ripple.scale.z += 0.1;
      rippleMaterial.opacity -= 0.01;

      // Remove when done
      if (rippleMaterial.opacity <= 0) {
        this.scene.remove(ripple);
        rippleGeometry.dispose();
        rippleMaterial.dispose();
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  createAtmosphere() {
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.5,
      map: this.createParticleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    // Create particle system
    const particleCount = 500;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Position particles in a sphere around the platform
      const radius = 30 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI / 2;

      positions[i3] = radius * Math.cos(theta) * Math.cos(phi);
      positions[i3 + 1] = radius * Math.sin(phi) + 10;
      positions[i3 + 2] = radius * Math.sin(theta) * Math.cos(phi);
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleSystem = new THREE.Points(particles, particleMaterial);
    this.scene.add(this.particleSystem);

    // Animation data for particles
    this.particleSystem.userData = {
      rotationSpeed: 0.0005,
      positions: positions
    };
  }

  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;

    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  isSoloPlay() {
    // Check if there's only one player or if only the current player is active
    const players = Object.values(this.players);

    // If only one player exists, it's solo play
    if (players.length === 1) {
      return true;
    }

    // If there are multiple players but only the current player is active, it's effectively solo play
    if (players.length > 1 && this.playerId) {
      const activePlayers = players.filter(p => p.active);
      return activePlayers.length === 1 && activePlayers[0].id === this.playerId;
    }

    return false;
  }

  updateSoloPlayUI() {
    const soloTips = document.getElementById('solo-tips');
    const playerList = document.getElementById('player-list');

    if (!soloTips || !playerList) return;

    if (this.isSoloPlay() && this.gameState === GAME_STATES.PLAYING) {
      soloTips.style.display = 'block';
      playerList.innerHTML = '<div>Solo Practice Mode</div>';

      // Update the tips based on platform size
      const tip = document.getElementById('tip');
      if (tip) {
        if (this.platformSize < 8) {
          tip.textContent = 'The platform is getting small! Stay balanced!';
        } else if (this.platformSize < 12) {
          tip.textContent = 'Use gentle movements to stay centered.';
        } else {
          tip.textContent = 'Build momentum with quick direction changes.';
        }
      }
    } else {
      soloTips.style.display = 'none';
    }
  }

  startSoloTimer() {
    // Clear any existing timer
    if (this.soloTimerInterval) clearInterval(this.soloTimerInterval);

    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    // Start a new timer
    this.soloTimerInterval = setInterval(() => {
      this.soloTimer++;
      if (timerElement) {
        timerElement.textContent = this.formatTime(this.soloTimer);
      }
    }, 1000);
  }

  stopSoloTimer() {
    if (this.soloTimerInterval) {
      clearInterval(this.soloTimerInterval);
      this.soloTimerInterval = null;
    }
  }

  resetSoloTimer() {
    this.soloTimer = 0;
    const timerElement = document.getElementById('timer');
    if (timerElement) {
      timerElement.textContent = '0';
    }
  }

  formatTime(seconds) {
    // Format time as MM:SS
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  showCountdown() {
    // Create or get countdown element
    let countdown = document.getElementById('countdown');
    if (!countdown) {
      countdown = document.createElement('div');
      countdown.id = 'countdown';
      countdown.style.position = 'absolute';
      countdown.style.top = '50%';
      countdown.style.left = '50%';
      countdown.style.transform = 'translate(-50%, -50%)';
      countdown.style.fontSize = '6rem';
      countdown.style.fontWeight = 'bold';
      countdown.style.color = '#fff';
      countdown.style.textShadow = '0 0 10px #000';
      countdown.style.zIndex = '20';
      document.body.appendChild(countdown);
    }

    // Create background overlay for countdown
    let overlay = document.getElementById('countdown-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'countdown-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      overlay.style.zIndex = '19';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';

    // Start countdown animation
    let count = 3;
    countdown.textContent = count;
    countdown.style.display = 'block';
    countdown.style.color = '#FF5722'; // Orange

    // Play countdown sound
    const countdownSound = new Audio('/sounds/countdown.mp3');
    countdownSound.volume = 0.5;
    try {
      countdownSound.play().catch(e => console.log('Sound play prevented by browser policy'));
    } catch (e) {
      console.log('Error playing sound:', e);
    }

    const countdownInterval = setInterval(() => {
      count--;
      if (count > 0) {
        countdown.textContent = count;
        // Add scale animation
        countdown.style.transition = 'transform 0.5s ease-out, color 0.5s ease-out';
        countdown.style.transform = 'translate(-50%, -50%) scale(1.5)';
        countdown.style.color = count === 2 ? '#FFC107' : '#4CAF50'; // Yellow then Green

        // Try to play sound
        try {
          countdownSound.currentTime = 0;
          countdownSound.play().catch(e => console.log('Sound play prevented by browser policy'));
        } catch (e) {
          console.log('Error playing sound:', e);
        }

        setTimeout(() => {
          countdown.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 500);
      } else {
        countdown.textContent = 'GO!';
        countdown.style.color = '#4CAF50';
        countdown.style.transform = 'translate(-50%, -50%) scale(2)';

        // Try to play go sound (higher pitch)
        const goSound = new Audio('/sounds/go.mp3');
        goSound.volume = 0.7;
        try {
          goSound.play().catch(e => console.log('Sound play prevented by browser policy'));
        } catch (e) {
          console.log('Error playing sound:', e);
        }

        // Hide countdown after a second
        setTimeout(() => {
          countdown.style.display = 'none';
          overlay.style.display = 'none';
        }, 1000);

        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  showFallenMessage() {
    // Create or get fallen message element
    let fallenMsg = document.getElementById('fallen-message');
    if (!fallenMsg) {
      fallenMsg = document.createElement('div');
      fallenMsg.id = 'fallen-message';
      fallenMsg.style.position = 'absolute';
      fallenMsg.style.top = '50%';
      fallenMsg.style.left = '50%';
      fallenMsg.style.transform = 'translate(-50%, -50%)';
      fallenMsg.style.fontSize = '3rem';
      fallenMsg.style.fontWeight = 'bold';
      fallenMsg.style.color = '#ff3333';
      fallenMsg.style.textShadow = '0 0 10px #000';
      fallenMsg.style.zIndex = '20';
      fallenMsg.style.textAlign = 'center';
      document.body.appendChild(fallenMsg);
    }

    // Add animation effects for the message
    fallenMsg.innerHTML = 'You Fell Off!<br><span style="font-size: 1.5rem">Waiting for game to end...</span>';
    fallenMsg.style.display = 'block';
    fallenMsg.style.opacity = '0';
    fallenMsg.style.transform = 'translate(-50%, -70%)';
    fallenMsg.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';

    // Trigger animation
    setTimeout(() => {
      fallenMsg.style.opacity = '1';
      fallenMsg.style.transform = 'translate(-50%, -50%)';
    }, 10);

    // Add auto-restart option for solo play
    if (this.isSoloPlay()) {
      fallenMsg.innerHTML = 'You Fell Off!<br><span style="font-size: 1.5rem">Your time: ' + this.formatTime(this.soloTimer) + '</span>';

      const restartButton = document.createElement('button');
      restartButton.textContent = 'Play Again';
      restartButton.style.marginTop = '20px';
      restartButton.style.fontSize = '1.5rem';
      restartButton.style.padding = '10px 20px';
      restartButton.style.backgroundColor = '#4CAF50';
      restartButton.style.border = 'none';
      restartButton.style.borderRadius = '5px';
      restartButton.style.color = 'white';
      restartButton.style.cursor = 'pointer';

      // Add button hover effect
      restartButton.style.transition = 'background-color 0.3s, transform 0.2s';
      restartButton.onmouseover = () => {
        restartButton.style.backgroundColor = '#45a049';
        restartButton.style.transform = 'scale(1.05)';
      };
      restartButton.onmouseout = () => {
        restartButton.style.backgroundColor = '#4CAF50';
        restartButton.style.transform = 'scale(1)';
      };

      restartButton.onclick = () => {
        this.restartGame();
      };

      fallenMsg.appendChild(restartButton);

      // Auto-restart countdown in solo mode
      let count = 5;
      const countdownEl = document.createElement('div');
      countdownEl.style.fontSize = '1.5rem';
      countdownEl.style.marginTop = '15px';
      countdownEl.style.color = '#FFC107';
      countdownEl.textContent = `Auto-restart in ${count}...`;
      fallenMsg.appendChild(countdownEl);

      const autoRestartInterval = setInterval(() => {
        count--;
        if (count > 0) {
          countdownEl.textContent = `Auto-restart in ${count}...`;
          if (count <= 2) {
            countdownEl.style.color = '#FF5722';
          }
        } else {
          clearInterval(autoRestartInterval);
          this.restartGame();
        }
      }, 1000);
    } else {
      // For multiplayer, show different message
      fallenMsg.innerHTML = 'You Fell Off!<br><span style="font-size: 1.5rem">Waiting for other players...</span>';
    }

    // Hide message when game state changes
    const gameStateListener = (data) => {
      if (data.state === GAME_STATES.WAITING || data.state === GAME_STATES.COUNTDOWN) {
        // Animate the message out
        fallenMsg.style.opacity = '0';
        fallenMsg.style.transform = 'translate(-50%, -30%)';

        // Hide after transition completes
        setTimeout(() => {
          fallenMsg.style.display = 'none';
        }, 500);

        this.socket.off(MSG_TYPES.GAME_STATE, gameStateListener);
      }
    };

    this.socket.on(MSG_TYPES.GAME_STATE, gameStateListener);
  }

  restartGame() {
    // Hide any UI elements
    const fallenMsg = document.getElementById('fallen-message');
    if (fallenMsg) {
      fallenMsg.style.display = 'none';
    }

    const gameOverUI = document.getElementById('game-over');
    gameOverUI.style.display = 'none';

    // Reset player splash status
    Object.values(this.players).forEach(player => {
      if (player) {
        player.splashCreated = false;
      }
    });

    // Send restart message to server
    this.socket.emit(MSG_TYPES.RESTART_GAME);

    // Show a quick "Restarting..." message
    const gameStatusElement = document.getElementById('game-status');
    gameStatusElement.textContent = 'Restarting...';
    gameStatusElement.style.opacity = '0.8';
    setTimeout(() => {
      gameStatusElement.style.opacity = '0';
    }, 1500);
  }

  createControlPanel() {
    // Create control panel container
    const controlPanel = document.createElement('div');
    controlPanel.className = 'control-panel';
    controlPanel.style.position = 'fixed';
    controlPanel.style.top = '20px';
    controlPanel.style.right = '20px';
    controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    controlPanel.style.color = 'white';
    controlPanel.style.padding = '15px';
    controlPanel.style.borderRadius = '5px';
    controlPanel.style.zIndex = '1000';
    controlPanel.style.minWidth = '250px';
    controlPanel.style.display = 'none';
    controlPanel.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';

    // Add title
    const title = document.createElement('h3');
    title.textContent = 'Physics Control Panel';
    title.style.margin = '0 0 15px 0';
    title.style.textAlign = 'center';
    controlPanel.appendChild(title);

    // Add sliders for each physics parameter
    const parameters = [
      { id: 'movementForce', label: 'Movement Force', min: 5, max: 50, step: 1 },
      { id: 'baseFriction', label: 'Base Friction', min: 0.7, max: 0.99, step: 0.01 },
      { id: 'edgeFriction', label: 'Edge Friction', min: 0, max: 0.3, step: 0.01 },
      { id: 'centerPull', label: 'Center Pull', min: 0, max: 0.5, step: 0.01 },
      { id: 'restitution', label: 'Bounce Factor', min: 0.5, max: 3, step: 0.1 },
      { id: 'randomFactor', label: 'Randomness', min: 0, max: 0.5, step: 0.01 }
    ];

    parameters.forEach(param => {
      const container = document.createElement('div');
      container.style.marginBottom = '10px';

      const label = document.createElement('label');
      label.htmlFor = param.id;
      label.textContent = param.label;
      label.style.display = 'block';
      label.style.marginBottom = '5px';
      container.appendChild(label);

      const sliderContainer = document.createElement('div');
      sliderContainer.style.display = 'flex';
      sliderContainer.style.alignItems = 'center';
      sliderContainer.style.gap = '10px';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = param.id;
      slider.min = param.min;
      slider.max = param.max;
      slider.step = param.step;
      slider.value = this.physicsParams[param.id];
      slider.style.flex = '1';
      slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        valueDisplay.textContent = value.toFixed(2);
        this.updatePhysicsParameter(param.id, value);
      });

      const valueDisplay = document.createElement('span');
      valueDisplay.textContent = this.physicsParams[param.id].toFixed(2);
      valueDisplay.style.minWidth = '40px';
      valueDisplay.style.textAlign = 'right';

      sliderContainer.appendChild(slider);
      sliderContainer.appendChild(valueDisplay);
      container.appendChild(sliderContainer);

      controlPanel.appendChild(container);
    });

    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset to Defaults';
    resetButton.style.width = '100%';
    resetButton.style.padding = '8px';
    resetButton.style.marginTop = '10px';
    resetButton.style.backgroundColor = '#444';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.borderRadius = '3px';
    resetButton.style.cursor = 'pointer';
    resetButton.addEventListener('click', this.resetPhysicsParameters);
    controlPanel.appendChild(resetButton);

    // Add toggle button to show/hide the control panel
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Physics Controls';
    toggleButton.style.position = 'fixed';
    toggleButton.style.top = '20px';
    toggleButton.style.right = '20px';
    toggleButton.style.padding = '8px 12px';
    toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    toggleButton.style.color = 'white';
    toggleButton.style.border = 'none';
    toggleButton.style.borderRadius = '3px';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.zIndex = '1000';
    toggleButton.addEventListener('click', this.toggleControlPanel);

    document.body.appendChild(controlPanel);
    document.body.appendChild(toggleButton);

    this.controlPanel = controlPanel;
  }

  toggleControlPanel() {
    this.controlPanelVisible = !this.controlPanelVisible;
    this.controlPanel.style.display = this.controlPanelVisible ? 'block' : 'none';
  }

  updatePhysicsParameter(paramId, value) {
    this.physicsParams[paramId] = value;
    // Send updated parameter to server
    this.socket.emit(MSG_TYPES.UPDATE_PHYSICS, { [paramId]: value });
  }

  resetPhysicsParameters() {
    this.physicsParams = { ...PHYSICS_DEFAULTS };
    this.updateControlPanelValues();
    // Send reset parameters to server
    this.socket.emit(MSG_TYPES.UPDATE_PHYSICS, this.physicsParams);
  }

  updateControlPanelValues() {
    // Update the slider values to match current physics parameters
    Object.entries(this.physicsParams).forEach(([key, value]) => {
      const slider = document.getElementById(key);
      const valueDisplay = slider?.nextElementSibling;
      if (slider) {
        slider.value = value;
        if (valueDisplay) {
          valueDisplay.textContent = value.toFixed(2);
        }
      }
    });
  }

  // Create a powerup in the scene
  createPowerup(powerup) {
    // Create base geometry for all powerups
    const geometry = new THREE.SphereGeometry(powerup.radius, 16, 16);

    // Different material based on powerup type
    let material;
    let emissiveColor;

    switch (powerup.type) {
      case POWERUP_TYPES.SPEED:
        emissiveColor = new THREE.Color(0x00ff00); // Green
        material = new THREE.MeshStandardMaterial({
          color: 0x00ff00,
          emissive: emissiveColor,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        });
        break;

      case POWERUP_TYPES.MASS:
        emissiveColor = new THREE.Color(0xff0000); // Red
        material = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          emissive: emissiveColor,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        });
        break;

      case POWERUP_TYPES.BOUNCE:
        emissiveColor = new THREE.Color(0x0000ff); // Blue
        material = new THREE.MeshStandardMaterial({
          color: 0x0000ff,
          emissive: emissiveColor,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        });
        break;

      case POWERUP_TYPES.FREEZE:
        emissiveColor = new THREE.Color(0x00ffff); // Cyan
        material = new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: emissiveColor,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        });
        break;

      case POWERUP_TYPES.PUSH:
        emissiveColor = new THREE.Color(0xff9900); // Orange
        material = new THREE.MeshStandardMaterial({
          color: 0xff9900,
          emissive: emissiveColor,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2
        });
        break;

      default:
        material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: 0.3,
          metalness: 0.8,
          roughness: 0.2
        });
    }

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(powerup.x, powerup.y, powerup.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(powerup.radius * 1.3, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: emissiveColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    mesh.add(glowMesh);

    // Add icon or symbol based on powerup type
    let iconMesh;

    switch (powerup.type) {
      case POWERUP_TYPES.SPEED:
        // Add lightning bolt or arrow
        const arrowGeo = new THREE.ConeGeometry(0.2, 0.4, 8);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        iconMesh = new THREE.Mesh(arrowGeo, arrowMat);
        iconMesh.rotation.x = Math.PI;
        iconMesh.position.y = 0.2;
        break;

      case POWERUP_TYPES.MASS:
        // Add weight symbol
        const weightGeo = new THREE.TorusGeometry(0.15, 0.05, 8, 16);
        const weightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        iconMesh = new THREE.Mesh(weightGeo, weightMat);
        break;

      case POWERUP_TYPES.BOUNCE:
        // Add spring symbol
        const springGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
        const springMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        iconMesh = new THREE.Mesh(springGeo, springMat);
        break;

      case POWERUP_TYPES.FREEZE:
        // Add snowflake symbol
        const ringGeo = new THREE.RingGeometry(0.1, 0.2, 6);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        iconMesh = new THREE.Mesh(ringGeo, ringMat);
        break;

      case POWERUP_TYPES.PUSH:
        // Add explosion symbol
        const sphereGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        iconMesh = new THREE.Mesh(sphereGeo, sphereMat);
        break;
    }

    if (iconMesh) {
      mesh.add(iconMesh);
    }

    // Add floating animation
    const startY = powerup.y;
    gsap.to(mesh.position, {
      y: startY + 0.3,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    // Add rotation animation
    gsap.to(mesh.rotation, {
      y: Math.PI * 2,
      duration: 3,
      repeat: -1,
      ease: "none"
    });

    // Store reference to the powerup
    this.powerups[powerup.id] = {
      mesh,
      data: powerup
    };

    // Add to scene
    this.scene.add(mesh);
  }

  // Handle powerup collection
  collectPowerup(powerupId, playerId, powerupType) {
    if (this.powerups[powerupId]) {
      // Get the powerup mesh
      const powerupMesh = this.powerups[powerupId].mesh;

      // Create particle effect at powerup position
      this.createPowerupCollectEffect(
        powerupMesh.position.x,
        powerupMesh.position.y,
        powerupMesh.position.z,
        powerupType
      );

      // Remove from scene
      this.scene.remove(powerupMesh);

      // Remove from powerups object
      delete this.powerups[powerupId];

      // Play sound
      this.playSound('powerup', 0.5);

      // Show message if it's the current player
      if (playerId === this.playerId) {
        this.showPowerupMessage(powerupType);
      }
    }
  }

  // Create particle effect when powerup is collected
  createPowerupCollectEffect(x, y, z, type) {
    // Get color based on powerup type
    let color;
    switch (type) {
      case POWERUP_TYPES.SPEED: color = 0x00ff00; break;
      case POWERUP_TYPES.MASS: color = 0xff0000; break;
      case POWERUP_TYPES.BOUNCE: color = 0x0000ff; break;
      case POWERUP_TYPES.FREEZE: color = 0x00ffff; break;
      case POWERUP_TYPES.PUSH: color = 0xff9900; break;
      default: color = 0xffffff;
    }

    // Create particle group
    const group = new THREE.Group();
    group.position.set(x, y, z);
    this.scene.add(group);

    // Create particles
    for (let i = 0; i < 15; i++) {
      const size = Math.random() * 0.2 + 0.1;
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1
      });

      const particle = new THREE.Mesh(geometry, material);

      // Random position offset
      particle.position.set(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      );

      // Random velocity
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        Math.random() * 0.1 + 0.05,
        (Math.random() - 0.5) * 0.1
      );

      group.add(particle);
    }

    // Animate particles
    let time = 0;
    const animate = () => {
      time += 0.05;

      group.children.forEach(particle => {
        // Update position with velocity
        particle.position.add(particle.userData.velocity);

        // Apply gravity
        particle.userData.velocity.y -= 0.003;

        // Fade out
        particle.material.opacity -= 0.02;
      });

      // Remove when done
      if (time > 2) {
        this.scene.remove(group);
        return;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }

  // Show powerup message to player
  showPowerupMessage(type) {
    // Create message element if it doesn't exist
    if (!this.powerupMessage) {
      const message = document.createElement('div');
      message.className = 'powerup-message';
      message.style.position = 'fixed';
      message.style.bottom = '100px';
      message.style.left = '50%';
      message.style.transform = 'translateX(-50%)';
      message.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      message.style.color = 'white';
      message.style.padding = '10px 20px';
      message.style.borderRadius = '5px';
      message.style.fontWeight = 'bold';
      message.style.fontSize = '18px';
      message.style.zIndex = '1000';
      message.style.transition = 'opacity 0.3s';
      message.style.opacity = '0';
      document.body.appendChild(message);
      this.powerupMessage = message;
    }

    // Set message text based on powerup type
    let messageText = '';
    switch (type) {
      case POWERUP_TYPES.SPEED:
        messageText = '🔥 Speed Boost!';
        this.powerupMessage.style.color = '#00ff00';
        break;
      case POWERUP_TYPES.MASS:
        messageText = '💪 Heavy Mass!';
        this.powerupMessage.style.color = '#ff0000';
        break;
      case POWERUP_TYPES.BOUNCE:
        messageText = '⚡ Super Bounce!';
        this.powerupMessage.style.color = '#0088ff';
        break;
      case POWERUP_TYPES.FREEZE:
        messageText = '❄️ Freeze!';
        this.powerupMessage.style.color = '#00ffff';
        break;
      case POWERUP_TYPES.PUSH:
        messageText = '💥 Push!';
        this.powerupMessage.style.color = '#ff9900';
        break;
    }

    this.powerupMessage.textContent = messageText;
    this.powerupMessage.style.opacity = '1';

    // Clear previous timeout
    if (this.powerupMessageTimeout) {
      clearTimeout(this.powerupMessageTimeout);
    }

    // Hide message after a delay
    this.powerupMessageTimeout = setTimeout(() => {
      this.powerupMessage.style.opacity = '0';
    }, 3000);
  }

  // Apply visual effects to a player with an active powerup
  applyPowerupVisualEffect(playerId, powerupType, endsAt) {
    const player = this.players[playerId];
    if (!player || !player.mesh) return;

    // Clear existing effects
    if (player.powerupEffect) {
      player.mesh.remove(player.powerupEffect);
      player.powerupEffect = null;
    }

    // Create effect based on powerup type
    const effectGroup = new THREE.Group();

    switch (powerupType) {
      case POWERUP_TYPES.SPEED:
        // Add speed trail
        const trailGeo = new THREE.RingGeometry(1.2, 1.5, 16);
        const trailMat = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.rotation.x = Math.PI / 2;
        effectGroup.add(trail);

        // Animate the trail
        gsap.to(trail.scale, {
          x: 1.5,
          y: 1.5,
          z: 1,
          duration: 0.5,
          repeat: -1,
          yoyo: true
        });
        break;

      case POWERUP_TYPES.MASS:
        // Add heavy mass effect
        const massGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const massMat = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          transparent: true,
          opacity: 0.3,
          wireframe: true
        });
        const massEffect = new THREE.Mesh(massGeo, massMat);
        effectGroup.add(massEffect);
        break;

      case POWERUP_TYPES.BOUNCE:
        // Add bounce effect
        const bounceGeo = new THREE.SphereGeometry(1.1, 16, 16);
        const bounceMat = new THREE.MeshBasicMaterial({
          color: 0x0000ff,
          transparent: true,
          opacity: 0.4
        });
        const bounceEffect = new THREE.Mesh(bounceGeo, bounceMat);
        effectGroup.add(bounceEffect);

        // Animate bounce effect
        gsap.to(bounceEffect.scale, {
          x: 1.3,
          y: 1.3,
          z: 1.3,
          duration: 0.3,
          repeat: -1,
          yoyo: true
        });
        break;

      case POWERUP_TYPES.FREEZE:
        // Only show effects on frozen players
        if (player.frozen) {
          const freezeGeo = new THREE.IcosahedronGeometry(1.2, 0);
          const freezeMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5,
            wireframe: true
          });
          const freezeEffect = new THREE.Mesh(freezeGeo, freezeMat);
          effectGroup.add(freezeEffect);
        }
        break;
    }

    // Add effect to player mesh
    if (effectGroup.children.length > 0) {
      player.mesh.add(effectGroup);
      player.powerupEffect = effectGroup;

      // Set timeout to remove effect when powerup ends
      if (endsAt) {
        const duration = endsAt - Date.now();
        if (duration > 0) {
          setTimeout(() => {
            if (player.powerupEffect) {
              player.mesh.remove(player.powerupEffect);
              player.powerupEffect = null;
            }
          }, duration);
        }
      }
    }
  }
}
