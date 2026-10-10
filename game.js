'use strict';

const COLS = 13;
const ROWS = 11;
const TILE = 48;
const VIEW_W = COLS * TILE;
const VIEW_H = ROWS * TILE;
const PLAYER_R = 15;
const FUSE = 2.5;
const BLAST_TIME = 0.62;
const ITEM_INTERVAL = 8;
const ITEM_CAP = 3;
const RANGE_START = 2;
const RANGE_CAP = 8;
const BOMB_START = 1;
const BOMB_CAP = 5;
const SPEED_START = 3;
const SPEED_MIN = 1;
const SPEED_MAX = 5;
const SPEED = [0, 96, 138, 182, 230, 286];
const SPEED_LABEL = { 1: '遅い', 2: 'やや遅', 3: '普通', 4: '速い', 5: '最速' };
const ITEM_TYPES = ['range', 'speedUp', 'speedDown', 'bomb'];
const ITEM_NAME = {
  range: '火力アップ',
  speedUp: 'スピードアップ',
  speedDown: 'スピードダウン',
  bomb: '爆弾追加',
};
const ITEM_COLOR = {
  range: '#ff7a18',
  speedUp: '#1db954',
  speedDown: '#9b4dff',
  bomb: '#f5c518',
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PILLARS = new Set([
  '1,4', '11,6', '1,7', '11,3',
  '4,3', '8,3', '2,5', '6,5', '10,5', '4,7', '8,7',
]);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');

const held = new Set();
const queued = new Set();
const watch = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftRight',
]);

let bombs = [];
let items = [];
let flames = [];
let floats = [];
let scorches = [];
let lastBlast = [];
let phase = 'play';
let result = null;
let itemTimer = 0;
let anim = 0;

const players = [
  makePlayer(1, 1, 1, '#2f6fed', {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space',
  }, 0),
  makePlayer(2, 11, 9, '#e23b3b', {
    up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'ShiftRight',
  }, Math.PI),
];

function makePlayer(id, c, r, color, keys, facing) {
  return {
    id,
    spawnC: c,
    spawnR: r,
    color,
    facing,
    x: (c + 0.5) * TILE,
    y: (r + 0.5) * TILE,
    range: RANGE_START,
    capacity: BOMB_START,
    speedLevel: SPEED_START,
    alive: true,
    ...keys,
  };
}

function resetPlayer(p) {
  p.x = (p.spawnC + 0.5) * TILE;
  p.y = (p.spawnR + 0.5) * TILE;
  p.range = RANGE_START;
  p.capacity = BOMB_START;
  p.speedLevel = SPEED_START;
  p.alive = true;
  p.facing = p.id === 2 ? Math.PI : 0;
}

function isWall(c, r) {
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) return true;
  return PILLARS.has(c + ',' + r);
}

function playerTile(p) {
  return { c: Math.floor(p.x / TILE), r: Math.floor(p.y / TILE) };
}

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

function overlapsTile(p, c, r) {
  return circleRect(p.x, p.y, PLAYER_R, c * TILE, r * TILE, TILE, TILE);
}

function blocked(p) {
  const minC = Math.floor((p.x - PLAYER_R) / TILE);
  const maxC = Math.floor((p.x + PLAYER_R) / TILE);
  const minR = Math.floor((p.y - PLAYER_R) / TILE);
  const maxR = Math.floor((p.y + PLAYER_R) / TILE);
  for (let c = minC; c <= maxC; c++) {
    for (let r = minR; r <= maxR; r++) {
      if (isWall(c, r) && overlapsTile(p, c, r)) return true;
      const bomb = bombs.find((b) => b.c === c && b.r === r);
      if (bomb && !bomb.pass.has(p.id) && overlapsTile(p, c, r)) return true;
    }
  }
  return false;
}

function movePlayer(p, dt) {
  if (!p.alive) return;
  let x = 0;
  let y = 0;
  if (held.has(p.left)) x -= 1;
  if (held.has(p.right)) x += 1;
  if (held.has(p.up)) y -= 1;
  if (held.has(p.down)) y += 1;
  if (x === 0 && y === 0) return;
  const len = Math.hypot(x, y);
  const dist = SPEED[p.speedLevel] * dt;
  const dx = (x / len) * dist;
  const dy = (y / len) * dist;
  const steps = Math.max(1, Math.ceil(dist / 4));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    p.x += sx;
    if (blocked(p)) p.x -= sx;
    p.y += sy;
    if (blocked(p)) p.y -= sy;
  }
  p.facing = Math.atan2(y, x);
}

