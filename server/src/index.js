import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './roomManager.js';
import { dropDisc, getGameResult } from './gameLogic.js';

const PORT = Number(process.env.PORT) || 4000;
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const app = express();
app.use(cors({ origin: configuredOrigins, methods: ['GET'] }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'connect-four-server' }));
app.get('/', (_req, res) => res.json({ name: 'Connect Four Online API', health: '/health' }));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: configuredOrigins, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});
const manager = new RoomManager({ graceMs: 60_000 });

function publicState(room) {
  return {
    code: room.code, board: room.board, status: room.status, currentTurn: room.currentTurn,
    winner: room.winner, winningCells: room.winningCells,
    players: Object.fromEntries(['red', 'yellow'].map((color) => [color, room.players[color] ? {
      name: room.players[color].name, connected: room.players[color].connected
    } : null]))
  };
}
function sendState(room) { io.to(room.code).emit('game:state', publicState(room)); }
function ackError(ack, message) { if (typeof ack === 'function') ack({ ok: false, error: message }); }
function ackSuccess(ack, data) { if (typeof ack === 'function') ack({ ok: true, ...data }); }
function attachPlayer(socket, result, ack) {
  if (result.error) return ackError(ack, result.error);
  socket.join(result.room.code);
  socket.data.roomCode = result.room.code;
  socket.data.playerToken = result.token;
  socket.data.playerColor = result.player;
  ackSuccess(ack, { code: result.room.code, player: result.player, token: result.token, state: publicState(result.room) });
  sendState(result.room);
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name } = {}, ack) => {
    const result = manager.create(name, socket.id);
    attachPlayer(socket, result, ack);
  });

  socket.on('room:join', ({ code, name } = {}, ack) => {
    const result = manager.join(code, name, socket.id);
    attachPlayer(socket, result, ack);
  });

  socket.on('room:rejoin', ({ code, token } = {}, ack) => {
    const result = manager.rejoin(code, token, socket.id);
    if (result.error) return ackError(ack, result.error);
    socket.join(result.room.code);
    socket.data.roomCode = result.room.code;
    socket.data.playerToken = result.token;
    socket.data.playerColor = result.player;
    ackSuccess(ack, { code: result.room.code, player: result.player, token: result.token, state: publicState(result.room) });
    sendState(result.room);
  });

  socket.on('game:move', ({ column } = {}, ack) => {
    const room = manager.get(socket.data.roomCode);
    if (!room) return ackError(ack, 'Room not found.');
    const found = manager.findPlayer(room, socket.data.playerToken);
    if (!found || found.player.socketId !== socket.id) return ackError(ack, 'Your player session is not active. Rejoin the room.');
    if (room.status !== 'playing') return ackError(ack, 'This game is not currently accepting moves.');
    if (!room.players.red?.connected || !room.players.yellow?.connected) return ackError(ack, 'Wait for both players to be connected.');
    if (found.color !== room.currentTurn) return ackError(ack, 'It is not your turn.');
    const placed = dropDisc(room.board, column, found.color);
    if (!placed.ok) return ackError(ack, placed.error);
    room.board = placed.board;
    const result = getGameResult(room.board, placed.row, placed.column);
    room.status = result.status;
    room.winner = result.winner;
    room.winningCells = result.winningCells;
    if (room.status === 'playing') room.currentTurn = found.color === 'red' ? 'yellow' : 'red';
    else manager.scheduleCleanup(room);
    ackSuccess(ack, { state: publicState(room) });
    sendState(room);
  });

  socket.on('game:rematch', (_payload, ack) => {
    const room = manager.get(socket.data.roomCode);
    const found = manager.findPlayer(room, socket.data.playerToken);
    if (!room || !found || found.player.socketId !== socket.id) return ackError(ack, 'Your player session is not active.');
    if (room.status !== 'won' && room.status !== 'draw') return ackError(ack, 'The current game has not finished.');
    if (!room.players.red?.connected || !room.players.yellow?.connected) return ackError(ack, 'Both players must be connected to start a rematch.');
    room.board = room.board.map((row) => row.map(() => null));
    room.status = 'playing'; room.currentTurn = 'red'; room.winner = null; room.winningCells = [];
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
    ackSuccess(ack, { state: publicState(room) });
    sendState(room);
  });

  socket.on('disconnect', () => {
    const disconnected = manager.disconnect(socket.id, (room, color) => {
      io.to(room.code).emit('game:notice', { message: `${room.players[color]?.name || 'A player'} did not reconnect in time.` });
      sendState(room);
    });
    if (disconnected) {
      io.to(disconnected.room.code).emit('game:notice', { message: `${disconnected.room.players[disconnected.player].name} disconnected. They have 60 seconds to reconnect.` });
      if (disconnected.room.status === 'won') manager.scheduleCleanup(disconnected.room);
      sendState(disconnected.room);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Connect Four server listening on port ${PORT}`));
