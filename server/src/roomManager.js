import { randomBytes, randomUUID } from 'node:crypto';
import { createBoard } from './gameLogic.js';

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from(randomBytes(6), (byte) => ROOM_CODE_CHARS[byte % ROOM_CODE_CHARS.length]).join('');
const cleanName = (name) => String(name ?? '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 18) || 'Player';

export class RoomManager {
  constructor({ graceMs = 60_000, cleanupMs = 30 * 60_000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    this.rooms = new Map();
    this.graceMs = graceMs;
    this.cleanupMs = cleanupMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
  }

  create(name, socketId) {
    let code;
    do { code = makeCode(); } while (this.rooms.has(code));
    const token = randomUUID();
    const room = {
      code, board: createBoard(), status: 'waiting', currentTurn: 'red', winner: null,
      winningCells: [], players: {
        red: { token, socketId, name: cleanName(name), connected: true, disconnectTimer: null },
        yellow: null
      }, createdAt: Date.now(), cleanupTimer: null
    };
    this.rooms.set(code, room);
    return { room, player: 'red', token };
  }

  join(codeInput, name, socketId) {
    const code = String(codeInput ?? '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: 'Room not found. Check the code and try again.' };
    if (room.status !== 'waiting' || room.players.yellow) return { error: 'This room already has two players.' };
    const token = randomUUID();
    room.players.yellow = { token, socketId, name: cleanName(name), connected: true, disconnectTimer: null };
    room.status = 'playing';
    if (room.cleanupTimer) this.clearTimer(room.cleanupTimer);
    room.cleanupTimer = null;
    return { room, player: 'yellow', token };
  }

  get(code) { return this.rooms.get(String(code ?? '').toUpperCase()); }

  findPlayer(room, token) {
    if (!room || !token) return null;
    for (const color of ['red', 'yellow']) {
      if (room.players[color]?.token === token) return { color, player: room.players[color] };
    }
    return null;
  }

  rejoin(code, token, socketId) {
    const room = this.get(code);
    const found = this.findPlayer(room, token);
    if (!found) return { error: 'This game session has expired. Create or join a room again.' };
    const { color, player } = found;
    if (player.disconnectTimer) this.clearTimer(player.disconnectTimer);
    player.disconnectTimer = null;
    player.socketId = socketId;
    player.connected = true;
    return { room, player: color, token };
  }

  disconnect(socketId, onExpired) {
    for (const room of this.rooms.values()) {
      const found = ['red', 'yellow'].map((color) => ({ color, player: room.players[color] }))
        .find(({ player }) => player?.socketId === socketId);
      if (!found) continue;
      const { color, player } = found;
      player.connected = false;
      player.disconnectTimer = this.setTimer(() => {
        const current = this.rooms.get(room.code);
        if (!current || current.players[color]?.token !== player.token || player.connected) return;
        if (current.status === 'playing') {
          current.status = 'won';
          current.winner = color === 'red' ? 'yellow' : 'red';
          current.winningCells = [];
          onExpired(current, color);
          this.scheduleCleanup(current);
        } else if (current.status === 'waiting') {
          onExpired(current, color);
          this.removeRoom(current.code);
        }
      }, this.graceMs);
      player.disconnectTimer.unref?.();
      return { room, player: color };
    }
    return null;
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const color of ['red', 'yellow']) {
      const player = room.players[color];
      if (player?.disconnectTimer) this.clearTimer(player.disconnectTimer);
    }
    if (room.cleanupTimer) this.clearTimer(room.cleanupTimer);
    this.rooms.delete(code);
  }

  scheduleCleanup(room) {
    if (room.cleanupTimer) this.clearTimer(room.cleanupTimer);
    room.cleanupTimer = this.setTimer(() => this.removeRoom(room.code), this.cleanupMs);
    room.cleanupTimer.unref?.();
  }
}
