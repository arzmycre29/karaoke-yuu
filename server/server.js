import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import dns from 'dns';
import ytSearch from 'yt-search';

const execAsync = promisify(exec);

let lastInternetCheck = 0;
let cachedInternetStatus = true;

async function checkInternetAccess() {
  const now = Date.now();
  if (now - lastInternetCheck < 8000) {
    return cachedInternetStatus;
  }
  lastInternetCheck = now;
  try {
    await dns.promises.lookup('google.com');
    cachedInternetStatus = true;
  } catch (e) {
    cachedInternetStatus = false;
  }
  return cachedInternetStatus;
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());

// Disk Storage Directory for Permanent Presets File & Media Files
const DATA_DIR = path.join(__dirname, 'data');
const MEDIA_DIR = path.join(__dirname, 'media');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Serve uploaded audio & video files with full HTTP 206 Partial Content range support
app.use('/media', express.static(MEDIA_DIR, {
  acceptRanges: true,
  maxAge: '7d'
}));

// Raw body parser for binary media file uploads up to 500MB (non-blocking)
app.use('/api/upload', express.raw({ type: '*/*', limit: '500mb' }));
app.use(express.json({ limit: '50mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let globalAppState = null;

// Read presets from server disk
async function readPresetsFromDisk() {
  try {
    if (fs.existsSync(PRESETS_FILE)) {
      const data = await fs.promises.readFile(PRESETS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading presets.json from disk:', err);
  }
  return null;
}

// Write presets to server disk (async non-blocking)
async function writePresetsToDisk(presets) {
  try {
    await fs.promises.writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing presets.json to disk:', err);
    return false;
  }
}

// 0. GET /api/ping (Heartbeat, latency check & internet connectivity status)
app.get('/api/ping', async (req, res) => {
  const hasInternet = await checkInternetAccess();
  return res.json({
    ok: true,
    timestamp: Date.now(),
    internet: hasInternet
  });
});

// 1. GET /api/presets (Load permanent presets from hard drive)
app.get('/api/presets', async (req, res) => {
  const diskPresets = await readPresetsFromDisk();
  return res.json({ presets: diskPresets || [] });
});

// 2. POST /api/presets (Save permanent presets to hard drive)
app.post('/api/presets', async (req, res) => {
  const { presets } = req.body;
  if (!Array.isArray(presets)) {
    return res.status(400).json({ error: 'Body must contain "presets" array' });
  }

  const success = await writePresetsToDisk(presets);
  if (success) {
    return res.json({ success: true, count: presets.length });
  } else {
    return res.status(500).json({ error: 'Failed to save presets to server disk' });
  }
});

// --- GIT INTEGRATION ENDPOINTS (SYNC PRESETS WITH GITHUB) ---

// GET /api/git/status (Cek status commit terakhir di repo)
app.get('/api/git/status', async (req, res) => {
  try {
    const { stdout: logOut } = await execAsync('git log -n 1 --pretty=format:"%h - %s (%cr)"', { cwd: PROJECT_ROOT });
    const { stdout: statusOut } = await execAsync('git status --porcelain server/data/presets.json', { cwd: PROJECT_ROOT });
    return res.json({
      success: true,
      lastCommit: logOut.trim(),
      hasLocalChanges: Boolean(statusOut.trim())
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal mengecek status Git'
    });
  }
});

// POST /api/git/pull (Tarik update presets.json dari GitHub)
app.post('/api/git/pull', async (req, res) => {
  try {
    console.log('🔄 [Git] Menarik update dari remote GitHub (git pull origin main)...');
    const { stdout, stderr } = await execAsync('git pull origin main', { cwd: PROJECT_ROOT });
    console.log('[Git Pull Stdout]:', stdout);

    const diskPresets = await readPresetsFromDisk();
    
    if (diskPresets) {
      io.emit('PRESETS_UPDATED', diskPresets);
    }

    return res.json({
      success: true,
      message: 'Berhasil menarik pembaruan dari GitHub!',
      presets: diskPresets || [],
      details: stdout || stderr
    });
  } catch (err) {
    console.error('❌ [Git Pull Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal melakukan git pull dari GitHub'
    });
  }
});

// POST /api/git/push (Simpan presets.json, commit, dan push ke GitHub)
app.post('/api/git/push', async (req, res) => {
  try {
    const { presets, commitMessage } = req.body || {};

    if (Array.isArray(presets)) {
      await writePresetsToDisk(presets);
    }

    console.log('🚀 [Git] Menyiapkan push presets.json ke GitHub...');
    await execAsync('git add server/data/presets.json', { cwd: PROJECT_ROOT });

    // Cek apakah ada perubahan yang staged
    const { stdout: diffOut } = await execAsync('git diff --cached --name-only server/data/presets.json', { cwd: PROJECT_ROOT });
    if (!diffOut.trim()) {
      return res.json({
        success: true,
        alreadyUpToDate: true,
        message: 'Presets sudah sinkron (tidak ada perubahan baru untuk di-push ke GitHub).'
      });
    }

    const defaultMsg = `feat: update preset songs and lyrics timing from operator`;
    const cleanMsg = (commitMessage ? String(commitMessage).replace(/"/g, '\\"') : defaultMsg).trim();

    await execAsync(`git commit -m "${cleanMsg}"`, { cwd: PROJECT_ROOT });
    const { stdout: pushOut, stderr: pushErr } = await execAsync('git push origin main', { cwd: PROJECT_ROOT });

    console.log('✅ [Git Push Success]:', pushOut || pushErr);
    return res.json({
      success: true,
      message: 'Berhasil melakukan push presets ke GitHub!',
      details: pushOut || pushErr
    });
  } catch (err) {
    console.error('❌ [Git Push Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Gagal melakukan git push ke GitHub'
    });
  }
});

// 3. POST /api/upload (Save binary audio/video completely asynchronously without blocking streaming)
app.post('/api/upload', async (req, res) => {
  try {
    const rawName = req.headers['x-filename'] ? decodeURIComponent(String(req.headers['x-filename'])) : `media-${Date.now()}.mp3`;
    const ext = path.extname(rawName) || '.mp3';
    const base = path.basename(rawName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${Date.now()}-${base}${ext}`;
    const filePath = path.join(MEDIA_DIR, filename);

    // Non-blocking async write so current media playback stream is never interrupted
    await fs.promises.writeFile(filePath, req.body);
    const host = req.headers.host || `localhost:${PORT}`;
    const fileUrl = `http://${host}/media/${encodeURIComponent(filename)}`;

    console.log(`📁 [Media Upload Async] Saved: ${filename}`);
    return res.json({ success: true, url: fileUrl, fileName: rawName });
  } catch (err) {
    console.error('File upload error:', err);
    return res.status(500).json({ error: 'Failed to save media file to disk', details: err.message });
  }
});

// 4. YouTube Search API Endpoint
app.get('/api/youtube/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const fullQuery = String(query);
    const searchResults = await ytSearch(fullQuery);

    const videos = searchResults.videos.slice(0, 15).map(v => ({
      videoId: v.videoId,
      title: v.title,
      artist: v.author?.name || 'YouTube Artist',
      duration: v.seconds,
      durationFormatted: v.timestamp,
      thumbnail: v.thumbnail || v.image,
      url: v.url
    }));

    return res.json({ videos });
  } catch (err) {
    console.error('YouTube Search API error:', err);
    return res.status(500).json({ error: 'Failed to search YouTube videos', details: err.message });
  }
});

// WebSocket Real-time Sync
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  if (globalAppState) {
    socket.emit('STATE_UPDATE', globalAppState);
  }

  socket.on('UPDATE_STATE', (newState) => {
    globalAppState = newState;
    socket.broadcast.emit('STATE_UPDATE', newState);
  });

  socket.on('TIME_UPDATE', (timeData) => {
    if (globalAppState) {
      globalAppState.currentTime = timeData.currentTime;
      if (timeData.duration) globalAppState.duration = timeData.duration;
    }
    socket.broadcast.emit('TIME_UPDATE', timeData);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, () => {
  const localIp = getLocalIp();
  console.log(`\n==============================================`);
  console.log(`🎉 J-Stage Karaoke Sync Server is Running!`);
  console.log(`📍 Local:   http://localhost:${PORT}`);
  console.log(`🌐 Network: http://${localIp}:${PORT}`);
  console.log(`📁 Disk Presets: ${PRESETS_FILE}`);
  console.log(`📁 Disk Media:   ${MEDIA_DIR}`);
  console.log(`==============================================\n`);
});
