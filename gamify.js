// Gamification layer for Carbon Footprint Tracker (confetti behavior fixed)
// Self-contained file — load this AFTER app.js in your HTML.
// Example: <script src="app.js" type="text/babel"></script>
//          <script src="gamify.js"></script>
(function () {
  const STORAGE_KEY = 'carbon_gamify_v1';
  const STATE_DEFAULT = {
    points: 0,
    badges: [],
    calcCount: 0,
    lastCalcDate: null,
    streak: 0,
    events: [] // {date, tracker, total, points}
  };

  // Lightweight built-in confetti (used if no external confetti lib is present)
  (function ensureConfetti() {
    if (window.confetti && typeof window.confetti === 'function') return;
    // Minimal canvas confetti implementation
    window.confetti = function (opts = {}) {
      try {
        const count = opts.particleCount || opts.count || 60;
        const colors = opts.colors || ['#A8FF00', '#C7FF4C', '#76b900', '#E8F5E9'];
        const origin = opts.origin || { x: 0.5, y: 0.5 };
        const spread = (opts.spread || 60) * (Math.PI / 180);
        const scalar = opts.scalar || 1;
        const duration = opts.duration || 2200;

        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.pointerEvents = 'none';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.className = 'gamify-confetti-canvas';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const particles = [];
        for (let i = 0; i < count; i++) {
          const angle = (Math.random() - 0.5) * spread + Math.PI * (origin.x - 0.5);
          const speed = (Math.random() * 6 + 4) * scalar;
          particles.push({
            x: origin.x * canvas.width,
            y: origin.y * canvas.height,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * -1.2,
            size: (Math.random() * 6 + 4) * scalar,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 0.8 - 0.4,
            rot: Math.random() * Math.PI * 2,
            ttl: duration + Math.random() * 600
          });
        }

        let start = performance.now();
        function frame(now) {
          const t = now - start;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            // simple physics
            p.vy += 0.06 * scalar; // gravity
            p.vx *= 0.995;
            p.vy *= 0.997;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.tilt * 0.1;
            // draw
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
            p.ttl -= 16;
            // remove offscreen or expired
            if (p.y > canvas.height + 50 || p.ttl <= 0 || p.x < -50 || p.x > canvas.width + 50) {
              particles.splice(i, 1);
            }
          }
          if (particles.length > 0 && t < duration + 800) {
            requestAnimationFrame(frame);
          } else {
            // fade & remove
            canvas.style.transition = 'opacity 450ms ease';
            canvas.style.opacity = '0';
            setTimeout(() => { try { canvas.remove(); } catch (e) {} }, 500);
          }
        }
        requestAnimationFrame(frame);

        // resize handler
        const onResize = () => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', onResize);
        setTimeout(() => window.removeEventListener('resize', onResize), duration + 1000);
      } catch (e) {
        // silently fail if anything goes wrong
        console.warn('Gamify: confetti error', e);
      }
    };
  })();

  // Utility -----------------------------------------------------------------
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const nowISO = () => new Date().toISOString();
  const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { ...STATE_DEFAULT };
    } catch (e) {
      console.error('Gamify: failed to load state', e);
      return { ...STATE_DEFAULT };
    }
  };
  const saveState = (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  const mergeAndSave = (patch) => {
    state = Object.assign({}, state, patch);
    saveState(state);
  };

  // Toasts ------------------------------------------------------------------
  function showToast(msg, opts = {}) {
    const root = getOrCreateContainer();
    const t = document.createElement('div');
    t.className = 'gamify-toast';
    t.textContent = msg;
    if (opts.strong) {
      t.style.fontWeight = '700';
    }
    root.appendChild(t);
    // auto remove
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(-6px)';
      setTimeout(() => t.remove(), 350);
    }, opts.duration || 2800);
  }

  // Notification helpers (opt-in + simple best-effort reminder) -------------
  function requestNotificationPermission() {
    try {
      if (!('Notification' in window)) {
        // Notifications not supported
        return;
      }
      // Only ask if the user hasn't decided yet
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try { showToast("Notifications enabled — we'll remind you to track daily 🌱", { duration: 3000 }); } catch (e) {}
            localStorage.setItem('gamify_notify_optin', 'granted');
          } else {
            localStorage.setItem('gamify_notify_optin', 'denied');
          }
        }).catch(err => {
          console.warn('Gamify: Notification permission request failed', err);
        });
      }
    } catch (e) {
      console.warn('Gamify: requestNotificationPermission error', e);
    }
  }

  /* 
    scheduleReminder(delayMs)
    - Best-effort reminder using setTimeout (works while the tab is open).
    - We also set a timestamp in localStorage so we don't schedule duplicate reminders.
    - Default delay is 24 hours; you can pass a different value (e.g. 6*60*60*1000 for 6 hours).
  */
  function scheduleReminder(title, delayMs = 24 * 60 * 60 * 1000) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const nextKey = 'gamify_next_reminder_ts';
      const now = Date.now();
      const scheduledTs = parseInt(localStorage.getItem(nextKey) || '0', 10);

      // If we already scheduled a reminder in the future, do nothing
      if (scheduledTs && scheduledTs > now) return;

      // store next scheduled ts
      const nextTs = now + delayMs;
      localStorage.setItem(nextKey, String(nextTs));

      // Best-effort timeout; will only fire while this page/tab is open
      setTimeout(() => {
        try {
          if (Notification.permission === 'granted') {
            const n = new Notification(title || 'Reminder: track your carbon footprint today!', {
              body: 'Open the Carbon Tracker to log activity and earn points.',
            });
            // clear stored timestamp so a new reminder can be scheduled later
            localStorage.removeItem(nextKey);
            // optionally close notification automatically after some time
            setTimeout(() => { try { n.close(); } catch (e) {} }, 6_000);
          }
        } catch (e) {
          console.warn('Gamify: scheduleReminder notify error', e);
        }
      }, delayMs);
    } catch (e) {
      console.warn('Gamify: scheduleReminder error', e);
    }
  }

  // UI: floating button + modal ----------------------------------------------
  let state = loadState();

  function createStyles() {
    if (document.getElementById('gamify-styles')) return;
    const s = document.createElement('style');
    s.id = 'gamify-styles';
    s.textContent = `
#gamify-root { position: fixed; right: 18px; bottom: 18px; z-index: 99999; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
.gamify-fab { background: linear-gradient(90deg,#A8FF00,#C7FF4C); color: #000; border-radius: 999px; padding: 10px 14px; box-shadow: 0 8px 26px rgba(10,150,0,0.16); cursor: pointer; display:flex; gap:10px; align-items:center; min-width:58px; justify-content:center; }
.gamify-fab .count { font-weight:700; font-size:14px; }
.gamify-modal { position: fixed; right: 20px; bottom: 84px; width: 360px; max-width: calc(100% - 40px); background: rgba(8,10,8,0.96); color: #cfeec2; border: 1px solid rgba(168,255,0,0.07); border-radius: 12px; box-shadow: 0 18px 60px rgba(0,0,0,0.7); padding: 14px; z-index: 100000; display: none; flex-direction: column; gap:10px; }
.gamify-modal.open { display: flex; animation: gamifyModalIn .22s ease; }
@keyframes gamifyModalIn { from { transform: translateY(8px); opacity:0 } to { transform: translateY(0); opacity:1 } }
.gamify-header { display:flex; justify-content:space-between; align-items:center; gap:10px; }
.gamify-title { font-weight:800; color:#E8F5E9 }
.gamify-section { background: rgba(255,255,255,0.02); padding:10px; border-radius:8px; border:1px solid rgba(168,255,0,0.03); }
.gamify-badges { display:flex; gap:8px; flex-wrap:wrap; }
.gamify-badge { background: rgba(120,255,0,0.08); color:#001; padding:6px 8px; border-radius:999px; font-weight:700; font-size:12px; border:1px solid rgba(168,255,0,0.08); }
.gamify-history { max-height:160px; overflow:auto; font-size:13px; color:#bfe8b3; }
.gamify-actions { display:flex; gap:8px; }
.gamify-button { background: linear-gradient(90deg,#A8FF00,#C7FF4C); color:#000; padding:8px 10px; border-radius:8px; font-weight:700; cursor:pointer; border:none; flex:1; box-shadow:0 6px 18px rgba(10,150,0,0.06); }
.gamify-toast { position: relative; margin-top:8px; background: linear-gradient(90deg, rgba(168,255,0,0.12), rgba(199,255,76,0.08)); color:#001; padding:8px 14px; border-radius:10px; border:1px solid rgba(168,255,0,0.08); box-shadow:0 6px 20px rgba(0,0,0,0.5); transition: all .28s ease; opacity:1; }
.gamify-small { font-size:12px; color:#bfe8b3 }
.gamify-export { text-align:center; font-size:13px; color:#dfffd6; }
.gamify-confetti-canvas { pointer-events:none; z-index:2147483000; }
`;
    document.head.appendChild(s);
  }

  function getOrCreateContainer() {
    let root = document.getElementById('gamify-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'gamify-root';
    document.body.appendChild(root);
    return root;
  }

  function buildUI() {
    createStyles();
    const root = getOrCreateContainer();
    root.innerHTML = ''; // recreate on load
    const fab = document.createElement('button');
    fab.className = 'gamify-fab';
    fab.type = 'button';
    fab.title = 'Rewards & Achievements';
    fab.innerHTML = `<div style="display:flex;flex-direction:column;align-items:flex-start;line-height:1">
      <div style="font-size:11px;color:#0b2b00">Rewards</div>
      <div class="count">${state.points}</div>
    </div>
    <div style="width:36px;height:36px;border-radius:8px;background:rgba(0,0,0,0.06);display:flex;align-items:center;justify-content:center;font-weight:800">⚡</div>`;
    root.appendChild(fab);

    const modal = document.createElement('div');
    modal.className = 'gamify-modal';
    modal.innerHTML = `
      <div class="gamify-header">
        <div>
          <div class="gamify-title">Carbon Rewards</div>
          <div class="gamify-small">${state.points} points • ${state.badges.length} badges</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="gamify-button" id="gamify-export-btn" style="padding:6px 8px;font-size:13px;min-width:auto">Export</button>
          <button id="gamify-close" style="background:transparent;border:none;color:#bfe8b3;font-weight:700;cursor:pointer">✕</button>
        </div>
      </div>

      <div class="gamify-section">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800">Badges</div>
          <div class="gamify-small">Streak: <strong id="gamify-streak">${state.streak}</strong> days</div>
        </div>
        <div class="gamify-badges" id="gamify-badges-area" style="margin-top:8px"></div>
      </div>

      <div class="gamify-section">
        <div style="font-weight:800;margin-bottom:8px">Recent Activity</div>
        <div class="gamify-history" id="gamify-history">${renderHistoryItems(state.events)}</div>
      </div>

      <div style="display:flex;gap:8px">
        <button class="gamify-button" id="gamify-reset">Reset</button>
        <button class="gamify-button" id="gamify-import" style="background:transparent;border:1px solid rgba(168,255,0,0.06);color:#E8F5E9">Import</button>
      </div>

      <div class="gamify-export" style="margin-top:6px">You can export your rewards state or import a JSON file.</div>
    `;
    root.appendChild(modal);

    fab.addEventListener('click', () => {
      modal.classList.toggle('open');
    });
    qs('#gamify-close', modal).addEventListener('click', () => modal.classList.remove('open'));
    qs('#gamify-reset', modal).addEventListener('click', handleReset);
    qs('#gamify-export-btn', modal).addEventListener('click', handleExport);
    qs('#gamify-import', modal).addEventListener('click', handleImport);

    updateUI();
  }

  function renderHistoryItems(events = []) {
    if (!events.length) return '<div class="gamify-small">No activity yet — do a calculation to earn points.</div>';
    return events.slice(0, 30).map(ev => {
      const t = new Date(ev.date).toLocaleString();
      return `<div style="padding:6px 0;border-bottom:1px dashed rgba(168,255,0,0.02)"><div style="display:flex;justify-content:space-between"><div style="font-weight:700">${ev.tracker}</div><div style="font-weight:700">${ev.points} pts</div></div><div class="gamify-small">${t} • ${ev.total} kg CO₂e</div></div>`;
    }).join('');
  }

  function updateUI() {
    const root = getOrCreateContainer();
    const modal = qs('.gamify-modal', root);
    const fabCount = qs('.gamify-fab .count', root);
    if (fabCount) fabCount.textContent = state.points;
    const badgesArea = qs('#gamify-badges-area', modal);
    badgesArea.innerHTML = state.badges.length ? state.badges.map(b => `<div class="gamify-badge">${b}</div>`).join('') : '<div class="gamify-small">No badges yet</div>';
    qs('#gamify-history', modal).innerHTML = renderHistoryItems(state.events);
    qs('#gamify-streak', modal).textContent = state.streak;
  }

  // Gamification Logic -------------------------------------------------------
  function parseTotalFromResults() {
    // The app renders <p><strong>Total:</strong> {results.total} kg CO₂e</p>
    // Find any element with text "Total:" and parse number after it
    const nodes = qsa('.results p, .results div');
    for (const n of nodes) {
      const txt = (n.textContent || '').replace(/\u00A0/g, ' ').trim();
      if (/Total:/.test(txt)) {
        // extract number like 12.34
        const m = txt.match(/Total:\s*([0-9.,]+)/);
        if (m) {
          // normalize comma
          const num = parseFloat(m[1].replace(/,/g, ''));
          if (!isNaN(num)) return num;
        }
      }
    }
    return null;
  }

  function detectTrackerType(formEl) {
    // heuristic by heading before form
    if (!formEl) return 'Unknown';
    const prev = formEl.previousElementSibling;
    if (prev && /Personal/i.test(prev.textContent)) return 'Personal';
    if (prev && /Industrial/i.test(prev.textContent)) return 'Industrial';
    if (prev && /City/i.test(prev.textContent)) return 'City';
    // fallback: check form inputs presence
    if (qs('select[name="diet"]', formEl)) return 'Personal';
    if (qs('input[name="electricity"]', formEl) || qs('input[name="fuel"]', formEl)) return 'Industrial';
    if (qs('input[name="population"]', formEl) || qs('input[name="buildings"]', formEl)) return 'City';
    return 'General';
  }

  function awardForCalculation(tracker, total) {
    // Points formula (positive reinforcement: lower total -> more points)
    // base points + bonus depending on how low the footprint is
    const base = 12;
    const footprint = Math.max(0, Number(total) || 0);
    // bonus: if footprint under certain thresholds, grant more
    let bonus = 0;
    if (footprint <= 2) bonus = 60;
    else if (footprint <= 5) bonus = 40;
    else if (footprint <= 10) bonus = 20;
    else bonus = Math.max(0, Math.round(10 - footprint * 0.4)); // small negative slope
    const earned = Math.max(5, base + bonus);
    // update state
    state.points += earned;
    state.calcCount = (state.calcCount || 0) + 1;
    // update events
    state.events.unshift({ date: nowISO(), tracker, total: String(total), points: earned });
    // keep events reasonable length
    if (state.events.length > 200) state.events.length = 200;

    // badges
    const newBadges = [];
    if (!state.badges.includes('First Steps')) {
      newBadges.push('First Steps');
      state.badges.push('First Steps');
    }
    if (state.calcCount === 10 && !state.badges.includes('Deca-Tracker')) {
      state.badges.push('Deca-Tracker');
      newBadges.push('Deca-Tracker');
    }
    if (footprint <= 5 && !state.badges.includes('Eco Hero')) {
      state.badges.push('Eco Hero');
      newBadges.push('Eco Hero');
    }
    if (tracker === 'City' && footprint <= 2 && !state.badges.includes('City Saver')) {
      state.badges.push('City Saver');
      newBadges.push('City Saver');
    }

    // streak handling
    const today = todayKey();
    if (state.lastCalcDate === today) {
      // same day - do not update streak
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = todayKey(yesterday);
      if (state.lastCalcDate === yKey) {
        state.streak = (state.streak || 0) + 1;
      } else {
        state.streak = 1;
      }
      state.lastCalcDate = today;
    }

    saveState(state);
    updateUI();

    // show toast(s)
    showToast(`+${earned} pts • ${tracker} calculation (${total} kg CO₂e)`, { strong: true, duration: 2800 });

    // Determine whether we should fire confetti:
    // - if any new badge(s) were earned OR
    // - if earned points >= 12 (positive feedback threshold)
    const shouldConfetti = (newBadges.length > 0) || (earned >= 12);

    // If confetti is warranted, fire a single burst (prefer external library, fallback to built-in)
    if (shouldConfetti) {
      try {
        if (window.confetti && typeof window.confetti === 'function') {
          window.confetti({
            particleCount: Math.min(140, 40 + Math.round(Math.min(earned, 80))),
            spread: 70,
            origin: { x: 0.5, y: 0.6 },
            colors: ['#A8FF00', '#C7FF4C', '#76b900']
          });
        }
      } catch (e) {
        // ignore confetti errors
        console.warn('Gamify: confetti failed', e);
      }
    }

    // Show badge toasts (keep toasts but avoid firing confetti per badge)
    newBadges.forEach(b => {
      showToast(`Badge earned: ${b}`, { duration: 3200 });
    });

    // schedule a best-effort reminder for next day (24h)
    try {
      scheduleReminder('Don’t forget to log your carbon footprint today!', 24 * 60 * 60 * 1000);
    } catch (e) {
      console.warn('Gamify: failed to schedule reminder', e);
    }
  }

  function handleReset() {
    if (!confirm('Reset gamification data (points, badges, history)?')) return;
    state = { ...STATE_DEFAULT };
    saveState(state);
    updateUI();
    showToast('Gamification reset', { duration: 1800 });
  }

  function handleExport() {
    try {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carbon-gamify-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Exported rewards state', { duration: 1800 });
    } catch (e) {
      console.error(e);
      showToast('Export failed', { duration: 1800 });
    }
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const j = JSON.parse(reader.result);
          if (j && typeof j === 'object') {
            state = Object.assign({}, STATE_DEFAULT, j);
            saveState(state);
            updateUI();
            showToast('Import successful', { duration: 1800 });
          } else {
            throw new Error('Invalid JSON');
          }
        } catch (e) {
          console.error('Import error', e);
          alert('Import failed: invalid file');
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  // Hook into the app's calculations -----------------------------------------
  // We'll attach listeners to forms. When a form is submitted we wait a short
  // time and then parse the "Total:" displayed in the results pane and award points.
  function attachFormListeners() {
    // find forms on the page (they are mounted inside React root). Use delegation to catch forms that appear later.
    const root = document.querySelector('main#root') || document.body;
    // Use MutationObserver to catch forms created by React
    const processExisting = () => {
      qsa('form', root).forEach(form => {
        if (form.dataset.gamifyBound) return;
        form.dataset.gamifyBound = '1';
        form.addEventListener('submit', (ev) => {
          // allow React to process first: schedule after a short delay
          setTimeout(() => {
            const total = parseTotalFromResults();
            const tracker = detectTrackerType(form);
            if (total !== null) {
              awardForCalculation(tracker, total);
            } else {
              // fallback: try to parse history list (personal form writes to history too)
              // If not found, still award a small participation bonus
              state.points += 6;
              state.calcCount = (state.calcCount || 0) + 1;
              state.events.unshift({ date: nowISO(), tracker: detectTrackerType(form), total: 'n/a', points: 6 });
              state.lastCalcDate = todayKey();
              saveState(state);
              updateUI();
              showToast('+6 pts (calculation recorded)', { duration: 2000 });
              // schedule a reminder as well
              try { scheduleReminder('Don’t forget to log your carbon footprint today!', 24 * 60 * 60 * 1000); } catch (e) { console.warn(e); }
              // provide a small confetti for participation bonus
              try { if (window.confetti) window.confetti({ particleCount: 30, spread: 50 }); } catch (e) {}
            }
          }, 350);
        }, { capture: true });
      });
    };

    const mo = new MutationObserver(() => processExisting());
    mo.observe(root, { childList: true, subtree: true });
    // initial pass
    processExisting();
  }

  // Initialization -----------------------------------------------------------
  function init() {
    // Wait for DOM ready and for React root to exist
    const ready = () => {
      buildUI();
      attachFormListeners();
      // gentle greeting
      if ((state.events || []).length === 0) {
        showToast('Welcome! Do a calculation to start earning points 🌱', { duration: 3200 });
      } else {
        showToast(`Welcome back — ${state.points} points waiting`, { duration: 2100 });
      }

      // ask once (deferred) for Notification permission
      try {
        if (!localStorage.getItem('gamify_notify_asked')) {
          setTimeout(() => {
            requestNotificationPermission();
            localStorage.setItem('gamify_notify_asked', '1');
          }, 1400);
        }
      } catch (e) {
        console.warn('Gamify: notification opt-in scheduling failed', e);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ready);
    } else {
      ready();
    }
  }

  // Run
  init();

  // Expose a small debug API on window (non-enumerable)
  Object.defineProperty(window, 'CarbonGamify', {
    value: {
      getState: () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
      reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); },
      award: (tracker = 'Manual', pts = 10, total = 'n/a') => {
        state.points += pts;
        state.events.unshift({ date: nowISO(), tracker, total: String(total), points: pts });
        saveState(state);
        updateUI();
        // show some confetti for manual award
        try { window.confetti && window.confetti({ particleCount: 40, spread: 50 }); } catch (e) {}
        showToast(`+${pts} pts (manual)`);
      },
      // helper for testing confetti manually
      testConfetti: (opts = {}) => {
        try { window.confetti && window.confetti(Object.assign({ particleCount: 60, spread: 70 }, opts)); } catch (e) {}
      }
    },
    writable: false
  });
})();