# Sumo Ball Battle - Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Vision
Sumo Ball Battle is a 3D multiplayer web game inspired by the "Sumo" mini-game from Fusion Frenzy. Players control balls on a circular platform and attempt to knock opponents off while staying on the platform themselves. The last player standing wins.

### 1.2 Target Audience
- Casual gamers looking for quick, fun sessions
- Fans of party/mini-games
- Players of all skill levels (easy to learn, difficult to master)
- Age range: 8+ years

### 1.3 Key Value Proposition
- Simple controls accessible to anyone
- Engaging multiplayer experience
- Quick game sessions (2-5 minutes)
- Works directly in web browsers with no downloads required
- Supports both desktop and mobile play

## 2. Game Mechanics

### 2.1 Core Gameplay
- Players control balls on a circular platform
- Movement uses momentum and physics for realistic collisions
- Goal: Knock other players off the platform while staying on
- The platform shrinks over time, increasing difficulty
- Last player remaining wins

### 2.2 Controls
- **Desktop**: WASD or Arrow keys for movement (relative to camera orientation)
- **Mobile**: Touch joystick for movement
- Camera follows player automatically with manual camera rotation available

### 2.3 Game Modes
- **Multiplayer Mode**: Up to 8 players compete in real-time
- **Solo Practice Mode**: Single player with time tracking

### 2.4 Game States
- **Waiting**: Lobby waiting for players to join
- **Countdown**: 3-second countdown before game starts
- **Playing**: Active gameplay
- **Game Over**: Results display and winner announcement

## 3. Feature Specifications

### 3.1 Visual & Game Environment
- **Platform**: 3D circular platform with customizable textures
- **Water**: Animated water surface below the platform
- **Players**: Colored balls with player names displayed above
- **Visual Effects**:
  - Motion trails behind fast-moving balls
  - Splash effects when players fall
  - Particle atmosphere for ambiance
  - Force ring effects during collisions
  - Platform edge glow that intensifies as game progresses

### 3.2 Physics & Movement
- Realistic momentum and collision physics
- Variable friction (less friction near platform edges)
- Slight gravity pull toward center when idle
- Collision impulse that increases with speed

### 3.3 UI Elements
- Player list showing active/inactive status
- Game state indicators
- Solo mode timer and best time tracking
- Mobile-friendly UI adaptation
- Countdown and status overlays

### 3.4 Multiplayer Features
- Real-time synchronization of player positions
- Support for up to 8 concurrent players
- Player joining/leaving handling
- Game restart functionality

### 3.5 Solo Mode Features
- Directional guidance arrows for beginners
- Timer tracking how long player stays on platform
- Best time records saved in local storage
- Adaptive tips based on platform size

## 4. Technical Requirements

### 4.1 Technology Stack
- **Frontend**: Three.js for 3D rendering
- **Backend**: Node.js with Express
- **Networking**: Socket.io for real-time communication
- **Animation**: GSAP for smooth animations
- **Physics**: Custom simplified physics implementation

### 4.2 Performance Targets
- **Framerate**: Minimum 30 FPS, target 60 FPS
- **Latency**: <100ms for responsive multiplayer experience
- **Device Support**: Desktop browsers, modern mobile browsers
- **Minimum Requirements**: WebGL-capable device

### 4.3 Responsive Design
- Automatically detect and adapt to mobile devices
- Switch to touch controls on mobile
- Adjust visual quality based on device capability

## 5. Development Roadmap

### 5.1 Core Features (Current Implementation)
- ✅ Basic player movement and physics
- ✅ Multiplayer functionality
- ✅ Shrinking platform mechanic
- ✅ Visual effects (trails, splashes)
- ✅ Camera-relative controls
- ✅ Solo practice mode

### 5.2 Short-term Improvements
- 🔲 Power-ups (speed boost, heavyweight, bounce bonus)
- 🔲 Sound effects and background music
- 🔲 Customizable player appearances
- 🔲 Game options (platform size, shrink rate, etc.)
- 🔲 Improved mobile optimizations

### 5.3 Long-term Features
- 🔲 Tournament mode with brackets
- 🔲 Player accounts and stats tracking
- 🔲 Multiple arena types with different obstacles
- 🔲 Team mode (2v2, 4v4)
- 🔲 Spectator mode

## 6. Development Guidelines

### 6.1 Code Structure
- **Client** (`src/client/`): Three.js game implementation
- **Server** (`server/`): Express server and game logic
- **Shared** (`src/shared/`): Constants and utilities shared between client/server

### 6.2 Coding Conventions
- ES6 JavaScript syntax
- Descriptive variable and function names
- Method documentation with JSDoc comments
- Modular code organization with clear separation of concerns

### 6.3 Performance Optimization
- Minimize DOM operations
- Use object pooling for frequently created objects
- Optimize physics calculations for large player counts
- Implement level-of-detail rendering for lower-end devices

### 6.4 Testing
- Test multiplayer functionality with multiple clients
- Ensure compatibility across Chrome, Firefox, Safari, Edge
- Verify mobile experience on iOS and Android devices
- Validate performance on lower-end hardware

## 7. Implementation Notes

### 7.1 Key Classes
- **Game**: Main game controller handling setup and initialization
- **Player**: Player data and mesh handling
- **Physics**: Simplified physics implementation
- **UI**: User interface elements and state display
- **Network**: Socket.io communication

### 7.2 Critical Algorithms
- **Collision Detection**: Sphere-to-sphere collision between players
- **Input Translation**: Converting keyboard/touch input to movement forces
- **Camera Following**: Smooth camera tracking of player position
- **Platform Shrinking**: Gradual reduction of platform size

## 8. Known Issues & Challenges

### 8.1 Current Issues
- Network latency can cause jerky movement in high-ping scenarios
- Mobile performance needs optimization on lower-end devices
- Camera controls sometimes feel restrictive

### 8.2 Technical Debt
- Physics implementation could be replaced with a dedicated physics engine
- Some UI elements need null checks to prevent errors
- Refactor needed for better separation between game state and rendering

### 8.3 Potential Challenges
- Scaling to large player counts (>20) may require architectural changes
- Supporting WebXR for VR/AR experiences
- Implementing more complex game modes while maintaining simplicity

## 9. Appendix

### 9.1 Glossary
- **Platform**: The circular arena where gameplay occurs
- **Shrinking**: The mechanism where the platform gradually becomes smaller
- **Impulse**: The force applied during collisions between players
- **Solo Mode**: Single-player practice mode
- **Camera-relative Controls**: Movement based on camera orientation rather than world coordinates

### 9.2 References
- Three.js Documentation: https://threejs.org/docs/
- Socket.io Documentation: https://socket.io/docs/v4/
- GSAP Documentation: https://greensock.com/docs/ 
