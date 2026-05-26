// ─── Aufgaben-Definition ───────────────────────────────────────────
const TASKS = {
  rotating: [
    { id: 'spuelmaschine', name: 'Spülmaschine ausräumen', icon: '🍽️' },
    { id: 'muell',         name: 'Müll rausbringen',       icon: '🗑️' },
    { id: 'flaschen',      name: 'Flaschen wegbringen',    icon: '🍾' },
  ],
  weekly: [
    { id: 'toilette',        name: 'Toilette putzen' },
    { id: 'waschbecken',     name: 'Waschbecken & Spiegel' },
    { id: 'herd',            name: 'Herd & Ceranfeld' },
    { id: 'arbeitsflaechen', name: 'Arbeitsflächen & Spüle gründlich' },
    { id: 'staubsaugen',     name: 'Staubsaugen (WoZi, Eingang, Küche)' },
  ],
  biweekly: [
    { id: 'wischen', name: 'Wischen (Küche, Bad, WoZi, Eingang)' },
    { id: 'dusche',  name: 'Dusche/Badewanne reinigen' },
    { id: 'staub',   name: 'Staub wischen (WoZi, Eingang, Küche)' },
  ],
  monthly: [
    { id: 'kuehlschrank',       name: 'Kühlschrank putzen' },
    { id: 'spuelmaschine_deep', name: 'Spülmaschine entkalken' },
    { id: 'waschmaschine',      name: 'Waschmaschine reinigen' },
  ],
  quarterly: [
    { id: 'backofen', name: 'Backofen reinigen' },
  ],
};

const PEOPLE = ['Julian', 'David'];

// ─── Backend: jsonblob.com (anonym, kein Account nötig) ───────────
const API_BASE = 'https://jsonblob.com/api/jsonBlob';

async function createBlob() {
  const resp = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ turns: {}, done: {}, history: {} })
  });
  if (!resp.ok) throw new Error('Anlegen fehlgeschlagen (' + resp.status + ')');
  const id = resp.headers.get('X-jsonblob-id') || resp.headers.get('Location')?.split('/').pop();
  if (!id) throw new Error('Blob-ID konnte nicht gelesen werden');
  return id;
}

async function fetchBlob(id) {
  const resp = await fetch(`${API_BASE}/${id}`, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store'
  });
  if (!resp.ok) throw new Error('Laden fehlgeschlagen (' + resp.status + ')');
  return resp.json();
}

async function saveBlob(id, data) {
  const resp = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!resp.ok) throw new Error('Speichern fehlgeschlagen (' + resp.status + ')');
}

// ─── Setup-Error UI ───────────────────────────────────────────────
function showSetupError(message) {
  document.getElementById('loading').classList.add('hidden');
  const el = document.getElementById('setup-error');
  el.innerHTML = `
    <div class="setup-box">
      <h1>⚠️ Verbindungsproblem</h1>
      <p>${message}</p>
      <p>Lad die Seite neu, evtl. ist gerade kein Internet.</p>
      <button onclick="location.reload()" class="reload-btn">Neu laden</button>
    </div>`;
  el.classList.remove('hidden');
}

// ─── Room ID aus URL ──────────────────────────────────────────────
async function getOrCreateRoomId() {
  const match = window.location.hash.match(/room=([a-zA-Z0-9_-]+)/);
  if (match) return { id: match[1], isNew: false };
  const id = await createBlob();
  window.history.replaceState(null, '', '#room=' + id);
  return { id, isNew: true };
}

// ─── State ────────────────────────────────────────────────────────
let state = { turns: {}, done: {}, history: {} };
let roomId = null;
let isPolling = false;
let pendingWrite = false;
let lastSyncedAt = null;

function normalizeState(raw) {
  return {
    turns: (raw && raw.turns) || {},
    done: (raw && raw.done) || {},
    history: (raw && raw.history) || {},
  };
}