function tryPlace(p) {
  if (!p.alive) return;
  const { c, r } = playerTile(p);
  if (isWall(c, r)) return;
  if (bombs.some((b) => b.c === c && b.r === r)) return;
  const out = bombs.filter((b) => b.ownerId === p.id).length;
  if (out >= p.capacity) return;
  const pass = new Set([p.id]);
  for (const other of players) {
    if (other.alive && overlapsTile(other, c, r)) pass.add(other.id);
  }
  bombs.push({ c, r, ownerId: p.id, fuse: FUSE, range: p.range, pass });
}

function refreshBombPass() {
  for (const bomb of bombs) {
    for (const id of [...bomb.pass]) {
      const p = players.find((pl) => pl.id === id);
      if (!p || !p.alive || !overlapsTile(p, bomb.c, bomb.r)) bomb.pass.delete(id);
    }
  }
}

function applyItem(p, item) {
  if (item.type === 'range') p.range = Math.min(RANGE_CAP, p.range + 1);
  else if (item.type === 'speedUp') p.speedLevel = Math.min(SPEED_MAX, p.speedLevel + 1);
  else if (item.type === 'speedDown') p.speedLevel = Math.max(SPEED_MIN, p.speedLevel - 1);
  else if (item.type === 'bomb') p.capacity = Math.min(BOMB_CAP, p.capacity + 1);
}

function pickup(p) {
  if (!p.alive) return;
  const { c, r } = playerTile(p);
  const index = items.findIndex((item) => item.c === c && item.r === r);
  if (index < 0) return;
  const item = items.splice(index, 1)[0];
  applyItem(p, item);
  floats.push({
    x: p.x,
    y: p.y - 26,
    text: ITEM_NAME[item.type],
    color: ITEM_COLOR[item.type],
    time: 0.9,
  });
}

function emptyTiles() {
  const spots = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (isWall(c, r)) continue;
      if (bombs.some((b) => b.c === c && b.r === r)) continue;
      if (items.some((item) => item.c === c && item.r === r)) continue;
      if (flames.some((f) => f.tiles.some((t) => t.c === c && t.r === r))) continue;
      if (players.some((p) => p.alive && overlapsTile(p, c, r))) continue;
      spots.push({ c, r });
    }
  }
  return spots;
}

function spawnItem(type) {
  const spots = emptyTiles();
  if (!spots.length) return null;
  const spot = spots[Math.floor(Math.random() * spots.length)];
  const item = {
    c: spot.c,
    r: spot.r,
    type: type || ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)],
  };
  items.push(item);
  return item;
}

function damageTiles(tiles) {
  for (const p of players) {
    if (!p.alive) continue;
    if (tiles.some((t) => overlapsTile(p, t.c, t.r))) p.alive = false;
  }
}

function detonate(seeds) {
  const queue = [...seeds];
  const doomed = new Set(seeds);
  const tiles = [];
  const seen = new Set();
  const addTile = (c, r) => {
    const key = c + ',' + r;
    if (seen.has(key)) return;
    seen.add(key);
    tiles.push({ c, r });
  };
  while (queue.length) {
    const bomb = queue.shift();
    addTile(bomb.c, bomb.r);
    for (const [dc, dr] of DIRS) {
      for (let i = 1; i <= bomb.range; i++) {
        const c = bomb.c + dc * i;
        const r = bomb.r + dr * i;
        if (isWall(c, r)) break;
        addTile(c, r);
        const other = bombs.find((b) => b.c === c && b.r === r);
        if (other) {
          if (!doomed.has(other)) {
            doomed.add(other);
            queue.push(other);
          }
          break;
        }
      }
    }
  }
  bombs = bombs.filter((b) => !doomed.has(b));
  items = items.filter((item) => !seen.has(item.c + ',' + item.r));
  flames.push({ tiles, time: BLAST_TIME });
  for (const t of tiles) scorches.push({ c: t.c, r: t.r, time: 1.15 });
  lastBlast = tiles;
  damageTiles(tiles);
}

function updateBombs(dt) {
  for (const bomb of bombs) bomb.fuse -= dt;
  const ready = bombs.filter((b) => b.fuse <= 0);
  if (ready.length) detonate(ready);
}

