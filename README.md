# Sumo Ball Game

A multiplayer physics-based game where players control balls on a shrinking platform, trying to push each other off while collecting power-ups.

## Live Demo

Play the game at [https://sumo-ball-game.fly.dev/](https://sumo-ball-game.fly.dev/)

## Features

- Real-time multiplayer gameplay using Socket.IO
- 3D graphics with Three.js
- Physics-based movement and collisions
- Shrinking platform for increased challenge
- Power-ups that affect gameplay
- Mobile-friendly controls with on-screen joystick
- Solo play option when no other players are online

## Running Locally

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/vibejam-sumoball.git
   cd vibejam-sumoball
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:4111
   ```

## Project Structure

- `/src` - Client-side code
  - `/client` - Game client logic using Three.js
  - `/shared` - Shared constants and utilities
- `/server` - Node.js server using Express and Socket.IO
- `/public` - Static assets and bundled client code

## Deployment

This project is deployed on Fly.io. See the [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions and configuration details.

## License

MIT

## Game Description

In Sumo Ball Battle, players control balls on a circular platform. The objective is to knock other players off the platform into the water below. The last player standing wins!

The platform gradually shrinks over time, increasing the challenge and forcing players to confront each other.

## Controls

- **WASD** or **Arrow Keys** to move your ball
- The camera follows your ball automatically
- Use momentum and timing to knock opponents off the platform
- Touch controls on mobile devices

## How to Play

### Multiplayer Mode
1. Enter your name when prompted
2. Use WASD or Arrow Keys to move
3. Try to stay on the platform while knocking others off
4. The last player standing wins!

### Solo Practice Mode
1. Play alone to practice your skills
2. Follow the blue arrows for movement guidance
3. See how long you can stay balanced on the platform
4. Beat your own time records!

## Technical Stack

- Three.js for 3D rendering
- Socket.io for real-time multiplayer
- Express for the server
- Node.js backend

## Gameplay Tips

1. Build momentum by moving in one direction and then quickly changing
2. More momentum means more impact force when colliding with other players
3. The platform has less friction near the edges - be careful!
4. Use the environment to your advantage - stay at the center when possible
5. In solo mode, try different movement patterns to improve balance control 
