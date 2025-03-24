# Sumo Ball Battle

A 3D multiplayer sumo ball game where players push each other off a shrinking platform.

## Features

- Real-time multiplayer gameplay
- Camera-relative controls
- Physics-based interactions
- Power-ups with special abilities
- Platform that shrinks over time
- Solo play practice mode
- Mobile touch controls

## Development

```bash
# Install dependencies
npm install

# Run development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

For development, run both `npm run dev` and `npm start` in separate terminals.
- Access the development server at http://localhost:9001
- The backend server runs on http://localhost:4111

## Deployment Options

### Render.com (Recommended)

1. Create a new account on [Render.com](https://render.com)
2. Connect your GitHub repository
3. Click "New Web Service"
4. Select your repository
5. Use the following settings:
   - Name: sumo-ball-game
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: Free

### Railway.app

1. Create a new account on [Railway.app](https://railway.app)
2. Create a new project and connect your GitHub repository
3. Add a new service with Node.js template
4. Configure environment variables if needed
5. Deploy

### Fly.io

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/)
2. Login with `fly auth login`
3. Launch your app with `fly launch`
4. Deploy with `fly deploy`

## Environment Variables

- `PORT`: The port to run the server on (defaults to 4111)

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
