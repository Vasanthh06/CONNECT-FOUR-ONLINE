export const ROWS = 6;
export const COLS = 7;
export const EMPTY = null;

export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

export function dropDisc(board, column, player) {
  if (!Array.isArray(board) || board.length !== ROWS || !Number.isInteger(column) || column < 0 || column >= COLS) {
    return { ok: false, error: 'Choose a valid column.' };
  }
  if (player !== 'red' && player !== 'yellow') return { ok: false, error: 'Invalid player.' };
  if (board[0][column] !== EMPTY) return { ok: false, error: 'That column is full.' };

  const nextBoard = board.map((row) => [...row]);
  let row = ROWS - 1;
  while (row >= 0 && nextBoard[row][column] !== EMPTY) row -= 1;
  nextBoard[row][column] = player;
  return { ok: true, board: nextBoard, row, column };
}

export function getWinningCells(board, row, column) {
  if (!board?.[row]?.[column]) return [];
  const player = board[row][column];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const cells = [[row, column]];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = column + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        cells.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return [];
}

export function isBoardFull(board) {
  return board.every((row) => row.every((cell) => cell !== EMPTY));
}

export function getGameResult(board, row, column) {
  const winningCells = getWinningCells(board, row, column);
  if (winningCells.length) return { status: 'won', winner: board[row][column], winningCells };
  if (isBoardFull(board)) return { status: 'draw', winner: null, winningCells: [] };
  return { status: 'playing', winner: null, winningCells: [] };
}
