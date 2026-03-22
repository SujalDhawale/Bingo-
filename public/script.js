// Initialize Gun with public relay peers
const gun = Gun([
    'https://gun-manhattan.herokuapp.com/gun',
    'https://relay.peer.ooo/gun',
    'https://gun-server.herokuapp.com/gun'
]);

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

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// Game State Local
let myRoomId = null;
let boardNumbers = []; 
let selectedNumbers = [];
let myTurn = false;
let myPlayerKey = null; // 'p1' or 'p2'
let linesCompleted = 0;
let roomData = null;

// Init
function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl) {
        joinGame(roomFromUrl);
    } else {
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
        
        if (selectedNumbers.includes(num)) {
            cell.classList.add('marked');
        }

        cell.addEventListener('click', () => handleCellClick(num));
        bingoBoard.appendChild(cell);
    });
}

function handleCellClick(num) {
    if (!myTurn || selectedNumbers.includes(num)) return;
    
    // Update Gun with the selected number
    const nextTurn = (myPlayerKey === 'p1') ? 'p2' : 'p1';
    
    // Add number to the list (using an object as a set in Gun)
    gun.get('bingo-rooms').get(myRoomId).get('selected').get(num.toString()).put(true);
    // Switch turn
    gun.get('bingo-rooms').get(myRoomId).get('state').put({
        turn: nextTurn
    });
}

// Check Bingo
function checkBingo() {
    const winLines = [
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
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
            gun.get('bingo-rooms').get(myRoomId).get('state').put({ winner: myPlayerKey });
        }
    }
}

function updateBingoUI() {
    bingoWords.forEach((span, i) => {
        if (i < linesCompleted) span.classList.add('active');
        else span.classList.remove('active');
    });
}

// Networking Logic
function joinGame(roomId) {
    myRoomId = roomId;
    const room = gun.get('bingo-rooms').get(roomId);
    
    statusText.innerText = "Syncing with peers...";

    // Handle Player Assignment
    // We use a simple logic: p1 is the host (first to join), p2 is the second.
    // We store this in localStorage so if someone refreshes they keep their slot.
    let savedKey = localStorage.getItem(`bingo_role_${roomId}`);
    if (savedKey) {
        myPlayerKey = savedKey;
    }

    room.get('players').once((players) => {
        if (!myPlayerKey) {
            if (!players || !players.p1) {
                myPlayerKey = 'p1';
                room.get('players').get('p1').put(true);
            } else if (!players.p2) {
                myPlayerKey = 'p2';
                room.get('players').get('p2').put(true);
            } else {
                myPlayerKey = 'spectator';
            }
            localStorage.setItem(`bingo_role_${roomId}`, myPlayerKey);
        }
        
        // Load or Create Board
        let savedBoard = localStorage.getItem(`bingo_board_${roomId}`);
        if (savedBoard) {
            boardNumbers = JSON.parse(savedBoard);
        } else {
            boardNumbers = generateBoardArray();
            localStorage.setItem(`bingo_board_${roomId}`, JSON.stringify(boardNumbers));
        }
        
        startScreen.classList.add('hidden');
        renderBoard();
        setupSubscriptions(room);
    });

    const cleanUrl = window.location.origin + window.location.pathname + '?room=' + roomId;
    linkInput.value = cleanUrl;
}

function setupSubscriptions(room) {
    // 1. Sync Game State (Turn, Winner, PlayersCount)
    room.get('state').on((state) => {
        if (!state) {
            // Initialize state if first time
            room.get('state').put({ turn: 'p1', playersCount: 1 });
            return;
        }

        // Handle Player Visibility
        room.get('players').on((players) => {
            const count = (players.p1 ? 1 : 0) + (players.p2 ? 1 : 0);
            if (count < 2) {
                lobbyScreen.classList.remove('hidden');
                gameScreen.classList.add('hidden');
                statusText.innerText = "Waiting for Friend...";
            } else {
                lobbyScreen.classList.add('hidden');
                gameScreen.classList.remove('hidden');
            }
        });

        myTurn = (state.turn === myPlayerKey);
        updateUI(state.turn);
        
        if (state.winner) {
            gameOverModal.classList.remove('hidden');
            winnerText.innerText = (state.winner === myPlayerKey) ? "YOU WIN! BINGO!" : "YOU LOSE!";
        }
    });

    // 2. Sync Selected Numbers
    room.get('selected').map().on((val, num) => {
        const n = parseInt(num);
        if (val && !selectedNumbers.includes(n)) {
            selectedNumbers.push(n);
            renderBoard();
            checkBingo();
        }
    });

    // 3. Chat Logic
    room.get('chat').map().on((msg, id) => {
        if (!msg) return;
        // Check if message already exists
        if (document.getElementById(`msg-${id}`)) return;

        const msgDiv = document.createElement('div');
        msgDiv.id = `msg-${id}`;
        msgDiv.classList.add('message');
        msgDiv.classList.add(msg.sender === myPlayerKey ? 'sent' : 'received');
        msgDiv.innerText = msg.text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function updateUI(currentTurn) {
    if (myTurn) {
        turnIndicator.innerText = "YOUR TURN";
        turnIndicator.classList.add('active-turn');
        statusText.innerText = "Select a number!";
    } else {
        turnIndicator.innerText = "OPPONENT'S TURN";
        turnIndicator.classList.remove('active-turn');
        statusText.innerText = "Waiting for friend...";
    }
    
    badgeP1.classList.toggle('active', currentTurn === 'p1');
    badgeP2.classList.toggle('active', currentTurn === 'p2');
}

// Chat Listeners
sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !myRoomId) return;
    
    const msgId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    gun.get('bingo-rooms').get(myRoomId).get('chat').get(msgId).put({
        text: text,
        sender: myPlayerKey,
        time: Date.now()
    });
    chatInput.value = '';
}

// Actions
createBtn.addEventListener('click', () => {
    const newRoomId = 'BINGO-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    window.location.href = `?room=${newRoomId}`; // Reload to ensure Gun initializes fresh for new room
});

copyBtn.addEventListener('click', () => {
    linkInput.select();
    document.execCommand('copy');
    copyBtn.innerText = 'Copied!';
    setTimeout(() => copyBtn.innerText = 'Copy', 2000);
});

playAgainBtn.addEventListener('click', () => {
    window.location.href = window.location.origin + window.location.pathname;
});

init();
