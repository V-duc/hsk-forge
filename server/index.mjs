import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DB_DIR = path.join(ROOT_DIR, 'server_data');
fs.mkdirSync(DB_DIR, { recursive: true });

const PORT = Number(process.env.PORT || 8787);
const db = new DatabaseSync(path.join(DB_DIR, 'hsk_multiuser.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    store_json TEXT NOT NULL DEFAULT '{}',
    mastered_count INTEGER NOT NULL DEFAULT 0,
    sessions_done INTEGER NOT NULL DEFAULT 0,
    best_hsk_score INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
}

function computeStatsFromStore(store) {
  const srsValues = Object.values(store?.srs || {});
  const masteredCount = srsValues.filter((r) => r && r.reps >= 2 && r.interval >= 7).length;
  const sessionsDone = Array.isArray(store?.completedSessions) ? store.completedSessions.length : 0;
  const exams = Array.isArray(store?.examHistory) ? store.examHistory : [];
  let bestHskScore = 0;
  for (const ex of exams) {
    const normalized =
      (ex?.maxScaledScore || 300) === 300
        ? Number(ex?.scaledScore || 0)
        : Math.round((Number(ex?.scaledScore || 0) / Math.max(1, Number(ex?.maxScaledScore || 100))) * 300);
    if (normalized > bestHskScore) bestHskScore = normalized;
  }
  const dailyMap = store?.dailyCount || {};
  const totalReviews = Object.values(dailyMap).reduce((acc, v) => acc + (Number(v) || 0), 0);

  // Compute streak
  let streak = 0;
  const cursor = new Date();
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!dailyMap[fmt(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (dailyMap[fmt(cursor)] > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { masteredCount, sessionsDone, bestHskScore, streak, totalReviews };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, status, payload) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function getUserByToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT u.* FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `);
  return stmt.get(token) || null;
}

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      const row = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
      return sendJson(res, 200, { ok: true, usersCount: row?.cnt ?? 0 });
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const username = String(body.username || '')
        .trim()
        .toLowerCase();
      const displayName = String(body.displayName || username).trim().slice(0, 40);
      const password = String(body.password || '');
      const initialStore = body.store && typeof body.store === 'object' ? body.store : {};

      if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
        return sendJson(res, 400, {
          error: 'Tên đăng nhập dài 3-24 ký tự (chỉ dùng chữ thường, số, dấu gạch dưới).',
        });
      }
      if (password.length < 4) {
        return sendJson(res, 400, { error: 'Mật khẩu cần tối thiểu 4 ký tự.' });
      }

      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (exists) {
        return sendJson(res, 409, { error: 'Tên tài khoản này đã có người đăng ký!' });
      }

      const now = Date.now();
      const passHash = hashPassword(password);
      const stats = computeStatsFromStore(initialStore);
      const storeJson = JSON.stringify(initialStore);

      const ins = db
        .prepare(
          `INSERT INTO users (username, display_name, pass_hash, store_json, mastered_count, sessions_done, best_hsk_score, streak, total_reviews, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          username,
          displayName || username,
          passHash,
          storeJson,
          stats.masteredCount,
          stats.sessionsDone,
          stats.bestHskScore,
          stats.streak,
          stats.totalReviews,
          now
        );

      const userId = Number(ins.lastInsertRowid);
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
        token,
        userId,
        now
      );

      return sendJson(res, 201, {
        token,
        user: { id: userId, username, displayName: displayName || username },
        store: initialStore,
      });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const username = String(body.username || '')
        .trim()
        .toLowerCase();
      const password = String(body.password || '');

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user || !verifyPassword(password, user.pass_hash)) {
        return sendJson(res, 401, { error: 'Sai tên đăng nhập hoặc mật khẩu!' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
        token,
        user.id,
        Date.now()
      );

      let store = {};
      try {
        store = JSON.parse(user.store_json || '{}');
      } catch {
        store = {};
      }

      return sendJson(res, 200, {
        token,
        user: { id: user.id, username: user.username, displayName: user.display_name },
        store,
      });
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const user = getUserByToken(req);
      if (!user) return sendJson(res, 401, { error: 'Chưa đăng nhập' });
      let store = {};
      try {
        store = JSON.parse(user.store_json || '{}');
      } catch {
        store = {};
      }
      return sendJson(res, 200, {
        user: { id: user.id, username: user.username, displayName: user.display_name },
        store,
      });
    }

    if (pathname === '/api/sync' && req.method === 'PUT') {
      const user = getUserByToken(req);
      if (!user) return sendJson(res, 401, { error: 'Phiên đăng nhập hết hạn' });
      const body = await readJsonBody(req);
      const store = body.store && typeof body.store === 'object' ? body.store : {};
      const stats = computeStatsFromStore(store);
      const now = Date.now();

      db.prepare(
        `UPDATE users
         SET store_json = ?, mastered_count = ?, sessions_done = ?, best_hsk_score = ?, streak = ?, total_reviews = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        JSON.stringify(store),
        stats.masteredCount,
        stats.sessionsDone,
        stats.bestHskScore,
        stats.streak,
        stats.totalReviews,
        now,
        user.id
      );

      return sendJson(res, 200, { ok: true, stats, updatedAt: now });
    }

    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const rows = db
        .prepare(
          `SELECT username, display_name, mastered_count, sessions_done, best_hsk_score, streak, total_reviews, updated_at,
                  (mastered_count * 10 + sessions_done * 25 + best_hsk_score * 2 + total_reviews) AS xp
           FROM users
           ORDER BY xp DESC, updated_at DESC
           LIMIT 50`
        )
        .all();

      return sendJson(res, 200, { leaderboard: rows });
    }
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : 'Server error' });
  }

  // Serve built frontend static files from dist/
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  let filePath = path.join(DIST_DIR, safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Chưa chạy pnpm build.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const cacheControl =
    ext === '.html' ? 'no-cache' : 'public, max-age=86400';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HSK-FORGE MULTIUSER SERVER] Listening on http://0.0.0.0:${PORT}`);
});
