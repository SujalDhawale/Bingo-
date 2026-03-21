const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Game State
const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                turn: null,
                selectedNumbers: [],
                gameStarted: false,
                winner: null
            };
        }

        const room = rooms[roomId];

        if (room.players.length >= 2 && !room.players.includes(socket.id)) {
            socket.emit('room_full');
            return;
        }

        if (!room.players.includes(socket.id)) {
            room.players.push(socket.id);
        }

        // Set who goes first (the host / first player to join)
        if (room.players.length === 1) {
            room.turn = room.players[0];
        }

        // Emit updated game state to everyone in the room
        io.to(roomId).emit('update_game_state', {
            playersCount: room.players.length,
            turn: room.turn,
            selectedNumbers: room.selectedNumbers,
            winner: room.winner
        });

        console.log(`User ${socket.id} joined room ${roomId}. Players: ${room.players.length}`);
    });

    socket.on('select_number', ({ roomId, number }) => {
        const room = rooms[roomId];
        if (!room || room.winner) return;

        // Verify it's this player's turn
        if (room.turn !== socket.id) {
            return;
        }

        // Verify number hasn't been selected yet
        if (!room.selectedNumbers.includes(number)) {
            room.selectedNumbers.push(number);
            
            // Switch turns
            const currentPlayerIndex = room.players.indexOf(room.turn);
            room.turn = room.players[(currentPlayerIndex + 1) % room.players.length];

            io.to(roomId).emit('update_game_state', {
                playersCount: room.players.length,
                turn: room.turn,
                selectedNumbers: room.selectedNumbers,
                winner: room.winner
            });
        }
    });

    socket.on('declare_winner', (roomId) => {
        const room = rooms[roomId];
        if (room && !room.winner) {
            room.winner = socket.id;
            io.to(roomId).emit('game_over', { winner: room.winner });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Remove player from rooms
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.players.indexOf(socket.id);
            if (index !== -1) {
                room.players.splice(index, 1);
                io.to(roomId).emit('player_disconnected');
                
                // If everyone leaves, maybe clear the room
                if (room.players.length === 0) {
                    delete rooms[roomId];
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
