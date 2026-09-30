const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Load .env file if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const GITHUB_PAT = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'ahmedbma/Botanical-Calculator';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'data/quiz-history.json';
const LOCAL_HISTORY_PATH = path.join(__dirname, 'data', 'quiz-history.json');

app.use(express.json({ limit: '5mb' }));

// Helper to read local cache
function readLocalHistory() {
  try {
    if (fs.existsSync(LOCAL_HISTORY_PATH)) {
      const content = fs.readFileSync(LOCAL_HISTORY_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading local quiz-history.json:', err.message);
  }
  return { history: [], missed: [] };
}

// Helper to write local cache
function writeLocalHistory(data) {
  try {
    fs.writeFileSync(LOCAL_HISTORY_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing local quiz-history.json:', err.message);
  }
}

// GET /api/quiz-history/status
app.get('/api/quiz-history/status', (req, res) => {
  res.json({
    configured: !!GITHUB_PAT,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    filePath: GITHUB_FILE_PATH
  });
});

// GET /api/quiz-history
app.get('/api/quiz-history', async (req, res) => {
  if (!GITHUB_PAT) {
    const local = readLocalHistory();
    return res.json({
      success: true,
      synced: false,
      configured: false,
      source: 'local-server',
      message: 'GITHUB_PAT not set. Serving from local server cache.',
      data: local
    });
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
  try {
    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Botanical-Calculator-Quiz'
      }
    });

    if (ghRes.status === 200) {
      const fileInfo = await ghRes.json();
      const contentStr = Buffer.from(fileInfo.content, 'base64').toString('utf8');
      const parsed = JSON.parse(contentStr);
      writeLocalHistory(parsed);
      return res.json({
        success: true,
        synced: true,
        configured: true,
        source: 'github',
        sha: fileInfo.sha,
        data: parsed
      });
    } else if (ghRes.status === 404) {
      const local = readLocalHistory();
      return res.json({
        success: true,
        synced: true,
        configured: true,
        source: 'github-empty',
        sha: null,
        data: local
      });
    } else {
      const errJson = await ghRes.json().catch(() => ({}));
      const local = readLocalHistory();
      return res.json({
        success: true,
        synced: false,
        configured: true,
        source: 'local-fallback',
        error: errJson.message || `HTTP ${ghRes.status}`,
        data: local
      });
    }
  } catch (err) {
    const local = readLocalHistory();
    return res.json({
      success: true,
      synced: false,
      configured: true,
      source: 'local-fallback',
      error: err.message,
      data: local
    });
  }
});

// Disable caching on all API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Helper to merge history payloads cleanly
function mergeHistoryPayloads(existing, incoming) {
  existing = existing || {};
  incoming = incoming || {};
  const res = { ...existing, ...incoming };

  const histMap = new Map();
  const histList = [...(incoming.history || []), ...(existing.history || [])];
  histList.forEach(h => {
    if (!h) return;
    const k = h.id || `${h.when}-${h.mode}-${h.right}-${h.total}`;
    if (!histMap.has(k)) histMap.set(k, h);
  });
  res.history = Array.from(histMap.values())
    .sort((a, b) => (b.when || 0) - (a.when || 0))
    .slice(0, 100);

  const missMap = new Map();
  const missList = [...(incoming.missed || []), ...(existing.missed || [])];
  missList.forEach(m => {
    if (!m) return;
    const k = m.id || m.key || m.q;
    if (!k) return;
    if (!missMap.has(k)) {
      missMap.set(k, { ...m });
    } else {
      const ex = missMap.get(k);
      ex.missCount = Math.max(ex.missCount || 1, m.missCount || 1);
      if ((m.lastMissedAt || 0) > (ex.lastMissedAt || 0)) {
        ex.lastMissedAt = m.lastMissedAt;
        ex.lastPicked = m.lastPicked || ex.lastPicked;
        ex.explain = m.explain || ex.explain;
      }
    }
  });
  res.missed = Array.from(missMap.values());

  res.runs = res.history.length;
  res.answered = res.history.reduce((sum, h) => sum + (h.total || 0), 0);
  res.correct = res.history.reduce((sum, h) => sum + (h.right || 0), 0);
  res.last = res.history[0] || incoming.last || existing.last || null;

  return res;
}

// POST /api/quiz-history
app.post('/api/quiz-history', async (req, res) => {
  const payload = req.body || {};
  if (!payload.history && !payload.missed) {
    return res.status(400).json({ error: 'Invalid payload: history or missed required' });
  }

  let finalPayload = payload;
  if (!GITHUB_PAT) {
    const local = readLocalHistory();
    finalPayload = mergeHistoryPayloads(local, payload);
    writeLocalHistory(finalPayload);
    return res.json({
      success: true,
      synced: false,
      configured: false,
      data: finalPayload,
      message: 'Saved to server cache. Set GITHUB_PAT in .env to push commits to GitHub.'
    });
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  try {
    let sha = null;
    const getRes = await fetch(`${url}?ref=${GITHUB_BRANCH}`, {
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Botanical-Calculator-Quiz'
      }
    });

    if (getRes.status === 200) {
      const fileInfo = await getRes.json();
      sha = fileInfo.sha;
      try {
        const contentStr = Buffer.from(fileInfo.content, 'base64').toString('utf8');
        const remoteData = JSON.parse(contentStr);
        finalPayload = mergeHistoryPayloads(remoteData, payload);
      } catch (e) {
        finalPayload = payload;
      }
    } else {
      const local = readLocalHistory();
      finalPayload = mergeHistoryPayloads(local, payload);
    }

    writeLocalHistory(finalPayload);

    const contentBase64 = Buffer.from(JSON.stringify(finalPayload, null, 2), 'utf8').toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Botanical-Calculator-Quiz'
      },
      body: JSON.stringify({
        message: 'Update quiz history [skip ci]',
        content: contentBase64,
        branch: GITHUB_BRANCH,
        sha: sha || undefined
      })
    });

    if (putRes.status === 200 || putRes.status === 201) {
      const result = await putRes.json();
      return res.json({
        success: true,
        synced: true,
        configured: true,
        commit: result.commit ? result.commit.sha : null,
        data: finalPayload
      });
    } else {
      const errJson = await putRes.json().catch(() => ({}));
      return res.json({
        success: true,
        synced: false,
        configured: true,
        data: finalPayload,
        error: errJson.message || `HTTP ${putRes.status}`,
        message: 'Saved on server, but GitHub commit failed.'
      });
    }
  } catch (err) {
    return res.json({
      success: true,
      synced: false,
      configured: true,
      data: finalPayload,
      error: err.message,
      message: 'Saved on server, but GitHub request failed.'
    });
  }
});

// Serve static assets from project root
app.use(express.static(__dirname, {
  extensions: ['html']
}));

// Route /quiz to quiz.html
app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, 'quiz.html'));
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
