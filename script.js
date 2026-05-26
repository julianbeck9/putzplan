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

// ─── Setup-Error UI ───────────────────────────────────────────────
function showSetupError(htmlMessage) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  const el = document.getElementById('setup-error');
  el.innerHTML = `
    <div class="setup-box">
      <h1>🔧 Firebase-Setup nötig</h1>
      ${htmlMessage}
      <button onclick="location.reload()" class="reload-btn">Seite neu laden</button>
    </div>`;
  el.classList.remove('hidden');
}

// ─── Config-Check ─────────────────────────────────────────────────
if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey === 'PASTE_YOUR_API_KEY_HERE') {
  showSetupError(`
    <p>Trag deine Firebase-Daten in <code>firebase-config.js</code> ein.</p>
    <p style="font-size:13px;color:var(--text-muted);margin-top:12px">
      Anleitung in der Datei. Dauert ~5 Min:
      Google-Login → Projekt anlegen → Realtime Database aktivieren →
      Config kopieren → in firebase-config.js einfügen → push.
    </p>`);
  throw new Error('Firebase not configured');
}

// ─── Firebase Init ────────────────────────────────────────────────
try {
  firebase.initializeApp(firebaseConfig);
} catch (e) {
  showSetupError(`<p>Firebase-Init fehlgeschlagen:</p><p><code>${e.message}</code></p>`);
  throw e;
}
const db = firebase.database();

// ─── Room ID aus URL ──────────────────────────────────────────────
let isNewRoom = false;
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  let id = '';
  for (const b of arr) id += chars[b % chars.length];
  return id;
}
function getOrCreateRoomId() {
  const match = window.location.hash.match(/room=([a-zA-Z0-9_-]{16,})/);
  if (match) return match[1];
  const id = generateRoomId();
  window.history.replaceState(null, '', '#room=' + id);
  isNewRoom = true;
  return id;
}

const roomId = getOrCreateRoomId();
const roomRef = db.ref(`rooms/${roomId}`);

// ─── State ────────────────────────────────────────────────────────
let state = { turns: {}, done: {}, history: {} };
let firstSync = true;

roomRef.on('value', (snap) => {
  const val = snap.val() || {};
  state = {
    turns:   val.turns   || {},
    done:    val.done    || {},
    history: val.history || {},
  };
  setSyncStatus('online');

  if (firstSync) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (isNewRoom || !snap.exists()) showShareBanner();
    firstSync = false;
  }
  render();
}, (err) => {
  showSetupError(`
    <p>Datenbank-Zugriff fehlgeschlagen:</p>
    <p><code>${err.message}</code></p>
    <p style="font-size:13px;color:var(--text-muted);margin-top:12px">
      Wahrscheinlich fehlen die Realtime-Database-Regeln (Schritt 5
      der Anleitung in <code>firebase-config.js</code>).
    </p>`);
});

function setSyncStatus(status) {
  const el = document.getElementById('sync-indicator');
  el.classList.remove('connected', 'saving-state', 'offline-state', 'error-state');
  switch (status) {
    case 'online':  el.textContent = '● Live synchronisiert'; el.classList.add('connected'); break;
    case 'saving':  el.textContent = '⟳ Speichere…';         el.classList.add('saving-state'); break;
    case 'offline': el.textContent = '⚠ Offline';            el.classList.add('offline-state'); break;
    case 'error':   el.textContent = '⚠ Fehler';             el.classList.add('error-state'); break;
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
  const task = TASKS.rotating.find(t => t.id === taskId);
  const current = getTurn(taskId);
  const next = current === 'Julian' ? 'David' : 'Julian';
  roomRef.child(`turns/${taskId}`).set(next);
  const histKey = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  roomRef.child(`history/${histKey}`).set({ task: task.name, by: current, ts: new Date().toISOString() });
  // Trim auf max 30
  roomRef.child('history').once('value', s => {
    const all = s.val() || {};
    const keys = Object.keys(all).sort();
    if (keys.length > 30) keys.slice(0, keys.length - 30).forEach(k => roomRef.child(`history/${k}`).remove());
  });
}
function toggleScheduled(taskId, periodKey) {
  const key = `${periodKey}_${taskId}`;
  roomRef.child(`done/${key}`).set(isDone(taskId, periodKey) ? null : true);
}
function resetAll() {
  if (!confirm('Wirklich alles zurücksetzen? (Wer-ist-dran + Erledigt-Häkchen + Verlauf)')) return;
  roomRef.set({ turns: {}, done: {}, history: {} });
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
  setInterval(render, 60_000);
});
