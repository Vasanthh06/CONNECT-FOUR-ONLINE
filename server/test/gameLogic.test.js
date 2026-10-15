import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, createBoard, dropDisc, getGameResult, getWinningCells, isBoardFull } from '../src/gameLogic.js';

test('creates an empty 6 by 7 board', () => {
  const board = createBoard();
  assert.equal(board.length, ROWS);
  assert.equal(board.every((row) => row.length === COLS && row.every((cell) => cell === null)), true);
});

test('drops discs to the lowest open cell and does not mutate the original board', () => {
  const board = createBoard();
  const first = dropDisc(board, 3, 'red');
  const second = dropDisc(first.board, 3, 'yellow');
  assert.equal(first.board[5][3], 'red');
  assert.equal(second.board[4][3], 'yellow');
  assert.equal(board[5][3], null);
});

test('rejects invalid columns and full columns', () => {
  const board = createBoard();
  assert.equal(dropDisc(board, -1, 'red').ok, false);
  assert.equal(dropDisc(board, 7, 'red').ok, false);
  assert.equal(dropDisc(board, 1.5, 'red').ok, false);
  let full = board;
  for (let i = 0; i < ROWS; i++) full = dropDisc(full, 0, i % 2 ? 'yellow' : 'red').board;
  assert.equal(dropDisc(full, 0, 'red').error, 'That column is full.');
});

test('detects horizontal, vertical, and both diagonal wins', () => {
  const horizontal = createBoard(); horizontal[5] = ['red', 'red', 'red', 'red', null, null, null];
  assert.equal(getWinningCells(horizontal, 5, 2).length >= 4, true);
  const vertical = createBoard(); for (let r = 2; r < 6; r++) vertical[r][4] = 'yellow';
  assert.equal(getWinningCells(vertical, 4, 4).length >= 4, true);
  const diagonalDown = createBoard();
  [[0,0],[1,1],[2,2],[3,3]].forEach(([r,c]) => diagonalDown[r][c] = 'red');
  assert.equal(getWinningCells(diagonalDown, 2, 2).length >= 4, true);
  const diagonalUp = createBoard();
  [[3,0],[2,1],[1,2],[0,3]].forEach(([r,c]) => diagonalUp[r][c] = 'yellow');
  assert.equal(getWinningCells(diagonalUp, 2, 1).length >= 4, true);
});

test('reports win and draw correctly', () => {
  const win = createBoard(); win[5] = ['red', 'red', 'red', 'red', 'yellow', 'yellow', null];
  assert.equal(getGameResult(win, 5, 3).status, 'won');
  const pattern = [[1,0,0,0,1,1,1],[0,1,1,0,0,0,1],[0,1,1,1,0,1,0],[1,0,0,0,1,1,1],[1,0,1,0,1,0,0],[0,1,1,0,1,0,1]];
  const full = pattern.map((row) => row.map((value) => value ? 'red' : 'yellow'));
  assert.equal(isBoardFull(full), true);
  assert.equal(getGameResult(full, 5, 6).status, 'draw');
});
