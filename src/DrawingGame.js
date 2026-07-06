import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Users, Clock, Trophy, Palette, Vote, Share2, PenTool, ArrowRight, Maximize2 } from 'lucide-react';

const SOCKET_URL = 'https://sribble-backend-1.onrender.com';

// Signature visual: a torn-sketchpad-edge divider between the brand panel
// and the form panel on the home screen, built as a zigzag clip-path.
const zigzagClipPath = (teeth = 16, amplitude = 4) => {
  const points = ['0% 0%'];
  for (let i = 0; i <= teeth; i++) {
    const y = (i / teeth) * 100;
    const x = i % 2 === 0 ? 100 : 100 - amplitude;
    points.push(`${x}% ${y}%`);
  }
  points.push('0% 100%');
  return `polygon(${points.join(',')})`;
};
const HOME_PANEL_CLIP = zigzagClipPath(18, 4.5);

// Shared design tokens — paper/ink/marker palette used across every screen.
const COLORS = {
  paper: '#FAF7F0',
  paperDim: '#F1ECE1',
  ink: '#1A1A1A',
  coral: '#FF5A36',
  blue: '#3A6EA5',
  yellow: '#FFD23F',
  gray: '#6B6B6B',
  border: '#E4DFD3',
};
const FONT_DISPLAY = "'Permanent Marker', cursive";
const FONT_BODY = "'Space Grotesk', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";
const FONT_IMPORT_URL =
  "@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');";

const SHADOW = `5px 5px 0px ${'#1A1A1A'}`;
const SHADOW_SM = `3px 3px 0px ${'#1A1A1A'}`;


const BrandMark = () => (
  <div className="flex items-center gap-2 mb-6">
    <PenTool className="w-5 h-5" style={{ color: COLORS.coral }} />
    <span className="text-xl" style={{ fontFamily: FONT_DISPLAY, color: COLORS.ink }}>
      Drawing Duel
    </span>
  </div>
);

