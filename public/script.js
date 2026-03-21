const socket = io();

// DOM Elements
const startScreen = document.getElementById('start-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverModal = document.getElementById('game-over-modal');

const createBtn = document.getElementById('create-game-btn');
const copyBtn = document.getElementById('copy-btn');
const linkInput = document.getElementById('share-link-input');

const bingoBoard = document.getElementById('bingo-board');
const turnIndicator = document.getElementById('turn-indicator');
const statusText = document.getElementById('game-status-text');
const bingoWords = document.getElementById('bingo-words').querySelectorAll('span');
const winnerText = document.getElementById('winner-text');
const playAgainBtn = document.getElementById('play-again-btn');

const badgeP1 = document.getElementById('badge-p1');
const badgeP2 = document.getElementById('badge-p2');

// Game State Local
let myRoomId = null;
let boardNumbers = []; // The localized randomized 1-25 array
let selectedNumbers = [];
let myTurn = false;
let myId = null;
let linesCompleted = 0;

// Init
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl) {
        // Joining existing game
        joinGame(roomFromUrl);
    } else {
        // Normal start screen
        startScreen.classList.remove('hidden');
    }
}

// Generate Random Board
function generateBoardArray() {
    let nums = Array.from({length: 25}, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    return nums;
}

function renderBoard() {
    bingoBoard.innerHTML = '';
    boardNumbers.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.innerText = num;
        cell.dataset.num = num;
        cell.dataset.index = index;
        
        if (selectedNumbers.includes(num)) {
            cell.classList.add('marked');
        }

        cell.addEventListener('click', () => handleCellClick(num));
        bingoBoard.appendChild(cell);
    });
}

function handleCellClick(num) {
    if (!myTurn || selectedNumbers.includes(num)) return;
    
    // Attempt move
    socket.emit('select_number', { roomId: myRoomId, number: num });
}

// Check Bingo
function checkBingo() {
    // 5x5 grid winning lines
    const winLines = [
        // Rows
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
        // Cols
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
        // Diagonals
        [0,6,12,18,24], [4,8,12,16,20]
    ];

    let currentLines = 0;

    for (let line of winLines) {
        let isComplete = true;
        for (let idx of line) {
            if (!selectedNumbers.includes(boardNumbers[idx])) {
                isComplete = false;
                break;
            }
        }
        if (isComplete) currentLines++;
    }

    if (currentLines !== linesCompleted) {
        linesCompleted = currentLines;
        updateBingoUI();

        if (linesCompleted >= 5) {
            socket.emit('declare_winner', myRoomId);
        }
    }
}

function updateBingoUI() {
    for (let i = 0; i < bingoWords.length; i++) {
        if (i < linesCompleted) {
            bingoWords[i].classList.add('active');
        } else {
            bingoWords[i].classList.remove('active');
        }
    }
}

// Networking
function joinGame(roomId) {
    myRoomId = roomId;
    boardNumbers = generateBoardArray();
    renderBoard();
    
    socket.emit('join_room', roomId);
    startScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');

    const cleanUrl = window.location.origin + window.location.pathname + '?room=' + roomId;
    linkInput.value = cleanUrl;
}

createBtn.addEventListener('click', () => {
    // Generate random 5-char room id
    const newRoomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newUrl = window.location.origin + window.location.pathname + '?room=' + newRoomId;
    window.history.pushState({}, '', newUrl); // update URL without reload
    
    joinGame(newRoomId);
});

copyBtn.addEventListener('click', () => {
    linkInput.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => copyBtn.innerText = 'Copy', 2000);
});

playAgainBtn.addEventListener('click', () => {
    window.location.href = window.location.origin + window.location.pathname; // Reload without query
});

// Socket Events
socket.on('connect', () => {
    myId = socket.id;
    console.log("Connected as", myId);
});

socket.on('room_full', () => {
    alert("This game room is already full.");
    window.location.href = window.location.origin + window.location.pathname;
});

socket.on('update_game_state', (state) => {
    console.log("State:", state);
    selectedNumbers = state.selectedNumbers;
    
    // Wait for 2 players
    if (state.playersCount < 2) {
        lobbyScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        return;
    }

    // Both players joined
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    // Update Turn
    myTurn = (state.turn === myId);
    
    if (myTurn) {
        turnIndicator.innerText = "YOUR TURN";
        turnIndicator.classList.add('active-turn');
        statusText.innerText = "Select a number from the board";
        badgeP1.classList.add('active');
        badgeP2.classList.remove('active');
    } else {
        turnIndicator.innerText = "OPPONENT'S TURN";
        turnIndicator.classList.remove('active-turn');
        statusText.innerText = "Waiting for opponent...";
        badgeP1.classList.remove('active');
        badgeP2.classList.add('active');
    }

    renderBoard(); // Visual update
    checkBingo();  // Check local grid for bingo logic
});

socket.on('player_disconnected', () => {
    alert("Opponent disconnected. Game gracefully ended.");
    window.location.href = window.location.origin + window.location.pathname;
});

socket.on('game_over', ({ winner }) => {
    gameOverModal.classList.remove('hidden');
    if (winner === myId) {
        winnerText.innerText = "YOU WIN! BINGO!";
    } else {
        winnerText.innerText = "YOU LOSE!";
        winnerText.style.background = "linear-gradient(135deg, #ff0055, #ffaa00)";
        winnerText.style.webkitBackgroundClip = "text";
        winnerText.style.webkitTextFillColor = "transparent";
    }
});

init();
