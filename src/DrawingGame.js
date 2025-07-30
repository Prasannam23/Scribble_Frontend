import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Users, Clock, Trophy, Palette, Vote, Share2, Play, UserPlus } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3001';

const DrawingGame = () => {
  // Socket connection
  const [socket, setSocket] = useState(null);

  // App state
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
  const [opponentDrawingData, setOpponentDrawingData] = useState([]);

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
  }, []);

  // Timer countdown
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

  // Game actions
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
  };

  // Screens -----------------------------------------------------------------

  // HOME
  const renderHomeScreen = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Palette className="mx-auto h-16 w-16 text-black mb-4" />
          <h1 className="text-3xl font-bold text-black mb-2">Drawing Duel</h1>
          <p className="text-gray-600">Compete in epic drawing battles!</p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-700 focus:border-transparent outline-none"
          />
          <button
            onClick={createRoom}
            className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            <Play className="h-5 w-5" />
            Create Room
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or join existing room</span>
            </div>
          </div>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-700 focus:border-transparent outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={joinRoomAsPlayer}
              className="bg-gray-900 hover:bg-black text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              Play
            </button>
            <button
              onClick={joinRoomAsVoter}
              className="bg-gray-500 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              <Vote className="h-4 w-4" />
              Vote
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // LOBBY
  const renderLobbyScreen = () => (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-black">Room {roomId}</h2>
              <p className="text-gray-600">Waiting for players...</p>
            </div>
            <button
              onClick={shareRoom}
              className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg flex items-center gap-2 transition duration-200"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Players ({room?.playerCount || 0}/2)
              </h3>
              <div className="space-y-2">
                {room && Object.entries(room.players || {}).map(([id, player]) => (
                  <div key={id} className="flex items-center justify-between bg-white rounded-lg p-3">
                    <span className="font-medium text-gray-900">{player.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${player.ready ?
                      'bg-gray-800 text-white' :
                      'bg-gray-200 text-gray-700'}`}>
                      {player.ready ? 'Ready' : 'Waiting'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-100 rounded-xl p-4">
              <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                <Vote className="h-5 w-5" />
                Voters ({room?.voterCount || 0})
              </h3>
              <div className="space-y-2">
                {room && Object.entries(room.voters || {}).map(([id, voter]) => (
                  <div key={id} className="flex items-center bg-white rounded-lg p-3">
                    <span className="font-medium text-gray-900">{voter.name}</span>
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
                className={`w-full bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition duration-200`}
              >
                {room?.playerCount < 2 ? 'Waiting for another player...' : 'Ready to Play!'}
              </button>
            </div>
          )}
          {userRole === 'voter' && (
            <div className="mt-6 bg-gray-100 rounded-xl p-4">
              <p className="text-black text-center">
                You're ready to vote! Wait for the game to start.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // GAME
  const renderGameScreen = () => (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-black">Draw: {currentPrompt}</h2>
              <p className="text-gray-600">Show your artistic skills!</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-black">
                <Clock className="h-5 w-5" />
                <span className="font-bold text-lg">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
        {userRole === 'player' ? (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Your Canvas */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-black">Your Drawing</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => setCurrentColor(e.target.value)}
                    className="w-8 h-8 rounded border-0"
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
                    className="bg-gray-600 hover:bg-black text-white px-3 py-1 rounded text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <canvas
                ref={canvasRef}
                width={400}
                height={300}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="border-2 border-gray-300 rounded-lg cursor-crosshair w-full"
                style={{ touchAction: 'none' }}
              />
            </div>
            {/* Opponent Canvas */}
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="font-semibold text-black mb-4">Opponent's Drawing</h3>
              <canvas
                ref={opponentCanvasRef}
                width={400}
                height={300}
                className="border-2 border-gray-300 rounded-lg w-full"
              />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <Palette className="mx-auto h-16 w-16 text-black mb-4" />
            <h3 className="text-xl font-semibold text-black mb-2">Players are drawing...</h3>
            <p className="text-gray-600">Get ready to vote for the best drawing!</p>
          </div>
        )}
      </div>
    </div>
  );

  // VOTING
  const renderVotingScreen = () => (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-black mb-2">Time to Vote!</h2>
            <p className="text-gray-600 mb-4">Prompt was: "{currentPrompt}"</p>
            <div className="flex items-center justify-center gap-2 text-black">
              <Clock className="h-5 w-5" />
              <span className="font-bold text-xl">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {playerDrawings.map((player) => (
              <div key={player.playerId} className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-black mb-4 text-center">{player.playerName}</h3>
                <div className="bg-white rounded-lg p-4 mb-4">
                  <canvas
                    width={400}
                    height={300}
                    className="border border-gray-300 rounded w-full"
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
                    className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                  >
                    Vote for {player.playerName}
                  </button>
                )}
                {hasVoted && (
                  <div className="text-center text-gray-700 font-semibold">
                    Vote cast! ✓
                  </div>
                )}
              </div>
            ))}
          </div>
          {userRole === 'player' && (
            <div className="mt-6 bg-gray-100 rounded-xl p-4 text-center">
              <p className="text-black">
                Voters are deciding the winner. Good luck! 
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // RESULTS
  const renderResultsScreen = () => (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Trophy className="mx-auto h-16 w-16 text-gray-700 mb-4" />
            <h2 className="text-3xl font-bold text-black mb-2">Game Results</h2>
            <p className="text-gray-600">Prompt: "{gameResults?.prompt}"</p>
          </div>
          {gameResults && (
            <div className="space-y-6">
              {gameResults.results.map((result, index) => (
                <div key={result.playerId} className={`rounded-xl p-6 ${index === 0 ?
                  'bg-gray-200 border-2 border-gray-600' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {index === 0 && <Trophy className="h-6 w-6 text-gray-900" />}
                      <h3 className="text-xl font-semibold text-black">{result.playerName}</h3>
                      {index === 0 && <span className="bg-gray-100 text-black px-3 py-1 rounded-full text-sm font-semibold">Winner!</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-black">{result.votes}</div>
                      <div className="text-sm text-gray-600">votes</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <canvas
                      width={400}
                      height={300}
                      className="border border-gray-300 rounded w-full"
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
              className="bg-black hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="font-sans">
      {currentScreen === 'home' && renderHomeScreen()}
      {currentScreen === 'lobby' && renderLobbyScreen()}
      {currentScreen === 'game' && renderGameScreen()}
      {currentScreen === 'voting' && renderVotingScreen()}
      {currentScreen === 'results' && renderResultsScreen()}
    </div>
  );
};

export default DrawingGame;