const DrawingGame = () => {
  // Socket connection
  const [socket, setSocket] = useState(null);

  
  const [currentScreen, setCurrentScreen] = useState('home');
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState('waiting');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState('');
  const [gameResults, setGameResults] = useState(null);
  const [playerDrawings, setPlayerDrawings] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);

  // Drawing state
  const canvasRef = useRef(null);
  const opponentCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [drawingData, setDrawingData] = useState([]);
  const [, setOpponentDrawingData] = useState([]);

  // Picture-in-picture layout state: when true, the opponent's canvas is the
 
  const [pipExpanded, setPipExpanded] = useState(false);

  const drawOnOpponentCanvas = useCallback((data) => {
    if (!opponentCanvasRef.current || !data.length) return;
    const canvas = opponentCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    data.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = point.color;
        ctx.lineWidth = point.size;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      }
    });
  }, []);

  // Socket setup
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('room_created', (data) => {
      setRoomId(data.roomId);
      setRoom(data.room);
      setCurrentScreen('lobby');
      setUserRole('player');
    });

    newSocket.on('joined_room', (data) => {
      setRoomId(data.roomId);
      setRoom(data.room);
      setUserRole(data.role);
      setCurrentScreen('lobby');
    });

    newSocket.on('player_joined', (data) => setRoom(data.room));
    newSocket.on('voter_joined', (data) => setRoom(data.room));
    newSocket.on('player_ready_status', (data) => { /* ... */ });
    newSocket.on('game_started', (data) => {
      setCurrentPrompt(data.prompt);
      setGameState('drawing');
      setCurrentScreen('game');
      setTimeLeft(data.timeLimit / 1000);
      setDrawingData([]);
      setOpponentDrawingData([]);
      setPipExpanded(false);
    });

    newSocket.on('opponent_drawing', (data) => {
      setOpponentDrawingData(data.drawingData);
      drawOnOpponentCanvas(data.drawingData);
    });

    newSocket.on('voting_started', (data) => {
      setGameState('voting');
      setCurrentScreen('voting');
      setPlayerDrawings(data.playerDrawings);
      setTimeLeft(data.timeLimit / 1000);
      setHasVoted(false);
    });

    newSocket.on('vote_cast', (data) => {});

    newSocket.on('game_ended', (data) => {
      setGameResults(data);
      setCurrentScreen('results');
      setGameState('finished');
    });

    newSocket.on('error', (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      newSocket.close();
    };
  }, [drawOnOpponentCanvas]);

  useEffect(() => {
    if (timeLeft > 0 && (gameState === 'drawing' || gameState === 'voting')) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState]);

  // Drawing functions
  const startDrawing = useCallback((e) => {
    if (gameState !== 'drawing' || userRole !== 'player') return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [gameState, userRole]);

  const draw = useCallback((e) => {
    if (!isDrawing || gameState !== 'drawing' || userRole !== 'player') return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.stroke();
    const newPoint = { x, y, color: currentColor, size: brushSize, type: 'draw' };
    const newDrawingData = [...drawingData, newPoint];
    setDrawingData(newDrawingData);
    if (socket) {
      socket.emit('drawing_data', { roomId, drawingData: newDrawingData });
    }
  }, [isDrawing, gameState, userRole, currentColor, brushSize, drawingData, socket, roomId]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
    }
  }, [isDrawing]);

  const clearCanvas = () => {
    if (gameState !== 'drawing' || userRole !== 'player') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawingData([]);
    if (socket) {
      socket.emit('drawing_data', { roomId, drawingData: [] });
    }
  };

  
  const createRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (socket) {
      socket.emit('create_room', { playerName: playerName.trim() });
    }
  };

  const joinRoomAsPlayer = () => {
    if (!playerName.trim() || !roomId.trim()) {
      setError('Please enter your name and room ID');
      return;
    }
    if (socket) {
      socket.emit('join_room_as_player', {
        roomId: roomId.trim().toUpperCase(),
        playerName: playerName.trim()
      });
    }
  };

  const joinRoomAsVoter = () => {
    if (!playerName.trim() || !roomId.trim()) {
      setError('Please enter your name and room ID');
      return;
    }
    if (socket) {
      socket.emit('join_room_as_voter', {
        roomId: roomId.trim().toUpperCase(),
        voterName: playerName.trim()
      });
    }
  };

  const markReady = () => {
    if (socket && userRole === 'player') {
      socket.emit('player_ready', { roomId });
      setIsReady(true);
    }
  };

  const castVote = (playerId) => {
    if (socket && userRole === 'voter' && !hasVoted) {
      socket.emit('vote', { roomId, playerId });
      setHasVoted(true);
    }
  };

  const shareRoom = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join my drawing game!',
        text: `Join room ${roomId} to play or vote!`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(`Room ID: ${roomId}`);
      alert('Room ID copied to clipboard!');
    }
  };

  const startNewGame = () => {
    setCurrentScreen('lobby');
    setGameState('waiting');
    setIsReady(false);
    setGameResults(null);
    setCurrentPrompt('');
    setTimeLeft(0);
    setPipExpanded(false);
  };

