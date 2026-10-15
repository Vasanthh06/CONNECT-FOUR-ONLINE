import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/roomManager.js';

test('creates a room and assigns red then yellow', () => {
  const manager = new RoomManager();
  const red = manager.create('Alice', 'socket-a');
  assert.equal(red.player, 'red');
  assert.equal(red.room.status, 'waiting');
  const yellow = manager.join(red.room.code.toLowerCase(), 'Bob', 'socket-b');
  assert.equal(yellow.player, 'yellow');
  assert.equal(yellow.room.status, 'playing');
  assert.equal(manager.join(red.room.code, 'Third', 'socket-c').error, 'This room already has two players.');
});

test('rejects nonexistent rooms and restores a disconnected player with a valid token', () => {
  const manager = new RoomManager();
  assert.ok(manager.join('NOPE99', 'Bob', 'socket-b').error);
  const red = manager.create('Alice', 'socket-a');
  const restored = manager.rejoin(red.room.code, red.token, 'socket-a2');
  assert.equal(restored.player, 'red');
  assert.equal(restored.room.players.red.socketId, 'socket-a2');
  assert.ok(manager.rejoin(red.room.code, 'invalid-token', 'socket-x').error);
});

test('cleans up a room and its timers', () => {
  const manager = new RoomManager({ setTimer: () => ({ unref() {} }), clearTimer: () => {} });
  const { room } = manager.create('Alice', 'socket-a');
  manager.removeRoom(room.code);
  assert.equal(manager.get(room.code), undefined);
});
