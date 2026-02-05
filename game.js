/**
 * Flying Chess - Frontend Game Logic
 */

const API_BASE = 'https://eighty-comics-visit.loca.lt';
const socket = io(API_BASE);

// Game State
let currentGame = {
  gameId: null,
  playerId: null,
  playerColor: null,
  status: null,
  players: [],
  currentTurn: null
};

// DOM Elements
const elements = {
  screens: {
    lobby: document.getElementById('lobby-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
  },
  forms: {
    createGame: document.getElementById('create-game-form'),
    joinGame: document.getElementById('join-game-form')
  },
  inputs: {
    playerName: document.getElementById('player-name'),
    joinPlayerName: document.getElementById('join-player-name'),
    gameIdInput: document.getElementById('game-id-input'),
    maxPlayers: document.getElementById('max-players')
  },
  buttons: {
    ready: document.getElementById('ready-btn'),
    leave: document.getElementById('leave-btn'),
    copyGameId: document.getElementById('copy-game-id-btn'),
    rollDice: document.getElementById('roll-dice-btn'),
    playAgain: document.getElementById('play-again-btn'),
    home: document.getElementById('home-btn')
  },
  displays: {
    gameId: document.getElementById('display-game-id'),
    playersList: document.getElementById('players-list'),
    availableGames: document.getElementById('available-games'),
    waitingMessage: document.getElementById('waiting-message'),
    diceDisplay: document.getElementById('dice-display'),
    gameBoard: document.getElementById('game-board'),
    playersPanel: document.getElementById('players-panel'),
    diceResult: document.getElementById('dice-result-val'),
    gameLog: document.getElementById('game-log'),
    winnerMessage: document.getElementById('winner-message'),
    gameOverStats: document.getElementById('game-over-stats'),
    toastContainer: document.getElementById('toast-container')
  }
};

// ==================== Initialization ====================

function init() {
  setupEventListeners();
  loadAvailableGames();
  setInterval(loadAvailableGames, 5000); // Refresh every 5 seconds
}

function setupEventListeners() {
  // Create game form
  elements.forms.createGame.addEventListener('submit', handleCreateGame);

  // Join game form
  elements.forms.joinGame.addEventListener('submit', handleJoinGame);

  // Game buttons
  elements.buttons.ready.addEventListener('click', handleReady);
  elements.buttons.leave.addEventListener('click', handleLeave);
  elements.buttons.copyGameId.addEventListener('click', handleCopyGameId);
  elements.buttons.rollDice.addEventListener('click', () => handleRollDice());
  elements.buttons.rollDice.addEventListener('contextmenu', handleRollDiceCheat);
  elements.buttons.playAgain.addEventListener('click', () => showScreen('lobby'));
  elements.buttons.home.addEventListener('click', () => showScreen('lobby'));

  // Available games list
  elements.displays.availableGames.addEventListener('click', handleJoinFromList);
}

// ==================== Screen Management ====================

function showScreen(screenName) {
  Object.values(elements.screens).forEach(screen => {
    screen.classList.add('hidden');
  });
  elements.screens[screenName].classList.remove('hidden');
}

// ==================== API Calls ====================

async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API call failed');
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

async function loadAvailableGames() {
  try {
    const data = await apiCall('/api/games');
    displayAvailableGames(data.games);
  } catch (error) {
    console.error('Failed to load games:', error);
  }
}

// ==================== Event Handlers ====================

async function handleCreateGame(e) {
  e.preventDefault();

  const playerName = elements.inputs.playerName.value.trim();
  const maxPlayers = parseInt(elements.inputs.maxPlayers.value);

  if (!playerName) {
    showToast('Please enter your name', 'warning');
    return;
  }

  try {
    const data = await apiCall('/api/games/create', 'POST', {
      playerName,
      maxPlayers
    });

    currentGame = {
      gameId: data.gameId,
      playerId: data.playerId,
      playerColor: data.color,
      players: [{ // FIX: Initialize players array with host player
        playerId: data.playerId,
        name: playerName,
        color: data.color,
        isReady: false,
        pieces: []
      }]
    };

    showWaitingRoom(data.gameId);
    updatePlayersList(currentGame.players); // FIX: Update players list display

    socket.emit('join_game', {
      gameId: data.gameId,
      playerId: data.playerId
    });

    showToast('Game created successfully!', 'success');
  } catch (error) {
    console.error('Failed to create game:', error);
  }
}

async function handleJoinGame(e) {
  e.preventDefault();

  const playerName = elements.inputs.joinPlayerName.value.trim();
  const gameId = elements.inputs.gameIdInput.value.trim();

  if (!playerName || !gameId) {
    showToast('Please fill in all fields', 'warning');
    return;
  }

  try {
    const data = await apiCall(`/api/games/${gameId}/join`, 'POST', {
      playerName
    });

    currentGame = {
      gameId: data.game.gameId,
      playerId: data.playerId,
      playerColor: data.color,
      players: data.game.players || [] // FIX: Initialize players array
    };

    showWaitingRoom(data.game.gameId);
    updatePlayersList(data.game.players || []); // FIX: Update players list display

    socket.emit('join_game', {
      gameId: data.game.gameId,
      playerId: data.playerId
    });

    showToast('Joined game successfully!', 'success');
  } catch (error) {
    console.error('Failed to join game:', error);
  }
}

async function handleJoinFromList(e) {
  if (e.target.classList.contains('game-item-join')) {
    const gameId = e.target.dataset.gameId;

    elements.inputs.gameIdInput.value = gameId;
    elements.inputs.joinPlayerName.focus();

    showToast('Enter your name to join', 'info');
  }
}

function handleReady() {
  socket.emit('ready', {
    gameId: currentGame.gameId,
    playerId: currentGame.playerId
  });

  elements.buttons.ready.textContent = 'Ready!';
  elements.buttons.ready.disabled = true;
}

function handleLeave() {
  socket.emit('leave_game', {
    gameId: currentGame.gameId,
    playerId: currentGame.playerId
  });

  showScreen('lobby');
  currentGame = {
    gameId: null,
    playerId: null,
    playerColor: null,
    status: null,
    players: [],
    currentTurn: null
  };
}

function handleCopyGameId() {
  navigator.clipboard.writeText(currentGame.gameId).then(() => {
    showToast('Game ID copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy Game ID', 'error');
  });
}

function handleRollDice(cheatValue = null) {
  if (currentGame.currentTurn !== currentGame.playerId) {
    showToast('Wait for your turn!', 'warning');
    return;
  }

  socket.emit('roll_dice', {
    gameId: currentGame.gameId,
    playerId: currentGame.playerId,
    cheatValue: cheatValue // Optional: if provided, use this value instead of random
  });

  elements.buttons.rollDice.disabled = true;
}

function handleRollDiceCheat(e) {
  e.preventDefault(); // Prevent context menu
  if (currentGame.currentTurn !== currentGame.playerId) {
    showToast('Wait for your turn!', 'warning');
    return;
  }

  const cheatValue = prompt('Enter dice value (1-6):');
  const numValue = parseInt(cheatValue);

  if (isNaN(numValue) || numValue < 1 || numValue > 6) {
    showToast('Invalid value! Use 1-6', 'error');
    return;
  }

  handleRollDice(numValue);
  showToast(`Cheating: Rolling ${numValue}!`, 'info');
}

function handlePieceClick(pieceId) {
  if (currentGame.currentTurn !== currentGame.playerId) {
    showToast('Wait for your turn!', 'warning');
    return;
  }

  if (!currentGame.diceValue) {
    showToast('Roll the dice first!', 'warning');
    return;
  }

  socket.emit('move_piece', {
    gameId: currentGame.gameId,
    playerId: currentGame.playerId,
    pieceId,
    steps: currentGame.diceValue
  });
}

// ==================== Display Functions ====================

function displayAvailableGames(games) {
  if (games.length === 0) {
    elements.displays.availableGames.innerHTML = '<p style="text-align:center;color:#7f8c8d;">No games available. Create one!</p>';
    return;
  }

  elements.displays.availableGames.innerHTML = games.map(game => `
    <div class="game-item">
      <div class="game-item-info">
        <div class="game-item-id">${game.gameId}</div>
        <div class="game-item-players">${game.playerCount} / ${game.maxPlayers} players</div>
      </div>
      <button class="game-item-join" data-game-id="${game.gameId}">Join</button>
    </div>
  `).join('');
}

function showWaitingRoom(gameId) {
  showScreen('waiting');
  elements.displays.gameId.textContent = gameId;
  elements.buttons.ready.disabled = false;
  elements.buttons.ready.textContent = 'Ready';
  elements.displays.waitingMessage.textContent = 'Waiting for players...';
}

function updatePlayersList(players) {
  elements.displays.playersList.innerHTML = players.map(player => `
    <div class="player-item ${player.isReady ? 'ready' : ''}">
      <div class="player-color" style="background: ${getColorHex(player.color)}"></div>
      <div class="player-name">${player.name}</div>
      <div class="player-status ${player.isReady ? 'ready' : 'waiting'}">
        ${player.isReady ? 'Ready' : 'Waiting'}
      </div>
    </div>
  `).join('');

  currentGame.players = players;
}

function updatePlayersPanel(players) {
  elements.displays.playersPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px; color: #333;">玩家状态</div>
    ${players.map(player => `
      <div class="tyn-player-row ${player.playerId === currentGame.currentTurn ? 'active' : ''}">
        <span>${player.name}${player.playerId === currentGame.playerId ? '(您)' : ''}</span>
        <span>${player.piecesAtHome}/4</span>
      </div>
    `).join('')}
  `;

  currentGame.players = players;
}

function createGameBoard() {
  elements.displays.gameBoard.innerHTML = '';
  // The original board image is 850x850, Python scales it to 425x425.
  // We'll stick to 425x425 for positioning consistency with Tynox.
  elements.displays.gameBoard.style.width = '425px';
  elements.displays.gameBoard.style.height = '425px';
  elements.displays.gameBoard.style.backgroundImage = 'url("resource/flying_chess.jpg")';
  elements.displays.gameBoard.style.backgroundSize = 'contain';
  elements.displays.gameBoard.style.position = 'relative';
  elements.displays.gameBoard.classList.add('image-board');
}

function getCellType(row, col) {
  // Bases (Corners)
  if (row < 6 && col < 6) return { type: 'base', owner: 'blue' };
  if (row < 6 && col > 8) return { type: 'base', owner: 'green' };
  if (row > 8 && col < 6) return { type: 'base', owner: 'yellow' };
  if (row > 8 && col > 8) return { type: 'base', owner: 'red' };

  // Home Paths
  if (row === 7 && col >= 1 && col <= 6) return { type: 'home-path', owner: 'blue' };
  if (col === 7 && row >= 1 && row <= 6) return { type: 'home-path', owner: 'green' };
  if (row === 7 && col >= 8 && col <= 13) return { type: 'home-path', owner: 'yellow' };
  if (col === 7 && row >= 8 && row <= 13) return { type: 'home-path', owner: 'red' };

  // Center
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) return { type: 'home' };

  // Common Track
  const colors = ['blue', 'green', 'yellow', 'red'];
  const commonPath = [
    { r: 6, c: 1 }, { r: 6, c: 0 }, { r: 7, c: 0 }, { r: 8, c: 0 }, { r: 8, c: 1 }, { r: 8, c: 2 }, { r: 8, c: 3 }, { r: 8, c: 4 }, { r: 8, c: 5 },
    { r: 9, c: 6 }, { r: 10, c: 6 }, { r: 11, c: 6 }, { r: 12, c: 6 }, { r: 13, c: 6 }, { r: 14, c: 6 }, { r: 14, c: 7 }, { r: 14, c: 8 },
    { r: 13, c: 8 }, { r: 12, c: 8 }, { r: 11, c: 8 }, { r: 10, c: 8 }, { r: 9, c: 8 },
    { r: 8, c: 9 }, { r: 8, c: 10 }, { r: 8, c: 11 }, { r: 8, c: 12 }, { r: 8, c: 13 }, { r: 8, c: 14 }, { r: 7, c: 14 }, { r: 6, c: 14 },
    { r: 6, c: 13 }, { r: 6, c: 12 }, { r: 6, c: 11 }, { r: 6, c: 10 }, { r: 6, c: 9 },
    { r: 5, c: 8 }, { r: 4, c: 8 }, { r: 3, c: 8 }, { r: 2, c: 8 }, { r: 1, c: 8 }, { r: 0, c: 8 }, { r: 0, c: 7 }, { r: 0, c: 6 },
    { r: 1, c: 6 }, { r: 2, c: 6 }, { r: 3, c: 6 }, { r: 4, c: 6 }, { r: 5, c: 6 },
    { r: 6, c: 5 }, { r: 6, c: 4 }, { r: 6, c: 3 }, { r: 6, c: 2 }
  ];

  const idx = commonPath.findIndex(p => p.r === row && p.c === col);
  if (idx !== -1) {
    return { type: 'common', owner: colors[idx % 4] };
  }

  return { type: 'empty' };
}

function handleCellClick(row, col) {
  // Handle piece selection/movement
}

function renderPieces(players) {
  // Clear all pieces first (but maintain a map for smoother transitions if possible)
  // For now, let's just clear and re-render but with offsets for stacking
  document.querySelectorAll('.piece-img').forEach(p => p.remove());

  // Group pieces by coordinate to handle stacking
  const coordGroups = {};

  players.forEach(player => {
    player.pieces.forEach(piece => {
      if (piece.status === 'finished') return;
      if (!piece.position) return;

      const key = `${piece.position.x},${piece.position.y}`;
      if (!coordGroups[key]) coordGroups[key] = [];
      coordGroups[key].push({ player, piece });
    });
  });

  // Render each group with offsets if multiple pieces
  Object.values(coordGroups).forEach(group => {
    group.forEach((item, index) => {
      const { player, piece } = item;
      const pieceEl = document.createElement('img');
      console.log(`Rendering piece: ${player.color} at ${piece.stepIndex} ->`, getCoords(player.color, piece.stepIndex));
      pieceEl.src = `resource/${player.color}.gif`;
      pieceEl.className = 'piece-img';
      pieceEl.id = `piece-${player.color}-${piece.pieceId}`;
      const debugCoords = getCoords(player.color, piece.stepIndex);
      console.log(`Piece ${player.color} index ${piece.stepIndex} coords:`, debugCoords);
      pieceEl.dataset.pieceId = piece.pieceId;
      pieceEl.dataset.playerId = player.playerId;
      pieceEl.title = `${player.color} (Index: ${piece.stepIndex}) @ [${debugCoords ? debugCoords.x : '?'}, ${debugCoords ? debugCoords.y : '?'}]`;
      pieceEl.style.position = 'absolute';

      // Stacking offset (slight shift if more than one piece)
      let offsetX = 0;
      let offsetY = 0;
      const CORRECTION_OFFSET = 0; // Center piece on coordinate

      if (group.length > 1) {
        offsetX = (index % 2) * 8 - 4 + CORRECTION_OFFSET;
        offsetY = Math.floor(index / 2) * 8 - 4 + CORRECTION_OFFSET;
      } else {
        offsetX = CORRECTION_OFFSET;
        offsetY = CORRECTION_OFFSET;
      }

      // Scale piece based on position
      if (piece.stepIndex >= 90 && piece.stepIndex <= 93) {
        pieceEl.classList.add('in-base');
      } else {
        pieceEl.classList.remove('in-base');
      }

      pieceEl.style.left = `${piece.position.x + offsetX}px`;
      pieceEl.style.top = `${piece.position.y + offsetY}px`;

      // Initial rotation (could be improved by storing piece direction)
      if (piece.direction) {
        pieceEl.style.transform = `rotate(${piece.direction}deg)`;
      }

      elements.displays.gameBoard.appendChild(pieceEl);

      if (player.playerId === currentGame.playerId) {
        pieceEl.style.cursor = 'pointer';
        pieceEl.addEventListener('click', (e) => {
          e.stopPropagation();
          handlePieceClick(piece.pieceId);
        });
      }
    });
  });
}

function calculateRotation(x1, y1, x2, y2) {
  if (x1 === x2 && y1 === y2) return null;
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  return angle + 90; // Adjust for the GIF's default orientation (usually points up)
}

/**
 * Utility to get coordinates for a step index and color (Tynox exact)
 */
function getCoords(color, stepIndex) {
  // Ensure strict coordinates mapping
  const BOARD_COORDS = {
    blue: { 1: [22, 122], 2: [50, 110], 3: [75, 110], 4: [104, 122], 5: [120, 100], 6: [112, 76], 7: [112, 50], 8: [122, 20], 9: [150, 14], 10: [175, 14], 11: [200, 14], 12: [225, 14], 13: [250, 14], 14: [278, 22], 15: [288, 50], 16: [288, 76], 17: [278, 100], 18: [296, 122], 19: [324, 110], 20: [350, 110], 21: [376, 122], 22: [388, 150], 23: [388, 175], 24: [388, 200], 25: [388, 225], 26: [388, 250], 27: [376, 275], 28: [350, 288], 29: [325, 288], 30: [296, 275], 31: [278, 296], 32: [288, 325], 33: [288, 350], 34: [278, 377], 35: [250, 388], 36: [225, 388], 37: [200, 388], 38: [175, 388], 39: [150, 388], 40: [122, 377], 41: [112, 350], 42: [112, 325], 43: [122, 296], 44: [104, 275], 45: [75, 288], 46: [50, 288], 47: [22, 275], 48: [14, 250], 49: [14, 225], 50: [14, 200], 51: [50, 200], 52: [75, 200], 53: [100, 200], 54: [125, 200], 55: [150, 200], 56: [175, 200], 0: [6, 100], 90: [5, 5], 91: [5, 50], 92: [50, 5], 93: [50, 50] },
    green: { 1: [278, 22], 2: [288, 50], 3: [288, 76], 4: [278, 100], 5: [296, 122], 6: [324, 110], 7: [350, 110], 8: [376, 122], 9: [388, 150], 10: [388, 175], 11: [388, 200], 12: [388, 225], 13: [388, 250], 14: [376, 275], 15: [350, 288], 16: [325, 288], 17: [296, 275], 18: [278, 296], 19: [288, 325], 20: [288, 350], 21: [278, 377], 22: [250, 388], 23: [225, 388], 24: [200, 388], 25: [175, 388], 26: [150, 388], 27: [122, 377], 28: [112, 350], 29: [112, 325], 30: [122, 296], 31: [104, 275], 32: [75, 288], 33: [50, 288], 34: [22, 275], 35: [14, 250], 36: [14, 225], 37: [14, 200], 38: [14, 175], 39: [14, 150], 40: [22, 122], 41: [50, 110], 42: [75, 110], 43: [104, 122], 44: [120, 100], 45: [112, 76], 46: [112, 50], 47: [122, 20], 48: [150, 14], 49: [175, 14], 50: [200, 14], 51: [200, 50], 52: [200, 75], 53: [200, 100], 54: [200, 125], 55: [200, 150], 56: [200, 175], 0: [300, 6], 90: [330, 5], 91: [330, 50], 92: [375, 5], 93: [375, 50] },
    yellow: { 1: [122, 377], 2: [112, 350], 3: [112, 325], 4: [122, 296], 5: [104, 275], 6: [75, 288], 7: [50, 288], 8: [22, 275], 9: [14, 250], 10: [14, 225], 11: [14, 200], 12: [14, 175], 13: [14, 150], 14: [22, 122], 15: [50, 110], 16: [75, 110], 17: [104, 122], 18: [120, 100], 19: [112, 76], 20: [112, 50], 21: [122, 20], 22: [150, 14], 23: [175, 14], 24: [200, 14], 25: [225, 14], 26: [250, 14], 27: [278, 22], 28: [288, 50], 29: [288, 76], 30: [278, 100], 31: [296, 122], 32: [324, 110], 33: [350, 110], 34: [376, 122], 35: [388, 150], 36: [388, 175], 37: [388, 200], 38: [388, 225], 39: [388, 250], 40: [376, 275], 41: [350, 288], 42: [325, 288], 43: [296, 275], 44: [278, 296], 45: [288, 325], 46: [288, 350], 47: [278, 377], 48: [250, 388], 49: [225, 388], 50: [200, 388], 51: [200, 350], 52: [200, 325], 53: [200, 300], 54: [200, 275], 55: [200, 250], 56: [200, 225], 0: [102, 400], 90: [5, 325], 91: [5, 370], 92: [50, 325], 93: [50, 370] },
    red: { 1: [376, 275], 2: [350, 288], 3: [325, 288], 4: [296, 275], 5: [278, 296], 6: [288, 325], 7: [288, 350], 8: [278, 377], 9: [250, 388], 10: [225, 388], 11: [200, 388], 12: [175, 388], 13: [150, 388], 14: [122, 377], 15: [112, 350], 16: [112, 325], 17: [122, 296], 18: [104, 275], 19: [75, 288], 20: [50, 288], 21: [22, 275], 22: [14, 250], 23: [14, 225], 24: [14, 200], 25: [14, 175], 26: [14, 150], 27: [22, 122], 28: [50, 110], 29: [75, 110], 30: [104, 122], 31: [120, 100], 32: [112, 76], 33: [112, 50], 34: [122, 20], 35: [150, 14], 36: [175, 14], 37: [200, 14], 38: [225, 14], 39: [250, 14], 40: [278, 22], 41: [288, 50], 42: [288, 76], 43: [278, 100], 44: [296, 122], 45: [324, 110], 46: [350, 110], 47: [376, 122], 48: [388, 150], 49: [388, 175], 50: [388, 200], 51: [350, 200], 52: [325, 200], 53: [300, 200], 54: [275, 200], 55: [250, 200], 56: [225, 200], 0: [400, 300], 90: [330, 330], 91: [330, 375], 92: [375, 330], 93: [375, 375] }
  };

  if (!BOARD_COORDS[color]) {
    console.error(`ERROR: Invalid color '${color}' in getCoords`);
    return null;
  }

  const coords = BOARD_COORDS[color][stepIndex];
  if (!coords) {
    console.warn(`WARNING: Invalid stepIndex '${stepIndex}' for color '${color}'`);
    return null;
  }

  return { x: coords[0], y: coords[1] };
}

// ==================== WebSocket Events ====================

socket.on('player_joined', ({ player, players }) => {
  showToast(`${player.name} joined the game!`, 'success');
  if (players) {
    currentGame.players = players;
    updatePlayersList(players);
  }
});

socket.on('player_left', ({ playerId, message }) => {
  showToast(message, 'info');
});

socket.on('player_ready', ({ playerId, isReady }) => {
  const player = currentGame.players.find(p => p.playerId === playerId);
  if (player) {
    player.isReady = isReady;
    updatePlayersList(currentGame.players);
  }
});

socket.on('game_started', ({ gameId, startPlayer, game }) => {
  console.log('Game starting...', { gameId, startPlayer, game });

  if (game) {
    currentGame.status = game.status;
    currentGame.currentTurn = game.currentTurn;
    currentGame.players = game.players;
  } else {
    currentGame.status = 'playing';
    currentGame.currentTurn = startPlayer;
  }

  showScreen('game');

  // Ensure we have the game board element
  createGameBoard();
  renderPieces(currentGame.players);
  updatePlayersPanel(currentGame.players);

  addLogEntry('游戏开始！', true);

  const currentPlayer = currentGame.players.find(p => p.playerId === currentGame.currentTurn);
  if (currentPlayer) {
    if (currentPlayer.playerId === currentGame.playerId) {
      addLogEntry('请掷色子并走棋', true);
    } else {
      addLogEntry(`等待${getColorName(currentPlayer.color)}玩家走棋`);
    }
  }
});

socket.on('dice_rolled', ({ playerId, value, canRollAgain, noMoves }) => {
  const diceValue = value;

  currentGame.diceValue = diceValue;
  elements.displays.diceResult.value = diceValue;

  const player = currentGame.players.find(p => p.playerId === playerId);
  if (player) {
    addLogEntry(`${player.name} 掷出 ${diceValue}`);
  }

  if (noMoves) {
    addLogEntry('无棋可走', true);
    // Disable roll dice button for current player - turn will change automatically
    if (playerId === currentGame.playerId) {
      elements.buttons.rollDice.disabled = true;
    }
    return;
  }

  if (canRollAgain && playerId === currentGame.playerId) {
    addLogEntry('您掷出 6，请再掷一次', true);
  }

  if (playerId === currentGame.playerId) {
    elements.buttons.rollDice.disabled = !canRollAgain;
  }
});

socket.on('piece_moved', async ({ playerId, pieceId, moveSequence }) => {
  const player = currentGame.players.find(p => p.playerId === playerId);
  if (!player) return;

  addLogEntry(`${player.name} moved piece ${pieceId + 1}`);

  const pieceEl = document.getElementById(`piece-${player.color}-${pieceId}`);
  if (!pieceEl) {
    // If piece doesn't exist yet (e.g., just launched or state mismatch), full refresh
    socket.emit('get_game_state', { gameId: currentGame.gameId });
    return;
  }

  // Sequential animation for moveSequence (includes jumps and flies)
  for (const stepIndex of moveSequence) {
    const coords = getCoords(player.color, stepIndex);
    if (coords) {
      if (stepIndex >= 90 && stepIndex <= 93) {
        pieceEl.classList.add('in-base');
      } else {
        pieceEl.classList.remove('in-base');
      }

      const rect = pieceEl.getBoundingClientRect();
      const parentRect = elements.displays.gameBoard.getBoundingClientRect();
      const currentX = rect.left - parentRect.left;
      const currentY = rect.top - parentRect.top;

      const rotation = calculateRotation(currentX, currentY, coords.x, coords.y);
      if (rotation !== null) {
        pieceEl.style.transform = `rotate(${rotation}deg)`;
      }

      pieceEl.style.left = `${coords.x}px`;
      pieceEl.style.top = `${coords.y}px`;

      // Wait a bit for animation effect
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Final check after animation
  socket.emit('get_game_state', { gameId: currentGame.gameId });
});

socket.on('game_state_update', ({ game }) => {
  if (game) {
    currentGame.status = game.status;
    currentGame.currentTurn = game.currentTurn;
    currentGame.players = game.players;
    renderPieces(game.players);
    updatePlayersPanel(game.players);
  }
});

socket.on('turn_changed', ({ currentPlayerId, playerName }) => {
  currentGame.currentTurn = currentPlayerId;
  currentGame.diceValue = null;
  elements.displays.diceResult.value = '';

  if (currentPlayerId === currentGame.playerId) {
    elements.buttons.rollDice.disabled = false;
    addLogEntry('请掷色子并走棋', true);
  } else {
    elements.buttons.rollDice.disabled = true;
    const currentPlayer = currentGame.players.find(p => p.playerId === currentPlayerId);
    if (currentPlayer) {
      addLogEntry(`等待${getColorName(currentPlayer.color)}玩家走棋`);
    }
  }

  updatePlayersPanel(currentGame.players);
});

socket.on('game_over', ({ winner, message }) => {
  currentGame.status = 'finished';
  showScreen('gameOver');
  elements.displays.winnerMessage.textContent = `${winner.name} Wins!`;
  elements.displays.gameOverStats.innerHTML = `
    <p>Winner: ${winner.name}</p>
    <p>Color: ${winner.color}</p>
  `;
  showToast(message, 'success');
  addLogEntry(`Game Over! ${winner.name} wins!`, true);
});

socket.on('roll_again', ({ playerId, message }) => {
  showToast(message, 'info');
  addLogEntry(message, true);

  if (playerId === currentGame.playerId) {
    elements.buttons.rollDice.disabled = false;
  }
});

socket.on('error', ({ message, code }) => {
  showToast(message, 'error');
  console.error('Socket error:', code, message);
});

// ==================== Utility Functions ====================

function getColorHex(color) {
  const colors = {
    red: '#e74c3c',
    green: '#2ecc71',
    blue: '#3498db',
    yellow: '#f1c40f'
  };
  return colors[color] || '#7f8c8d';
}

function getColorName(color) {
  const names = {
    red: '红色',
    green: '绿色',
    blue: '蓝色',
    yellow: '黄色'
  };
  return names[color] || color;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  elements.displays.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function addLogEntry(message, important = false) {
  const log = elements.displays.gameLog;
  if (!log) return;

  const timestamp = new Date().toLocaleTimeString();
  log.value += `${message}\n`;
  log.scrollTop = log.scrollHeight;
}

// ==================== Start Game ====================

document.addEventListener('DOMContentLoaded', init);
