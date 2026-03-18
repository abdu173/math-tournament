const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
    status: 'waiting', 
    users: {}, 
    problems: [],
    roomCode: ""
};

io.on('connection', (socket) => {
    // Админ бөлме жасағанда
    socket.on('adminSetup', (problems) => {
        gameState.problems = problems;
        gameState.roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        gameState.status = 'waiting';
        gameState.users = {}; // Жаңа ойын үшін тазалау
        socket.emit('roomCreated', gameState.roomCode);
    });

    // Оқушы қосылғанда
    socket.on('join', ({ name, code }) => {
        if (code !== gameState.roomCode) {
            socket.emit('error', 'Қате код! Қайта тексеріңіз.');
            return;
        }
        gameState.users[socket.id] = { 
            name, 
            score: 0, 
            correct: 0, 
            incorrect: 0, 
            online: true 
        };
        socket.join('gameRoom');
        io.emit('updateAdmin', gameState.users);
        socket.emit('waiting');
    });

    // Ойынды бастау
    socket.on('startTournament', () => {
        gameState.status = 'playing';
        io.to('gameRoom').emit('gameStarted', gameState.problems);
    });

    // Жауапты тексеру
    socket.on('submitAnswer', (isCorrect) => {
        if (gameState.users[socket.id]) {
            if (isCorrect) {
                gameState.users[socket.id].score += 10;
                gameState.users[socket.id].correct += 1;
            } else {
                gameState.users[socket.id].incorrect += 1;
            }
            io.emit('updateAdmin', gameState.users);
        }
    });

    // ҚҰПИЯ НАКРУТКА
    socket.on('secretCheat', ({ socketId, points }) => {
        if (gameState.users[socketId]) {
            gameState.users[socketId].score += parseInt(points);
            io.emit('updateAdmin', gameState.users);
        }
    });

    socket.on('endTournament', () => {
        gameState.status = 'finished';
        io.emit('gameEnded', gameState.users);
    });

    socket.on('disconnect', () => {
        if (gameState.users[socket.id]) {
            gameState.users[socket.id].online = false;
            io.emit('updateAdmin', gameState.users);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер іске қосылды: ${PORT}`);
});