function checkWin() {
  const living = players.filter((p) => p.alive);
  if (living.length === 2) return;
  phase = 'end';
  if (living.length === 0) {
    result = 'draw';
    showOverlay('引き分け！', '同じ爆風で同時にやられた', 'draw');
  } else if (living[0].id === 1) {
    result = 'p1';
    showOverlay('プレイヤー1の勝ち！', '青のプレイヤーが生き残った', 'p1');
  } else {
    result = 'p2';
    showOverlay('プレイヤー2の勝ち！', '赤のプレイヤーが生き残った', 'p2');
  }
}

function showOverlay(title, sub, kind) {
  overlayTitle.textContent = title;
  overlayTitle.className = kind;
  overlaySub.textContent = sub;
  overlay.hidden = false;
}

function restart() {
  for (const p of players) resetPlayer(p);
  bombs = [];
  items = [];
  flames = [];
  floats = [];
  scorches = [];
  lastBlast = [];
  phase = 'play';
  result = null;
  itemTimer = 0;
  overlay.hidden = true;
  queued.clear();
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  syncHud();
}

function update(dt) {
  if (phase === 'play') {
    for (const p of players) {
      if (queued.has(p.bomb)) tryPlace(p);
    }
    for (const p of players) movePlayer(p, dt);
    refreshBombPass();
    for (const p of players) pickup(p);
    updateBombs(dt);
    itemTimer += dt;
    if (itemTimer >= ITEM_INTERVAL) {
      itemTimer -= ITEM_INTERVAL;
      if (items.length < ITEM_CAP) spawnItem();
    }
    for (const flame of flames) {
      if (flame.time > 0) damageTiles(flame.tiles);
    }
    checkWin();
  }
  for (const flame of flames) flame.time -= dt;
  flames = flames.filter((flame) => flame.time > 0);
  for (const scorch of scorches) scorch.time -= dt;
  scorches = scorches.filter((scorch) => scorch.time > 0);
  for (const floater of floats) {
    floater.time -= dt;
    floater.y -= 22 * dt;
  }
  floats = floats.filter((floater) => floater.time > 0);
  queued.clear();
  syncHud();
}

function syncHud() {
  for (const p of players) {
    const prefix = p.id === 1 ? 'p1' : 'p2';
    document.getElementById(prefix + '-bomb').textContent = String(p.capacity);
    const left = p.capacity - bombs.filter((b) => b.ownerId === p.id).length;
    document.getElementById(prefix + '-bomb-left').textContent = 'あと ' + left;
    document.getElementById(prefix + '-range').textContent = String(p.range);
    document.getElementById(prefix + '-speed').textContent = String(p.speedLevel);
    document.getElementById(prefix + '-speed-label').textContent = SPEED_LABEL[p.speedLevel];
  }
}

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(VIEW_W * dpr);
  canvas.height = Math.round(VIEW_H * dpr);
  canvas.style.width = VIEW_W + 'px';
  canvas.style.height = VIEW_H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fillRound(x, y, w, h, radius, color) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawMap() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE;
      const y = r * TILE;
      if (isWall(c, r)) continue;
      ctx.fillStyle = (c + r) % 2 === 0 ? '#e7d4aa' : '#dcc79a';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(90, 60, 20, 0.12)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isWall(c, r)) continue;
      const border = c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1;
      const x = c * TILE;
      const y = r * TILE;
      if (border) {
        ctx.fillStyle = '#3e4c5e';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillRect(x, y, 5, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
        ctx.fillRect(x + TILE - 5, y, 5, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 10, y + 22, TILE - 20, 3);
      } else {
        ctx.fillStyle = '#a07848';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillRect(x, y, 5, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
        ctx.fillRect(x + TILE - 5, y, 5, TILE);
        fillRound(x + 15, y + 15, TILE - 30, TILE - 30, 5, '#e6c48a');
      }
    }
  }
}