async function init() {
  try {
    const { id, isNew } = await getOrCreateRoomId();
    roomId = id;

    state = normalizeState(await fetchBlob(roomId));
    lastSyncedAt = Date.now();

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    setSyncStatus('online');

    if (isNew) showShareBanner();
    render();

    setInterval(pollUpdates, 3000);
    setInterval(render, 60_000);
  } catch (e) {
    showSetupError(e.message);
  }
}

async function pollUpdates() {
  if (isPolling || pendingWrite) return;
  isPolling = true;
  try {
    const latest = normalizeState(await fetchBlob(roomId));
    const a = JSON.stringify(state);
    const b = JSON.stringify(latest);
    if (a !== b) {
      state = latest;
      render();
    }
    lastSyncedAt = Date.now();
    setSyncStatus('online');
  } catch (e) {
    setSyncStatus('offline');
  } finally {
    isPolling = false;
  }
}

async function updateState(updateFn) {
  pendingWrite = true;
  setSyncStatus('saving');
  try {
    const latest = normalizeState(await fetchBlob(roomId));
    state = latest;
    updateFn(state);
    await saveBlob(roomId, state);
    lastSyncedAt = Date.now();
    setSyncStatus('online');
    render();
  } catch (e) {
    setSyncStatus('error');
    alert('Speichern fehlgeschlagen: ' + e.message);
  } finally {
    pendingWrite = false;
  }
}

function setSyncStatus(status) {
  const el = document.getElementById('sync-indicator');
  el.classList.remove('connected', 'saving-state', 'offline-state', 'error-state');
  switch (status) {
    case 'online':  el.textContent = '● Live synchronisiert'; el.classList.add('connected'); break;
    case 'saving':  el.textContent = '⟳ Speichere…';         el.classList.add('saving-state'); break;
    case 'offline': el.textContent = '⚠ Offline (versuche erneut)'; el.classList.add('offline-state'); break;
    case 'error':   el.textContent = '⚠ Fehler beim Speichern'; el.classList.add('error-state'); break;
  }
}

// ─── Datum-Helfer ─────────────────────────────────────────────────
function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getISOWeekYear(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}
function assignPerson(taskList, taskId, periodNum) {
  const idx = taskList.findIndex(t => t.id === taskId);
  return PEOPLE[(periodNum + idx) % 2];
}

// ─── State Helpers ────────────────────────────────────────────────
function getTurn(taskId) {
  return state.turns[taskId] || 'Julian';
}
function isDone(taskId, periodKey) {
  return !!state.done[`${periodKey}_${taskId}`];
}

// ─── Actions ──────────────────────────────────────────────────────
function clickRotating(taskId) {
  updateState(s => {
    const task = TASKS.rotating.find(t => t.id === taskId);
    const current = s.turns[taskId] || 'Julian';
    s.turns[taskId] = current === 'Julian' ? 'David' : 'Julian';
    const k = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    s.history[k] = { task: task.name, by: current, ts: new Date().toISOString() };
    // Trim auf max 30
    const keys = Object.keys(s.history).sort();
    if (keys.length > 30) keys.slice(0, keys.length - 30).forEach(k => delete s.history[k]);
  });
}
function toggleScheduled(taskId, periodKey) {
  updateState(s => {
    const key = `${periodKey}_${taskId}`;
    if (s.done[key]) delete s.done[key];
    else s.done[key] = true;
  });
}
function resetAll() {
  if (!confirm('Wirklich alles zurücksetzen? (Wer-ist-dran + Erledigt-Häkchen + Verlauf)')) return;
  updateState(s => { s.turns = {}; s.done = {}; s.history = {}; });
}

// ─── Share Banner ─────────────────────────────────────────────────
function showShareBanner() {
  document.getElementById('share-url').value = window.location.href;
  document.getElementById('share-banner').classList.remove('hidden');
}