// this is the ui part 
 
  const renderHomeScreen = () => (
    <div className="flex flex-col min-h-screen md:flex-row" style={{ backgroundColor: COLORS.paper }}>

      {/* Brand panel — desktop only; torn-sketchpad edge via clip-path */}
      <div
        className="relative hidden overflow-hidden md:flex md:w-[42%] flex-col justify-between px-10 py-12"
        style={{ backgroundColor: '#1A1A1A', clipPath: HOME_PANEL_CLIP }}
      >
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 400 600" preserveAspectRatio="none">
          <path d="M20 40 Q 100 10 180 60 T 340 50" stroke="#FAF7F0" strokeWidth="2" fill="none" />
          <path d="M10 200 Q 120 160 220 220 T 380 210" stroke="#FAF7F0" strokeWidth="2" fill="none" />
          <path d="M30 380 Q 140 340 240 400 T 370 390" stroke="#FAF7F0" strokeWidth="2" fill="none" />
          <path d="M15 520 Q 110 480 200 530 T 360 515" stroke="#FAF7F0" strokeWidth="2" fill="none" />
        </svg>

        <div className="relative z-10 flex items-center gap-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          <PenTool className="w-4 h-4" style={{ color: '#FF5A36' }} />
          <span className="text-xs uppercase" style={{ color: '#FF5A36', letterSpacing: '0.3em' }}>
            Sketch battle
          </span>
        </div>

        <div className="relative z-10">
          <h1
            className="text-6xl leading-none"
            style={{ fontFamily: "'Permanent Marker', cursive", color: '#FAF7F0' }}
          >
            Drawing
            <br />
            <span style={{ color: '#FF5A36' }}>Duel</span>
          </h1>
          <p className="max-w-xs mt-6 text-sm text-gray-400" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Two artists, one prompt, sixty seconds. The crowd decides who wins.
          </p>
        </div>

        <div className="relative z-10 text-xs text-gray-500" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          room codes are 6 characters · works on any device
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-start justify-center flex-1 md:justify-start">
        <div
          className="w-full max-w-md px-6 py-14 md:px-16 md:py-20"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {/* Mobile-only brand line */}
          <div className="flex items-center gap-2 mb-10 md:hidden">
            <PenTool className="w-5 h-5" style={{ color: '#FF5A36' }} />
            <span className="text-2xl" style={{ fontFamily: "'Permanent Marker', cursive", color: '#1A1A1A' }}>
              Drawing Duel
            </span>
          </div>

          {error && (
            <div
              className="px-4 py-3 mb-6 text-sm font-medium border-2"
              style={{ backgroundColor: '#FFD23F', borderColor: '#1A1A1A', color: '#1A1A1A', transform: 'rotate(-1deg)' }}
            >
              {error}
            </div>
          )}

          <label className="block mb-2 text-xs tracking-widest text-gray-500 uppercase">Your name</label>
          <input
            type="text"
            placeholder="e.g. Sam"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full py-2 text-lg placeholder-gray-300 transition-colors bg-transparent border-b-2 border-gray-300 outline-none"
            style={{ color: '#1A1A1A' }}
            onFocus={(e) => (e.target.style.borderColor = '#1A1A1A')}
            onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
          />

          <div className="mt-10">
            <p className="mb-3 text-xs tracking-widest text-gray-500 uppercase">New game</p>
            <button
              onClick={createRoom}
              className="flex items-center justify-between w-full gap-3 px-5 py-4 text-left transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: '#1A1A1A', color: '#FAF7F0', boxShadow: SHADOW }}
            >
              <span className="font-semibold">Start a new room</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-10">
            <p className="mb-3 text-xs tracking-widest text-gray-500 uppercase">Have a code?</p>
            <input
              type="text"
              placeholder="ROOM CODE"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              maxLength={10}
              className="w-full px-4 py-3 text-lg text-center placeholder-gray-300 uppercase transition-colors bg-transparent border-2 border-gray-300 border-dashed outline-none"
              style={{ color: '#1A1A1A', letterSpacing: '0.3em', fontFamily: "'IBM Plex Mono', monospace" }}
              onFocus={(e) => (e.target.style.borderColor = '#FF5A36')}
              onBlur={(e) => (e.target.style.borderColor = '#D1D5DB')}
            />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={joinRoomAsPlayer}
                className="flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-colors border-2"
                style={{ borderColor: '#1A1A1A', color: '#1A1A1A' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1A1A1A'; e.currentTarget.style.color = '#FAF7F0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#1A1A1A'; }}
              >
                <Users className="w-4 h-4" />
                Draw
              </button>
              <button
                onClick={joinRoomAsVoter}
                className="flex items-center justify-center gap-2 px-4 py-3 font-semibold transition-colors border-2"
                style={{ borderColor: '#3A6EA5', color: '#3A6EA5' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#3A6EA5'; e.currentTarget.style.color = '#FAF7F0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#3A6EA5'; }}
              >
                <Vote className="w-4 h-4" />
                Vote
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // LOBBY created by players and viewers
  const renderLobbyScreen = () => (
    <div className="min-h-screen px-4 py-10 md:px-10" style={{ backgroundColor: COLORS.paper, fontFamily: FONT_BODY }}>
      <div className="mx-auto max-w-4xl">
        <BrandMark />
        {/* Room code ticket */}
        <div
          className="flex flex-col items-start justify-between gap-4 p-6 mb-6 border-2 md:flex-row md:items-center"
          style={{ borderColor: COLORS.ink, backgroundColor: '#fff', boxShadow: SHADOW }}
        >
          <div>
            <p className="text-xs tracking-widest uppercase" style={{ color: COLORS.gray }}>Room code</p>
            <h2
              className="text-4xl"
              style={{ fontFamily: FONT_MONO, letterSpacing: '0.2em', color: COLORS.ink }}
            >
              {roomId}
            </h2>
            <p className="mt-1 text-sm" style={{ color: COLORS.gray }}>Waiting for everyone to settle in...</p>
          </div>
          <button
            onClick={shareRoom}
            className="flex items-center gap-2 px-5 py-3 font-semibold transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: COLORS.coral, color: COLORS.ink, boxShadow: SHADOW_SM }}
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-5 bg-white border-l-4" style={{ borderColor: COLORS.coral, boxShadow: SHADOW_SM }}>
            <h3 className="flex items-center gap-2 mb-4 font-semibold" style={{ color: COLORS.ink }}>
              <Users className="w-5 h-5" style={{ color: COLORS.coral }} />
              Players ({room?.playerCount || 0}/2)
            </h3>
            <div className="space-y-2">
              {room && Object.entries(room.players || {}).map(([id, player]) => (
                <div
                  key={id}
                  className="flex items-center justify-between p-3 border"
                  style={{ borderColor: COLORS.border, backgroundColor: COLORS.paperDim }}
                >
                  <span className="font-medium" style={{ color: COLORS.ink }}>{player.name}</span>
                  <span
                    className="px-2 py-1 text-xs font-semibold uppercase tracking-wide"
                    style={player.ready
                      ? { backgroundColor: COLORS.ink, color: COLORS.paper }
                      : { backgroundColor: '#fff', color: COLORS.gray, border: `1px solid ${COLORS.border}` }}
                  >
                    {player.ready ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 bg-white border-l-4" style={{ borderColor: COLORS.blue, boxShadow: SHADOW_SM }}>
            <h3 className="flex items-center gap-2 mb-4 font-semibold" style={{ color: COLORS.ink }}>
              <Vote className="w-5 h-5" style={{ color: COLORS.blue }} />
              Voters ({room?.voterCount || 0})
            </h3>
            <div className="space-y-2">
              {room && Object.entries(room.voters || {}).map(([id, voter]) => (
                <div
                  key={id}
                  className="flex items-center p-3 border"
                  style={{ borderColor: COLORS.border, backgroundColor: COLORS.paperDim }}
                >
                  <span className="font-medium" style={{ color: COLORS.ink }}>{voter.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {userRole === 'player' && !isReady && (
          <div className="mt-6">
            <button
              onClick={markReady}
              disabled={room?.playerCount < 2}
              className={`flex items-center justify-center w-full gap-2 px-4 py-4 font-semibold transition-transform ${
                room?.playerCount < 2 ? 'cursor-not-allowed' : 'hover:-translate-y-0.5'
              }`}
              style={
                room?.playerCount < 2
                  ? { backgroundColor: COLORS.border, color: COLORS.gray }
                  : { backgroundColor: COLORS.ink, color: COLORS.paper, boxShadow: SHADOW_SM }
              }
            >
              {room?.playerCount < 2 ? 'Waiting for another player…' : 'Ready to play'}
              {!(room?.playerCount < 2) && <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        )}
        {userRole === 'voter' && (
          <div className="p-5 mt-6 text-center bg-white border" style={{ borderColor: COLORS.border, boxShadow: SHADOW_SM }}>
            <p style={{ color: COLORS.ink }}>You're ready to vote! Wait for the game to start.</p>
          </div>
        )}
      </div>
    </div>
  );

  // this also contains the canvas needed for this game
  // Layout: a video-call style "main + picture-in-picture" view.
  
  const renderGameScreen = () => {
    const pipTileClasses =
      "absolute bottom-3 right-3 md:bottom-4 md:right-4 z-20 overflow-hidden border-2 shadow-2xl cursor-pointer transition-transform duration-200 hover:scale-105 group";
    const pipTileStyle = { width: '30%', maxWidth: '170px', aspectRatio: '4 / 3', borderColor: COLORS.paper };

    return (
      <div className="min-h-screen px-4 py-8 md:px-10" style={{ backgroundColor: COLORS.paper, fontFamily: FONT_BODY }}>
        <div className="mx-auto max-w-5xl">
          <BrandMark />
          <div
            className="flex items-center justify-between p-4 mb-4 border-2"
            style={{ borderColor: COLORS.ink, backgroundColor: '#fff', boxShadow: SHADOW }}
          >
            <div>
              <p className="text-xs tracking-widest uppercase" style={{ color: COLORS.gray }}>Draw this</p>
              <h2 className="text-2xl" style={{ fontFamily: FONT_DISPLAY, color: COLORS.ink }}>
                {currentPrompt}
              </h2>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: FONT_MONO }}
            >
              <Clock className="w-4 h-4" />
              <span className="text-lg font-semibold">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {userRole === 'player' ? (
            <div className="p-4 bg-white border-2" style={{ borderColor: COLORS.ink, boxShadow: SHADOW }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold" style={{ color: COLORS.ink }}>
                  {pipExpanded ? "Opponent's drawing" : 'Your drawing'}
                </h3>
                {!pipExpanded && (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-8 h-8 border-0 cursor-pointer"
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-20"
                    />
                    <button
                      onClick={clearCanvas}
                      className="px-3 py-1 text-sm font-semibold transition-colors"
                      style={{ color: COLORS.coral }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div
                className="relative w-full overflow-hidden border-2"
                style={{ aspectRatio: '4 / 3', borderColor: COLORS.ink, backgroundColor: COLORS.paperDim }}
              >
                {/* Your canvas: main stage by default, shrinks to the pip
                    corner once the opponent's view is expanded. */}
                <div
                  className={pipExpanded ? pipTileClasses : 'absolute inset-0'}
                  style={pipExpanded ? pipTileStyle : undefined}
                  onClick={pipExpanded ? () => setPipExpanded(false) : undefined}
                >
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={300}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className={`w-full h-full bg-white ${pipExpanded ? '' : 'cursor-crosshair'}`}
                    style={{ touchAction: 'none' }}
                  />
                  <span
                    className="absolute px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bottom-1 left-1"
                    style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: FONT_MONO }}
                  >
                    You
                  </span>
                  {pipExpanded && (
                    <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/30 group-hover:opacity-100">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Opponent canvas: pip corner by default, becomes the main
                    stage when clicked/expanded. */}
                <div
                  className={pipExpanded ? 'absolute inset-0' : pipTileClasses}
                  style={pipExpanded ? undefined : pipTileStyle}
                  onClick={pipExpanded ? undefined : () => setPipExpanded(true)}
                >
                  <canvas
                    ref={opponentCanvasRef}
                    width={400}
                    height={300}
                    className="w-full h-full bg-white"
                  />
                  <span
                    className="absolute px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bottom-1 left-1"
                    style={{ backgroundColor: COLORS.coral, color: COLORS.ink, fontFamily: FONT_MONO }}
                  >
                    Opponent
                  </span>
                  {!pipExpanded && (
                    <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/30 group-hover:opacity-100">
                      <Maximize2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-center" style={{ color: COLORS.gray }}>
                Tap the small preview to swap views — just like flipping the focus in a video call.
              </p>
            </div>
          ) : (
            <div className="p-8 text-center bg-white border-2" style={{ borderColor: COLORS.ink, boxShadow: SHADOW }}>
              <Palette className="w-16 h-16 mx-auto mb-4" style={{ color: COLORS.coral }} />
              <h3 className="mb-2 text-xl" style={{ fontFamily: FONT_DISPLAY, color: COLORS.ink }}>
                Players are drawing…
              </h3>
              <p style={{ color: COLORS.gray }}>Get ready to vote for the best drawing!</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // VOTING
  const renderVotingScreen = () => (
    <div className="min-h-screen px-4 py-10 md:px-10" style={{ backgroundColor: COLORS.paper, fontFamily: FONT_BODY }}>
      <div className="mx-auto max-w-6xl">
        <BrandMark />
        <div className="p-6 mb-6 border-2" style={{ borderColor: COLORS.ink, backgroundColor: '#fff', boxShadow: SHADOW }}>
          <div className="mb-2 text-center">
            <h2 className="text-4xl" style={{ fontFamily: FONT_DISPLAY, color: COLORS.ink }}>Time to vote!</h2>
            <p className="mt-3 mb-4" style={{ color: COLORS.gray }}>Prompt was: "{currentPrompt}"</p>
            <div
              className="inline-flex items-center gap-2 px-3 py-2"
              style={{ backgroundColor: COLORS.ink, color: COLORS.paper, fontFamily: FONT_MONO }}
            >
              <Clock className="w-4 h-4" />
              <span className="text-lg font-semibold">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
          <div className="grid gap-6 mt-6 md:grid-cols-2">
            {playerDrawings.map((player) => (
              <div key={player.playerId} className="p-6 border" style={{ borderColor: COLORS.border, backgroundColor: COLORS.paperDim, boxShadow: SHADOW_SM }}>
                <h3 className="mb-4 font-semibold text-center" style={{ color: COLORS.ink }}>{player.playerName}</h3>
                <div className="p-3 mb-4 bg-white border-2" style={{ borderColor: COLORS.ink }}>
                  <canvas
                    width={400}
                    height={300}
                    className="w-full"
                    ref={(canvas) => {
                      if (canvas && player.drawing) {
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        if (player.drawing.length > 0) {
                          ctx.beginPath();
                          player.drawing.forEach((point, index) => {
                            if (index === 0) {
                              ctx.moveTo(point.x, point.y);
                            } else {
                              ctx.lineTo(point.x, point.y);
                              ctx.strokeStyle = point.color;
                              ctx.lineWidth = point.size;
                              ctx.lineCap = 'round';
                              ctx.stroke();
                              ctx.beginPath();
                              ctx.moveTo(point.x, point.y);
                            }
                          });
                        }
                      }
                    }}
                  />
                </div>
                {userRole === 'voter' && !hasVoted && (
                  <button
                    onClick={() => castVote(player.playerId)}
                    className="flex items-center justify-center w-full gap-2 px-4 py-3 font-semibold transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: COLORS.ink, color: COLORS.paper, boxShadow: SHADOW_SM }}
                  >
                    Vote for {player.playerName}
                  </button>
                )}
                {hasVoted && (
                  <div className="py-3 font-semibold text-center" style={{ color: COLORS.coral }}>
                    Vote cast! ✓
                  </div>
                )}
              </div>
            ))}
          </div>
          {userRole === 'player' && (
            <div className="p-4 mt-6 text-center border" style={{ borderColor: COLORS.border, backgroundColor: COLORS.paperDim }}>
              <p style={{ color: COLORS.ink }}>Voters are deciding the winner. Good luck!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // RESULTS
  const renderResultsScreen = () => (
    <div className="min-h-screen px-4 py-10 md:px-10" style={{ backgroundColor: COLORS.paper, fontFamily: FONT_BODY }}>
      <div className="mx-auto max-w-4xl">
        <BrandMark />
        <div className="p-8 border-2" style={{ borderColor: COLORS.ink, backgroundColor: '#fff', boxShadow: SHADOW }}>
          <div className="mb-8 text-center">
            <Trophy className="w-14 h-14 mx-auto mb-3" style={{ color: COLORS.coral }} />
            <h2 className="text-4xl" style={{ fontFamily: FONT_DISPLAY, color: COLORS.ink }}>Game results</h2>
            <p className="mt-2" style={{ color: COLORS.gray }}>Prompt: "{gameResults?.prompt}"</p>
          </div>
          {gameResults && (
            <div className="space-y-6">
              {gameResults.results.map((result, index) => (
                <div
                  key={result.playerId}
                  className="p-6 border-2"
                  style={
                    index === 0
                      ? { borderColor: COLORS.coral, backgroundColor: '#FFF4EF', boxShadow: SHADOW_SM }
                      : { borderColor: COLORS.border, backgroundColor: COLORS.paperDim }
                  }
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {index === 0 && <Trophy className="w-6 h-6" style={{ color: COLORS.coral }} />}
                      <h3 className="text-xl font-semibold" style={{ color: COLORS.ink }}>{result.playerName}</h3>
                      {index === 0 && (
                        <span
                          className="px-3 py-1 text-xs font-semibold tracking-wide uppercase"
                          style={{ backgroundColor: COLORS.coral, color: COLORS.ink }}
                        >
                          Winner
                        </span>
                      )}
                    </div>
                    <div className="text-right" style={{ fontFamily: FONT_MONO }}>
                      <div className="text-2xl font-semibold" style={{ color: COLORS.ink }}>{result.votes}</div>
                      <div className="text-xs uppercase tracking-wide" style={{ color: COLORS.gray }}>votes</div>
                    </div>
                  </div>
                  <div className="p-3 bg-white border-2" style={{ borderColor: COLORS.ink }}>
                    <canvas
                      width={400}
                      height={300}
                      className="w-full"
                      ref={(canvas) => {
                        if (canvas && result.drawing) {
                          const ctx = canvas.getContext('2d');
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                          if (result.drawing.length > 0) {
                            ctx.beginPath();
                            result.drawing.forEach((point, idx) => {
                              if (idx === 0) {
                                ctx.moveTo(point.x, point.y);
                              } else {
                                ctx.lineTo(point.x, point.y);
                                ctx.strokeStyle = point.color;
                                ctx.lineWidth = point.size;
                                ctx.lineCap = 'round';
                                ctx.stroke();
                                ctx.beginPath();
                                ctx.moveTo(point.x, point.y);
                              }
                            });
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-8 text-center">
            <button
              onClick={startNewGame}
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: COLORS.ink, color: COLORS.paper, boxShadow: SHADOW }}
            >
              Play again
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

 
  return (
    <div className="font-sans" style={{ backgroundColor: COLORS.paper }}>
      <style>{FONT_IMPORT_URL}</style>
      {currentScreen === 'home' && renderHomeScreen()}
      {currentScreen === 'lobby' && renderLobbyScreen()}
      {currentScreen === 'game' && renderGameScreen()}
      {currentScreen === 'voting' && renderVotingScreen()}
      {currentScreen === 'results' && renderResultsScreen()}
    </div>
  );
};

export default DrawingGame;