function drawScorches() {
  for (const scorch of scorches) {
    ctx.globalAlpha = Math.max(0, scorch.time / 1.15) * 0.4;
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.arc((scorch.c + 0.5) * TILE, (scorch.r + 0.5) * TILE, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawIcon(type, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fffaf3';
  if (type === 'range') {
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.bezierCurveTo(7, -4, 8, 2, 0, 10);
    ctx.bezierCurveTo(-8, 2, -7, -4, 0, -9);
    ctx.fill();
  } else if (type === 'speedUp') {
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(8, 3);
    ctx.lineTo(3.5, 3);
    ctx.lineTo(3.5, 9);
    ctx.lineTo(-3.5, 9);
    ctx.lineTo(-3.5, 3);
    ctx.lineTo(-8, 3);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'speedDown') {
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(8, -3);
    ctx.lineTo(3.5, -3);
    ctx.lineTo(3.5, -9);
    ctx.lineTo(-3.5, -9);
    ctx.lineTo(-3.5, -3);
    ctx.lineTo(-8, -3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(-1, 3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(7, -7);
    ctx.stroke();
    ctx.strokeStyle = '#fffaf3';
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(8, -4);
    ctx.moveTo(5, -7);
    ctx.lineTo(11, -7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItems() {
  items.forEach((item, index) => {
    const bob = Math.sin(anim / 180 + index) * 3;
    const x = (item.c + 0.5) * TILE;
    const y = (item.r + 0.5) * TILE + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ITEM_COLOR[item.type];
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();
    drawIcon(item.type, x, y);
  });
}

function drawBombs() {
  for (const bomb of bombs) {
    const x = (bomb.c + 0.5) * TILE;
    const y = (bomb.r + 0.5) * TILE;
    const hot = 1 - bomb.fuse / FUSE;
    const pulse = 1 + Math.sin(anim / 70) * (0.03 + hot * 0.05);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(0, 1, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.arc(-5, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(5, -11);
    ctx.quadraticCurveTo(14, -16, 11, -21);
    ctx.stroke();
    const blink = Math.sin(anim / (36 + bomb.fuse * 80)) > 0;
    ctx.fillStyle = blink ? '#fde68a' : '#f97316';
    ctx.beginPath();
    ctx.arc(11, -21, blink ? 3.6 : 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFlames() {
  for (const flame of flames) {
    const alpha = Math.min(1, flame.time / 0.2);
    for (const t of flame.tiles) {
      const x = t.c * TILE;
      const y = t.r * TILE;
      ctx.globalAlpha = alpha;
      fillRound(x + 3, y + 3, TILE - 6, TILE - 6, 12, '#ff7a1a');
      fillRound(x + 12, y + 12, TILE - 24, TILE - 24, 10, '#ffd36a');
      ctx.fillStyle = '#fff7e2';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawPlayers() {
  for (const p of players) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = p.alive ? 1 : 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.alive ? p.color : '#6b625c';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
    ctx.rotate(p.facing);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(9, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = p.alive ? 1 : 0.55;
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.id), p.x, p.y);
    ctx.globalAlpha = 1;
  }
}

function drawFloats() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 15px "WenQuanYi Micro Hei", "Noto Sans CJK JP", sans-serif';
  for (const floater of floats) {
    ctx.globalAlpha = Math.max(0, floater.time / 0.9);
    ctx.fillStyle = floater.color;
    ctx.strokeStyle = '#2a1c14';
    ctx.lineWidth = 3;
    ctx.strokeText(floater.text, floater.x, floater.y);
    ctx.fillText(floater.text, floater.x, floater.y);
    ctx.globalAlpha = 1;
  }
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  drawMap();
  drawScorches();
  drawItems();
  drawBombs();
  drawFlames();
  drawPlayers();
  drawFloats();
}

function snapshot() {
  return {
    phase,
    result,
    itemTimer,
    players: players.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      range: p.range,
      capacity: p.capacity,
      speedLevel: p.speedLevel,
      alive: p.alive,
      tile: playerTile(p),
    })),
    bombs: bombs.map((b) => ({
      c: b.c, r: b.r, fuse: b.fuse, ownerId: b.ownerId, range: b.range,
    })),
    items: items.map((item) => ({ c: item.c, r: item.r, type: item.type })),
    flames: flames.map((f) => ({
      time: f.time,
      tiles: f.tiles.map((t) => ({ c: t.c, r: t.r })),
    })),
    lastBlast: lastBlast.map((t) => ({ c: t.c, r: t.r })),
  };
}

window.addEventListener('keydown', (e) => {
  if (watch.has(e.code)) e.preventDefault();
  if (e.code === 'KeyR') {
    if (phase === 'end' && !e.repeat) restart();
    return;
  }
  if (e.repeat || held.has(e.code)) return;
  held.add(e.code);
  if (watch.has(e.code)) queued.add(e.code);
});

window.addEventListener('keyup', (e) => {
  held.delete(e.code);
});

window.addEventListener('blur', () => {
  held.clear();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) held.clear();
});

document.getElementById('restart').addEventListener('click', restart);

setupCanvas();
syncHud();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  anim = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__bombDuel = {
  snapshot,
  spawnItem,
  restart,
  TILE,
  isWall,
};