// ─── Render ───────────────────────────────────────────────────────
function render() {
  const now = new Date();
  const week = getISOWeek(now);
  const weekYear = getISOWeekYear(now);
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3);

  document.getElementById('week-display').textContent =
    `KW ${week} · ${now.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  // Rotating
  const rotDiv = document.getElementById('rotating-tasks');
  rotDiv.innerHTML = '';
  TASKS.rotating.forEach(task => {
    const turn = getTurn(task.id);
    const card = document.createElement('div');
    card.className = `rotating-card ${turn.toLowerCase()}`;
    card.innerHTML = `
      <div class="icon">${task.icon}</div>
      <div class="name">${task.name}</div>
      <div class="turn"><strong>${turn}</strong> ist dran</div>
      <button>✓ ${turn} hat's gemacht</button>`;
    card.querySelector('button').addEventListener('click', () => clickRotating(task.id));
    rotDiv.appendChild(card);
  });

  // Weekly + Biweekly
  const cols = { Julian: [], David: [] };
  const weekKey = `w${weekYear}-${week}`;
  TASKS.weekly.forEach(task => {
    const person = assignPerson(TASKS.weekly, task.id, week);
    cols[person].push({ ...task, periodKey: weekKey, biweekly: false });
  });
  const biPeriod = Math.floor(week / 2);
  const biKey = `bw${weekYear}-${biPeriod}`;
  TASKS.biweekly.forEach(task => {
    const person = assignPerson(TASKS.biweekly, task.id, biPeriod);
    cols[person].push({ ...task, periodKey: biKey, biweekly: true });
  });
  renderTaskCol('julian-tasks', cols.Julian);
  renderTaskCol('david-tasks', cols.David);

  const monthPeriod = year * 12 + month;
  renderAssignedList('monthly-tasks', TASKS.monthly, monthPeriod, `m${monthPeriod}`);

  const quarterPeriod = year * 4 + quarter;
  renderAssignedList('quarterly-tasks', TASKS.quarterly, quarterPeriod, `q${quarterPeriod}`);

  renderHistory();
}

function renderTaskCol(elId, tasks) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  if (!tasks.length) {
    el.innerHTML = '<li class="task" style="color:var(--text-muted);font-style:italic">Diese Woche nichts!</li>';
    return;
  }
  tasks.forEach(t => {
    const done = isDone(t.id, t.periodKey);
    const li = document.createElement('li');
    li.className = `task ${done ? 'done' : ''}`;
    li.innerHTML = `
      <input type="checkbox" ${done ? 'checked' : ''}>
      <span class="task-name">${t.name}</span>
      ${t.biweekly ? '<span class="badge biweekly">2 Wo.</span>' : ''}`;
    li.querySelector('input').addEventListener('change', () => toggleScheduled(t.id, t.periodKey));
    el.appendChild(li);
  });
}

function renderAssignedList(elId, taskList, periodNum, periodKey) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  taskList.forEach(t => {
    const person = assignPerson(taskList, t.id, periodNum);
    const done = isDone(t.id, periodKey);
    const li = document.createElement('li');
    li.className = `task ${person.toLowerCase()} ${done ? 'done' : ''}`;
    li.innerHTML = `
      <input type="checkbox" ${done ? 'checked' : ''}>
      <span class="task-name">${t.name}</span>
      <span class="badge ${person.toLowerCase()}">${person}</span>`;
    li.querySelector('input').addEventListener('change', () => toggleScheduled(t.id, periodKey));
    el.appendChild(li);
  });
}

function renderHistory() {
  const el = document.getElementById('history-content');
  const entries = Object.values(state.history || {})
    .filter(h => h && h.ts)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-style:italic">Noch nichts erledigt.</p>';
    return;
  }
  el.innerHTML = entries.slice(0, 20).map(h => {
    const d = new Date(h.ts);
    const dateStr = d.toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="hist-entry"><strong>${h.by}</strong> hat <em>${h.task}</em> gemacht · ${dateStr}</div>`;
  }).join('');
}

// ─── Init UI ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      const btn = document.getElementById('copy-btn');
      btn.textContent = '✓ Kopiert!';
      setTimeout(() => btn.textContent = 'Kopieren', 2000);
    });
  });
  document.getElementById('dismiss-btn').addEventListener('click', () => {
    document.getElementById('share-banner').classList.add('hidden');
  });
  document.getElementById('reset-btn').addEventListener('click', resetAll);
  init();
});
