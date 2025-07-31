# Scribble Game - Multiplayer Drawing & Voting Platform

A real-time multiplayer drawing game where players collaborate to create artwork on a shared canvas while viewers vote for their favorite contributions.

## Table of Contents
- [Overview](#overview)
- [App Flow Diagram](#app-flow-diagram)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [WebSocket Events](#websocket-events)
- [Game Flow](#game-flow)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

## Overview

Scribble Game is a real-time multiplayer drawing platform that enables:
- **Players**: Draw on left/right sides of a shared canvas
- **Viewers**: Watch the drawing process and vote for their favorite player
- **Real-time Collaboration**: Synchronized drawing updates across all connected clients
- **Scoring System**: Points for drawing pixels and receiving votes
- **Game Sessions**: Timed drawing sessions with automatic game management

## App Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SCRIBBLE GAME FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
    ┌─────────────┐
    │   Client    │
    │ (Browser)   │
    └──────┬──────┘
           │
           │ WebSocket Connection
           ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │  Frontend   │◄────────┤  WebSocket  │────────►│  Backend    │
    │   (React)   │         │   Server    │         │  (Node.js)  │
    └─────────────┘         └─────────────┘         └─────────────┘
           │                                               │
           │                                               │
           ▼                                               ▼
    ┌─────────────┐                                ┌─────────────┐
    │   Canvas    │                                │    Room     │
    │  Component  │                                │  Service    │
    └─────────────┘                                └─────────────┘
                                                          │
                                                          ▼
                                                   ┌─────────────┐
                                                   │   Canvas    │
                                                   │   Model     │
                                                   └─────────────┘
                                                          │
                                                          ▼
                                                   ┌─────────────┐
                                                   │    Redis    │
                                                   │  (Scores)   │
                                                   └─────────────┘

GAME FLOW:
1. User connects → Frontend establishes WebSocket connection
2. Join Room → Backend creates/joins room, assigns player/viewer role
3. Game Start → 2 players trigger auto-start, viewers can join anytime
4. Drawing Phase → Players draw on assigned sides, real-time sync
5. Voting Phase → Viewers vote for preferred player artwork
6. Game End → Scores calculated, winner announced, room reset

USER ROLES:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Player    │    │   Viewer    │    │    Room     │
│             │    │             │    │             │
│ • Draw      │    │ • Watch     │    │ • Max 2     │
│ • Left/Right│    │ • Vote      │    │   players   │
│ • Compete   │    │ • Unlimited │    │ • Unlimited │
│             │    │             │    │   viewers   │
└─────────────┘    └─────────────┘    └─────────────┘

ROOM STATES:
Waiting → Ready → Drawing → Voting → Finished → Reset
   │        │        │        │         │        │
   │        │        │        │         │        └─► Back to Waiting
   │        │        │        │         └─────────► 5 sec delay
   │        │        │        └──────────────────► Viewers vote
   │        │        └───────────────────────────► 60 sec timer
   │        └────────────────────────────────────► 2 players joined
   └─────────────────────────────────────────────► Room created
```

## Features

### Core Gameplay
- **Real-time Drawing**: Synchronized pixel-by-pixel drawing
- **Dual-side Canvas**: Players draw on left/right sides simultaneously  
- **Live Voting**: Viewers vote for their favorite player in real-time
- **Scoring System**: Points for pixels drawn and votes received
- **Timed Sessions**: 60-second drawing rounds with automatic transitions

### Technical Features
- **WebSocket Communication**: Real-time bidirectional communication
- **Room Management**: Create/join rooms with unique room codes
- **Player Roles**: Distinct player (drawer) and viewer (voter) roles
- **Canvas Persistence**: Drawing state maintained across connections
- **Score Tracking**: Redis-based persistent scoring system
- **Auto-cleanup**: Inactive room cleanup and connection management

### User Experience
- **Responsive Design**: Works on desktop and mobile devices
- **Visual Feedback**: Real-time drawing updates and game state changes
- **Error Handling**: Graceful error recovery and user notifications
- **Connection Health**: Ping/pong heartbeat for stable connections

## Architecture

### System Architecture
```
Frontend (React) ←→ WebSocket ←→ Backend (Node.js) ←→ Redis
     ↓                              ↓
Canvas Component              Room Service
Drawing Tools                Canvas Model
User Interface               Score Service
                            Prompt Service
```

### Data Flow
1. **User Action** → Frontend captures drawing/interaction
2. **WebSocket** → Sends event to backend via WebSocket
3. **Controller** → Routes message to appropriate handler
4. **Service Layer** → Processes business logic (rooms, canvas, scores)
5. **Data Layer** → Updates in-memory state and Redis
6. **Broadcast** → Sends updates to all connected clients
7. **UI Update** → Frontend renders changes in real-time

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **WebSocket**: ws library
- **Database**: Redis (for scoring and persistence)
- **Architecture**: Service-oriented with controllers

### Frontend
- **Framework**: React.js
- **Styling**: CSS3 with responsive design
- **Canvas**: HTML5 Canvas API
- **WebSocket**: Native WebSocket API
- **State Management**: React hooks (useState, useEffect)

### DevOps
- **Environment**: Node.js 16+
- **Package Manager**: npm
- **Process Manager**: PM2 (production)
- **Monitoring**: Built-in logging and statistics





### Quick Start
```bash
# Clone the repository
git clone https://github.com/yourusername/scribble-game.git
cd scribble-game

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Start Redis server (required for backend)
redis-server

# Start backend server
cd ../backend
npm start

# Start frontend development server
cd ../frontend
npm start
```

## Backend Setup

### Installation Steps
```bash
cd backend
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure environment variables
nano .env

# Start development server
npm run dev

# Or start production server
npm start
```

### Backend Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "ws": "^8.13.0",
    "redis": "^4.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
```

### Backend Scripts
```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "npm run test:unit",
    "lint": "eslint .",
    "cleanup": "node scripts/cleanup.js"
  }
}
```

## Frontend Setup

### Installation Steps
```bash
cd frontend
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure API endpoints
nano .env

# Start development server
npm start

# Build for production
npm run build
```

## WebSocket Events




### 1. Room Creation & Joining
```
User enters room code → Frontend sends 'join' event → Backend creates/joins room
→ Assigns player/viewer role → Sends room state → UI updates
```

### 2. Game Initialization
```
2 players joined → Auto-start triggered → Canvas reset → Scores reset
→ Random prompt selected → 60-second timer starts → Broadcast game start
```

### 3. Drawing Phase (60 seconds)
```
Players draw → Pixel events sent → Canvas updated → Real-time broadcast
→ Scores updated → Viewers watch → Timer countdown displayed
```

### 4. Voting Phase (Auto-triggered)
```
Drawing ends → Voting enabled → Viewers vote → Vote counts updated
→ Real-time vote display → Final scores calculated
```

### 5. Game End & Results
```
All voted OR timeout → Final scores → Winner determined → Results broadcast
→ 5-second delay → Room reset → Ready for new game
```

### 6. Room Cleanup
```
Players disconnect → Room empty check → Inactive room cleanup
→ Redis score cleanup → Memory cleanup
```

## Environment Variables

### Backend (.env)
```bash
# Server Configuration
PORT=8080
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# WebSocket Configuration
WS_PORT=8080
WS_HOST=localhost

# Game Configuration
GAME_DURATION=60000
VOTING_DURATION=30000
MAX_PLAYERS_PER_ROOM=2
MAX_VIEWERS_PER_ROOM=50

# Cleanup Configuration
CLEANUP_INTERVAL=300000
INACTIVE_ROOM_THRESHOLD=1800000
```

### Frontend (.env)
```bash
# API Configuration
REACT_APP_WS_URL=ws://localhost:8080
REACT_APP_API_URL=http://localhost:8080

# Game Configuration
REACT_APP_CANVAS_WIDTH=800
REACT_APP_CANVAS_HEIGHT=600
REACT_APP_DEFAULT_BRUSH_SIZE=2

# Debug Configuration
REACT_APP_DEBUG=false
REACT_APP_LOG_LEVEL=info
```

## Deployment

### Backend Deployment

#### Using PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start index.js --name "scribble-backend"

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
```



#### Environment Setup
```bash
# Production environment
export NODE_ENV=production
export PORT=8080
export REDIS_HOST=your-redis-host
export REDIS_PASSWORD=your-redis-password
```

### Frontend Deployment

#### Build for Production
```bash
# Build optimized production bundle
npm run build

# Serve static files
npm install -g serve
serve -s build -p 3000
```



## Troubleshooting

### Common Issues

#### WebSocket Connection Fails
```bash
# Check if backend is running
curl http://localhost:8080/health

# Check WebSocket endpoint
wscat -c ws://localhost:8080

# Verify firewall settings
sudo ufw status
```

#### Redis Connection Issues
```bash
# Test Redis connection
redis-cli ping

# Check Redis logs
sudo journalctl -u redis

# Verify Redis configuration
redis-cli CONFIG GET "*"
```

#### Frontend Build Errors
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear React cache
npm start -- --reset-cache
```

### Debug Mode
```bash
# Backend debug mode
DEBUG=* npm start

# Frontend debug mode
REACT_APP_DEBUG=true npm start
```

---

**Happy Scribbling!** 
Start drawing, voting, and competing in real-time multiplayer drawing battles