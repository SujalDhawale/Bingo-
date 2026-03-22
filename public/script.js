// Firebase Setup (Destructured from window.firebase set in index.html)
const { initializeApp, getDatabase, ref, set, onValue, push, serverTimestamp, onDisconnect } = window.firebase;

// --- CONFIGURATION ---
// IMPORTANT: Replace this with your own Firebase Config from the Firebase Console!
const firebaseConfig = {
  databaseURL: "https://bingo-multiplayer-demo-default-rtdb.firebaseio.com/" // Placeholder - user should replace this
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
let roomRef = null;

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
    
    // Update Firebase with the selected number
    const newSelected = [...selectedNumbers, num];
    const nextTurn = (myPlayerKey === 'p1') ? 'p2' : 'p1';
    
    set(ref(db, `rooms/${myRoomId}/gameData`), {
        selectedNumbers: newSelected,
        turn: nextTurn,
        playersCount: 2 // Keep it at 2
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
            set(ref(db, `rooms/${myRoomId}/winner`), myPlayerKey);
        }
    }
}

function updateBingoUI() {
    bingoWords.forEach((span, i) => {
        if (i < linesCompleted) span.classList.add('active');
        else span.classList.remove('active');
    });
}

// Firebase Logic
async function joinGame(roomId) {
    myRoomId = roomId;
    roomRef = ref(db, `rooms/${roomId}`);
    
    // 1. Try to claim a player slot
    onValue(ref(db, `rooms/${roomId}/gameData`), (snapshot) => {
        const data = snapshot.val();
        
        if (!myPlayerKey) {
            // New user joining
            if (!data) {
                // First player
                myPlayerKey = 'p1';
                set(ref(db, `rooms/${roomId}/gameData`), {
                    playersCount: 1,
                    turn: 'p1',
                    selectedNumbers: []
                });
                boardNumbers = generateBoardArray();
                localStorage.setItem(`bingo_board_${roomId}`, JSON.stringify(boardNumbers));
            } else if (data.playersCount === 1) {
                // Second player
                myPlayerKey = 'p2';
                set(ref(db, `rooms/${roomId}/gameData`), {
                    ...data,
                    playersCount: 2
                });
                boardNumbers = generateBoardArray();
                localStorage.setItem(`bingo_board_${roomId}`, JSON.stringify(boardNumbers));
            } else {
                // Already full or reconnecting
                const savedBoard = localStorage.getItem(`bingo_board_${roomId}`);
                if (savedBoard) {
                    boardNumbers = JSON.parse(savedBoard);
                    // Decide role based on simple logic or prompt (simplified for demo)
                    myPlayerKey = 'p1'; // Fallback
                } else {
                    alert("Room is full!");
                    window.location.href = "/";
                    return;
                }
            }
        }

        // Update Game State from Firebase
        if (data) {
            selectedNumbers = data.selectedNumbers || [];
            
            if (data.playersCount < 2) {
                lobbyScreen.classList.remove('hidden');
                gameScreen.classList.add('hidden');
                statusText.innerText = "Waiting for Player 2...";
            } else {
                startScreen.classList.add('hidden');
                lobbyScreen.classList.add('hidden');
                gameScreen.classList.remove('hidden');
                
                myTurn = (data.turn === myPlayerKey);
                updateUI(data.turn);
                renderBoard();
                checkBingo();
            }
        }
    }, { onlyOnce: false });

    // 2. Chat Logic
    onValue(ref(db, `rooms/${roomId}/messages`), (snapshot) => {
        const messages = snapshot.val();
        chatMessages.innerHTML = '';
        if (messages) {
            Object.values(messages).forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.classList.add('message');
                msgDiv.classList.add(msg.sender === myPlayerKey ? 'sent' : 'received');
                msgDiv.innerText = msg.text;
                chatMessages.appendChild(msgDiv);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });

    // 3. Winner Logic
    onValue(ref(db, `rooms/${roomId}/winner`), (snapshot) => {
        const winner = snapshot.val();
        if (winner) {
            gameOverModal.classList.remove('hidden');
            winnerText.innerText = (winner === myPlayerKey) ? "YOU WIN! BINGO!" : "YOU LOSE!";
        }
    });

    const cleanUrl = window.location.origin + window.location.pathname + '?room=' + roomId;
    linkInput.value = cleanUrl;
}

function updateUI(currentTurn) {
    if (myTurn) {
        turnIndicator.innerText = "YOUR TURN";
        turnIndicator.classList.add('active-turn');
        statusText.innerText = "Select a number!";
        badgeP1.classList.toggle('active', myPlayerKey === 'p1');
        badgeP2.classList.toggle('active', myPlayerKey === 'p2');
    } else {
        turnIndicator.innerText = "OPPONENT'S TURN";
        turnIndicator.classList.remove('active-turn');
        statusText.innerText = "Waiting...";
        badgeP1.classList.toggle('active', myPlayerKey !== 'p1');
        badgeP2.classList.toggle('active', myPlayerKey !== 'p2');
    }
}

// Chat Listeners
sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !myRoomId) return;
    
    push(ref(db, `rooms/${myRoomId}/messages`), {
        text: text,
        sender: myPlayerKey,
        timestamp: serverTimestamp()
    });
    chatInput.value = '';
}

// Actions
createBtn.addEventListener('click', () => {
    const newRoomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    window.history.pushState({}, '', `?room=${newRoomId}`);
    joinGame(newRoomId);
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
