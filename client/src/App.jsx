import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ArrowDown, ArrowLeft, Check, CircleHelp, Copy, Crown, Gamepad2, LoaderCircle, LogIn, Plus, RotateCcw, ShieldCheck, Sparkles, Users, Wifi, WifiOff } from 'lucide-react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const STORAGE_KEY = 'fourplay-session-v1';
const emptyBoard = () => Array.from({ length: 6 }, () => Array(7).fill(null));
const readSession = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } };

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [page, setPage] = useState('home');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState(null);
  const [myColor, setMyColor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hoverColumn, setHoverColumn] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);

  useEffect(() => {
    const client = io(SERVER_URL, { autoConnect: true, reconnection: true, reconnectionAttempts: Infinity, timeout: 10000 });
    setSocket(client);
    const onConnect = () => {
      setConnected(true);
      const session = readSession();
      if (session?.code && session?.token) {
        client.emit('room:rejoin', { code: session.code, token: session.token }, (response) => {
          if (response?.ok) {
            setRoom(response.state); setMyColor(response.player); setPage('game'); setError('');
          } else if (session) {
            localStorage.removeItem(STORAGE_KEY);
            setNotice('Your previous room is no longer available. Create or join another game.');
          }
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (state) => { setRoom(state); setError(''); };
    const onNotice = (payload) => setNotice(payload?.message || 'Game status changed.');
    client.on('connect', onConnect); client.on('disconnect', onDisconnect);
    client.on('game:state', onState); client.on('game:notice', onNotice);
    return () => { client.off('connect', onConnect); client.off('disconnect', onDisconnect); client.off('game:state', onState); client.off('game:notice', onNotice); client.close(); };
  }, []);

  const runRoomAction = useCallback((event, payload) => {
    if (!socket?.connected) { setError('Connecting to the game server. Please try again in a moment.'); return; }
    setBusy(true); setError(''); setNotice('');
    socket.emit(event, payload, (response) => {
      setBusy(false);
      if (!response?.ok) { setError(response?.error || 'Something went wrong. Please try again.'); return; }
      const session = { code: response.code, token: response.token, player: response.player };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setRoom(response.state); setMyColor(response.player); setPage('game');
      setJoinCode(response.code);
    });
  }, [socket]);

  const createRoom = (event) => { event.preventDefault(); runRoomAction('room:create', { name: name.trim() || 'Player' }); };
  const joinRoom = (event) => { event.preventDefault(); runRoomAction('room:join', { code: joinCode.trim().toUpperCase(), name: name.trim() || 'Player' }); };
  const makeMove = (column) => {
    if (!room || room.status !== 'playing' || room.currentTurn !== myColor || !room.players?.red?.connected || !room.players?.yellow?.connected) return;
    setError(''); socket.emit('game:move', { column }, (response) => { if (!response?.ok) setError(response?.error || 'Move rejected.'); });
  };
  const leaveRoom = () => {
    localStorage.removeItem(STORAGE_KEY); setRoom(null); setMyColor(null); setPage('home'); setError(''); setNotice(''); setJoinCode('');
    if (socket?.connected) socket.disconnect();
    socket?.connect();
  };
  const rematch = () => {
    setRematchBusy(true); setError('');
    socket.emit('game:rematch', {}, (response) => { setRematchBusy(false); if (!response?.ok) setError(response?.error || 'Could not start rematch.'); });
  };
  const copyRoom = async () => {
    try { await navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setError(`Share this room code with your friend: ${room.code}`); }
  };

  const winnerName = room?.winner ? room.players?.[room.winner]?.name || (room.winner === myColor ? 'You' : 'Your opponent') : '';
  const isMyTurn = room?.status === 'playing' && room.currentTurn === myColor;
  const bothConnected = Boolean(room?.players?.red?.connected && room?.players?.yellow?.connected);
  const statusText = useMemo(() => {
    if (!room) return '';
    if (room.status === 'waiting') return 'Waiting for a challenger';
    if (room.status === 'won') return room.winner === myColor ? 'Victory is yours!' : `${winnerName} wins this round`;
    if (room.status === 'draw') return 'A perfect stalemate';
    if (!bothConnected) return 'Waiting for your opponent to reconnect…';
    return isMyTurn ? 'Your turn — make it count' : `${room.players?.[room.currentTurn]?.name || 'Opponent'} is thinking`;
  }, [room, myColor, winnerName, bothConnected, isMyTurn]);

  return <main className="app-shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <button className="brand" onClick={() => page === 'game' ? leaveRoom() : setPage('home')} aria-label="FourPlay home">
        <span className="brand-mark"><span/><span/><span/><span/></span>
        <span className="brand-copy">fourplay<span>ONLINE ARENA</span></span>
      </button>
      <div className="topbar-right"><span className={`connection-pill ${connected ? 'online' : ''}`}><span className="connection-dot"/>{connected ? 'Server connected' : 'Reconnecting…'}</span><button className="icon-button" onClick={() => setHelpOpen(!helpOpen)} aria-label="Game rules"><CircleHelp size={19}/></button></div>
    </header>

    {helpOpen && <section className="rules-popover"><div className="popover-head"><strong>How to play</strong><button className="icon-button" onClick={() => setHelpOpen(false)} aria-label="Close rules">×</button></div><p>Take turns dropping discs into one of seven columns. Discs fall to the lowest open spot.</p><p>Connect four of your color horizontally, vertically, or diagonally to win. If the board fills with no winner, it’s a draw.</p></section>}
    {error && <div className="toast error-toast" role="alert"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}
    {notice && <div className="toast notice-toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>×</button></div>}

    {page === 'home' || !room ? <section className="hero-layout">
      <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> THE CLASSIC, RECONNECTED</div><h1>One board.<br/><span>Two minds.</span><br/>Four in a row.</h1><p className="hero-description">Challenge a friend from anywhere. Every move matters, every connection counts.</p>
        <div className="feature-line"><span><Wifi size={16}/> Real-time play</span><span><ShieldCheck size={16}/> Fair & secure</span><span><Users size={16}/> 2 players</span></div>
        <div className="mini-board-wrap"><div className="mini-board" aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <span key={i} className={`mini-cell ${[31,32,33,34].includes(i) ? 'mini-red' : [24,25,26,18,19].includes(i) ? 'mini-yellow' : ''}`}/>)}</div><div className="mini-board-note"><span className="live-pulse"/> YOUR NEXT FRIENDLY RIVAL IS ONE CODE AWAY</div></div>
      </div>
      <div className="entry-card"><div className="card-topline"><span className="card-icon"><Gamepad2 size={22}/></span><span className="card-tag">QUICK MATCH</span></div><h2>Ready to play?</h2><p className="card-subtitle">Pick a name, then create a room or join a friend.</p>
        <label className="field-label" htmlFor="player-name">YOUR DISPLAY NAME</label><input id="player-name" className="text-input" maxLength={18} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PixelPilot" autoComplete="nickname"/>
        <button className="primary-button" onClick={createRoom} disabled={busy || !connected}><Plus size={18}/>{busy ? 'Creating room…' : 'Create a new room'}<span className="button-arrow">↗</span></button>
        <div className="separator"><span/>OR JOIN A FRIEND<span/></div>
        <form onSubmit={joinRoom} className="join-form"><input className="text-input code-input" maxLength={6} value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ENTER ROOM CODE" aria-label="Room code" required/><button className="join-button" disabled={busy || !connected || joinCode.trim().length < 4} aria-label="Join room"><LogIn size={18}/></button></form>
        <div className="card-footnote"><ShieldCheck size={14}/> No account needed. Just you and your friend.</div>
      </div>
    </section> : <section className="game-layout">
      <div className="game-heading"><button className="back-button" onClick={leaveRoom}><ArrowLeft size={17}/> Leave room</button><div className="room-chip"><span>ROOM CODE</span><strong>{room.code}</strong><button onClick={copyRoom} aria-label="Copy room code">{copied ? <Check size={16}/> : <Copy size={16}/>}</button></div></div>
      <div className="game-title-row"><div><div className="eyebrow"><span className="live-pulse"/> LIVE MATCH</div><h1>Connect <span>Four.</span></h1><p>Think ahead. Drop smart. Own the board.</p></div><div className="round-pill">ROUND <strong>01</strong></div></div>
      <div className="match-grid">
        <aside className={`player-card red-player ${room.currentTurn === 'red' && room.status === 'playing' ? 'active-player' : ''}`}><div className="player-avatar red-avatar"><span/></div><div className="player-meta"><span className="player-color-label">RED PLAYER</span><strong>{room.players?.red?.name || 'Waiting…'}{myColor === 'red' && <em>YOU</em>}</strong><span className={`player-status ${room.players?.red?.connected ? 'connected' : ''}`}><i/>{room.players?.red?.connected ? 'Connected' : 'Reconnecting'}</span></div>{room.currentTurn === 'red' && room.status === 'playing' && <span className="turn-marker"><ArrowDown size={15}/></span>}</aside>
        <div className="turn-banner"><span className={`turn-dot ${room.currentTurn === 'yellow' ? 'yellow-dot' : ''}`}/><span>{statusText}</span>{room.status === 'playing' && <span className="turn-label">{isMyTurn ? 'YOUR MOVE' : 'OPPONENT'}</span>}</div>
        <aside className={`player-card yellow-player ${room.currentTurn === 'yellow' && room.status === 'playing' ? 'active-player' : ''}`}><div className="player-avatar yellow-avatar"><span/></div><div className="player-meta"><span className="player-color-label">YELLOW PLAYER</span><strong>{room.players?.yellow?.name || 'Waiting for player'}{myColor === 'yellow' && <em>YOU</em>}</strong><span className={`player-status ${room.players?.yellow?.connected ? 'connected' : ''}`}><i/>{room.players?.yellow?.connected ? 'Connected' : 'Not connected'}</span></div>{room.currentTurn === 'yellow' && room.status === 'playing' && <span className="turn-marker"><ArrowDown size={15}/></span>}</aside>
      </div>
      {room.status === 'waiting' && <div className="waiting-callout"><LoaderCircle className="spin" size={18}/><span>Room created! Share the code <strong>{room.code}</strong> with a friend to start playing.</span><button onClick={copyRoom}>{copied ? 'Copied!' : 'Copy code'}</button></div>}
      <div className="board-frame"><div className="board-top-labels">{Array.from({ length: 7 }, (_, col) => <button key={col} disabled={!isMyTurn || !bothConnected || room.status !== 'playing' || room.board[0][col] !== null} className={`column-trigger ${hoverColumn === col ? 'column-hovered' : ''}`} onMouseEnter={() => setHoverColumn(col)} onMouseLeave={() => setHoverColumn(null)} onFocus={() => setHoverColumn(col)} onBlur={() => setHoverColumn(null)} onClick={() => makeMove(col)} aria-label={`Drop disc in column ${col + 1}`}><ArrowDown size={17}/></button>)}</div>
        <div className="board" role="grid" aria-label="Connect Four game board">{room.board.map((row, r) => row.map((cell, c) => { const winning = room.winningCells?.some(([wr, wc]) => wr === r && wc === c); return <button key={`${r}-${c}`} role="gridcell" aria-label={`Row ${r + 1}, column ${c + 1}${cell ? `, ${cell}` : ', empty'}`} className={`board-cell ${hoverColumn === c ? 'cell-hovered' : ''} ${winning ? 'winning-cell' : ''}`} disabled={!isMyTurn || !bothConnected || room.status !== 'playing' || room.board[0][c] !== null} onMouseEnter={() => setHoverColumn(c)} onMouseLeave={() => setHoverColumn(null)} onClick={() => makeMove(c)}><span className={`disc ${cell ? `disc-${cell}` : ''} ${winning ? 'disc-winner' : ''}`}/></button>; }))}</div>
        <div className="board-base"><span/><span/><span/><span/><span/><span/><span/></div>
      </div>
      {room.status === 'won' || room.status === 'draw' ? <div className="result-card"><span className="result-icon">{room.status === 'draw' ? '🤝' : <Crown size={23}/>}</span><div><strong>{room.status === 'draw' ? 'What a battle!' : room.winner === myColor ? 'You got four!' : `${winnerName} takes it!`}</strong><p>{room.status === 'draw' ? 'No spaces left. Time for a rematch.' : 'A brilliant connection. Ready for another round?'}</p></div><button className="primary-button result-button" disabled={rematchBusy} onClick={rematch}><RotateCcw size={17}/>{rematchBusy ? 'Starting…' : 'Play rematch'}</button></div> : <div className="game-tip"><Sparkles size={15}/><span>PRO TIP</span> Control the center columns to unlock more winning paths.</div>}
      <div className="game-bottom"><span><span className="bottom-dot"/> MOVES ARE SYNCED LIVE</span><span>FOURPLAY <b>•</b> PLAY FAIR. THINK AHEAD.</span></div>
    </section>}
    <footer className="site-footer"><span>© 2026 FOURPLAY ARENA</span><span>MADE FOR FRIENDLY RIVALRIES <span className="footer-heart">♥</span></span></footer>
  </main>;
}

export default App;
