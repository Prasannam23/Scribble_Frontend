import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Users, Clock, Trophy, Palette, Vote, Share2, Play, UserPlus } from 'lucide-react';

const SOCKET_URL = 'http://localhost:3001';

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

// this is the ui part 
 
  const renderHomeScreen = () => (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white shadow-2xl rounded-2xl">
        <div className="mb-8 text-center">
          <Palette className="w-16 h-16 mx-auto mb-4 text-black" />
          <h1 className="mb-2 text-3xl font-bold text-black">Drawing Duel</h1>
          <p className="text-gray-600">Compete in epic drawing battles!</p>
        </div>
        {error && (
          <div className="px-4 py-3 mb-4 text-red-700 border border-red-200 rounded bg-red-50">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
          />
          <button
            onClick={createRoom}
            className="flex items-center justify-center w-full gap-2 px-4 py-3 font-semibold text-white transition duration-200 bg-black rounded-lg hover:bg-gray-800"
          >
            <Play className="w-5 h-5" />
            Create Room
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-gray-500 bg-white">or join existing room</span>
            </div>
          </div>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={joinRoomAsPlayer}
              className="flex items-center justify-center gap-2 px-4 py-3 font-semibold text-white transition duration-200 bg-gray-900 rounded-lg hover:bg-black"
            >
              <Users className="w-4 h-4" />
              Play
            </button>
            <button
              onClick={joinRoomAsVoter}
              className="flex items-center justify-center gap-2 px-4 py-3 font-semibold text-white transition duration-200 bg-gray-500 rounded-lg hover:bg-gray-700"
            >
              <Vote className="w-4 h-4" />
              Vote
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // LOBBY created by players and viewers
  const renderLobbyScreen = () => (
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="p-6 mb-6 bg-white shadow-2xl rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-black">Room {roomId}</h2>
              <p className="text-gray-600">Waiting for players...</p>
            </div>
            <button
              onClick={shareRoom}
              className="flex items-center gap-2 px-4 py-2 text-white transition duration-200 bg-gray-900 rounded-lg hover:bg-black"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="flex items-center gap-2 mb-3 font-semibold text-black">
                <Users className="w-5 h-5" />
                Players ({room?.playerCount || 0}/2)
              </h3>
              <div className="space-y-2">
                {room && Object.entries(room.players || {}).map(([id, player]) => (
                  <div key={id} className="flex items-center justify-between p-3 bg-white rounded-lg">
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
            <div className="p-4 bg-gray-100 rounded-xl">
              <h3 className="flex items-center gap-2 mb-3 font-semibold text-black">
                <Vote className="w-5 h-5" />
                Voters ({room?.voterCount || 0})
              </h3>
              <div className="space-y-2">
                {room && Object.entries(room.voters || {}).map(([id, voter]) => (
                  <div key={id} className="flex items-center p-3 bg-white rounded-lg">
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
            <div className="p-4 mt-6 bg-gray-100 rounded-xl">
              <p className="text-center text-black">
                You're ready to vote! Wait for the game to start.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

 // this also contains the canvas needed for this game 
  const renderGameScreen = () => (
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="mx-auto max-w-7xl">
        <div className="p-4 mb-4 bg-white shadow-lg rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-black">Draw: {currentPrompt}</h2>
              <p className="text-gray-600">Show your artistic skills!</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-black">
                <Clock className="w-5 h-5" />
                <span className="text-lg font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
        {userRole === 'player' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            
            <div className="p-4 bg-white shadow-lg rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-black">Your Drawing</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => setCurrentColor(e.target.value)}
                    className="w-8 h-8 border-0 rounded"
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
                    className="px-3 py-1 text-sm text-white bg-gray-600 rounded hover:bg-black"
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
                className="w-full border-2 border-gray-300 rounded-lg cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
            </div>
            {/* Opponent Canvas */}
            <div className="p-4 bg-white shadow-lg rounded-xl">
              <h3 className="mb-4 font-semibold text-black">Opponent's Drawing</h3>
              <canvas
                ref={opponentCanvasRef}
                width={400}
                height={300}
                className="w-full border-2 border-gray-300 rounded-lg"
              />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-white shadow-lg rounded-xl">
            <Palette className="w-16 h-16 mx-auto mb-4 text-black" />
            <h3 className="mb-2 text-xl font-semibold text-black">Players are drawing...</h3>
            <p className="text-gray-600">Get ready to vote for the best drawing!</p>
          </div>
        )}
      </div>
    </div>
  );

  // VOTING
  const renderVotingScreen = () => (
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="p-6 mb-6 bg-white shadow-2xl rounded-2xl">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-3xl font-bold text-black">Time to Vote!</h2>
            <p className="mb-4 text-gray-600">Prompt was: "{currentPrompt}"</p>
            <div className="flex items-center justify-center gap-2 text-black">
              <Clock className="w-5 h-5" />
              <span className="text-xl font-bold">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {playerDrawings.map((player) => (
              <div key={player.playerId} className="p-6 bg-gray-50 rounded-xl">
                <h3 className="mb-4 font-semibold text-center text-black">{player.playerName}</h3>
                <div className="p-4 mb-4 bg-white rounded-lg">
                  <canvas
                    width={400}
                    height={300}
                    className="w-full border border-gray-300 rounded"
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
                    className="w-full px-4 py-3 font-semibold text-white transition duration-200 bg-black rounded-lg hover:bg-gray-800"
                  >
                    Vote for {player.playerName}
                  </button>
                )}
                {hasVoted && (
                  <div className="font-semibold text-center text-gray-700">
                    Vote cast! ✓
                  </div>
                )}
              </div>
            ))}
          </div>
          {userRole === 'player' && (
            <div className="p-4 mt-6 text-center bg-gray-100 rounded-xl">
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
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="p-8 bg-white shadow-2xl rounded-2xl">
          <div className="mb-8 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-700" />
            <h2 className="mb-2 text-3xl font-bold text-black">Game Results</h2>
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
                      {index === 0 && <Trophy className="w-6 h-6 text-gray-900" />}
                      <h3 className="text-xl font-semibold text-black">{result.playerName}</h3>
                      {index === 0 && <span className="px-3 py-1 text-sm font-semibold text-black bg-gray-100 rounded-full">Winner!</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-black">{result.votes}</div>
                      <div className="text-sm text-gray-600">votes</div>
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg">
                    <canvas
                      width={400}
                      height={300}
                      className="w-full border border-gray-300 rounded"
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
              className="px-6 py-3 font-semibold text-white transition duration-200 bg-black rounded-lg hover:bg-gray-800"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );

 
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
