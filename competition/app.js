'use strict';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const STAGE = {
  IDLE:        'IDLE',
  SETUP:       'SETUP',
  GROUP:       'GROUP',
  BRACKET:     'BRACKET',
  QUARTER:     'QUARTER',
  PRE_SEMI:    'PRE_SEMI',
  SEMI:        'SEMI',
  PRE_FINAL:   'PRE_FINAL',
  FINAL:       'FINAL',
  CHAMPION:    'CHAMPION',
};

const QUESTIONS_PER_PLAYER = {
  GROUP:   5,
  QUARTER: 5,
  SEMI:    7,
  FINAL:   10,
};

const TIMER = {
  MCQ:               50,
  THEORY_PER_PLAYER: 90,
  BREAK_SEMI:        3 * 60,
  BREAK_FINAL:       2 * 60,
  READY_COUNTDOWN:   10,
  UNDO_WINDOW:       5,
  RESULT_DISPLAY:    2500,
};

const CLASS_LABELS = ['P1','P2','P3','P4','P5'];
const CLASS_FULL   = ['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5'];
const STORAGE_KEY  = 'fahmid_competition_state';

/* ─────────────────────────────────────────────────────────────
   GHOST-CLICK SHIELD
   ─────────────────────────────────────────────────────────────
   Root cause:
     On mobile every tap fires:  touchstart → touchend → click
     The final synthetic "click" is queued by the browser and
     dispatched asynchronously — AFTER the current JS callstack
     finishes. When a tap on one screen causes a screen transition
     (e.g. tapping "Skip" on the Ready screen, or choosing an option
     on a previous question), the new screen's buttons are already
     in the DOM and hit-testable by the time that queued click fires.
     The click lands on whichever new button is at the same screen
     coordinates as the element that was originally tapped, making
     it look like an option was auto-selected.

     e.timeStamp does NOT reliably distinguish these ghost clicks:
     modern mobile browsers stamp the synthetic click with the time
     it is *dispatched* (already on the new screen), not the time
     the finger originally touched down.

   Fix — capture-phase swallow listener:
     A single listener is registered on `document` in the CAPTURE
     phase (runs before any element's own listener). While the shield
     is active it intercepts every "click" and "touchstart" whose
     target is an .option-btn and calls stopPropagation() +
     preventDefault(), consuming the event before any button handler
     can see it.

     The shield is:
       • Raised  (activate)   just before showScreen('match'), so it
                              is in place the moment buttons appear.
       • Lowered (deactivate) inside setTimeout after INPUT_GUARD_MS,
                              immediately before listeners are attached.

     500 ms is more than enough for any queued ghost click to have
     fired and been swallowed. After that window the shield is gone
     and real taps work normally.
───────────────────────────────────────────────────────────── */
const INPUT_GUARD_MS = 500;

const GhostClickShield = (() => {
  let _active = false;

  function _swallow(e) {
    if (!_active) return;
    if (e.target && e.target.closest && e.target.closest('.option-btn')) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  // Installed once, permanently, in capture phase so it always runs first.
  document.addEventListener('click',      _swallow, true);
  document.addEventListener('touchstart', _swallow, { capture: true, passive: false });

  return {
    activate()   { _active = true;  },
    deactivate() { _active = false; },
  };
})();

/* ─────────────────────────────────────────────────────────────
   QUESTION ENGINE
───────────────────────────────────────────────────────────── */
const QuestionEngine = (() => {
  const used = { P1: new Set(), P2: new Set(), P3: new Set(), P4: new Set(), P5: new Set() };

  function pick(classKey, type = 'mcq') {
    const pool = window.QUESTIONS[classKey][type];
    const available = pool.filter(q => !used[classKey].has(q.id));
    if (!available.length) {
      console.warn(`Question pool exhausted for ${classKey} ${type}. Re-using.`);
      used[classKey].clear();
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const q = available[Math.floor(Math.random() * available.length)];
    used[classKey].add(q.id);
    return q;
  }

  function getUsed() {
    const out = {};
    for (const k of Object.keys(used)) out[k] = [...used[k]];
    return out;
  }

  function restoreUsed(data) {
    for (const k of Object.keys(used)) {
      used[k].clear();
      if (data && data[k]) data[k].forEach(id => used[k].add(id));
    }
  }

  function reset() {
    for (const k of Object.keys(used)) used[k].clear();
  }

  return { pick, getUsed, restoreUsed, reset };
})();

/* ─────────────────────────────────────────────────────────────
   TIMER CONTROLLER
───────────────────────────────────────────────────────────── */
const TimerController = (() => {
  let _interval  = null;
  let _remaining = 0;
  let _total     = 0;
  let _onTick    = null;
  let _onEnd     = null;

  function start(seconds, onTick, onEnd) {
    stop();
    _remaining = seconds;
    _total     = seconds;
    _onTick    = onTick;
    _onEnd     = onEnd;
    _tick();
    _interval = setInterval(_tick, 1000);
  }

  function _tick() {
    if (_onTick) _onTick(_remaining, _total);
    if (_remaining <= 0) {
      stop();
      if (_onEnd) _onEnd();
      return;
    }
    _remaining--;
  }

  function stop() {
    if (_interval !== null) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  function forceEnd() {
    stop();
    if (_onEnd) _onEnd();
  }

  return { start, stop, forceEnd };
})();

/* ─────────────────────────────────────────────────────────────
   PERSISTENCE — LocalStorage
───────────────────────────────────────────────────────────── */
const Persist = (() => {
  function save() {
    try {
      const snapshot = {
        stage:             State.stage,
        contestants:       State.contestants,
        groupReps:         State.groupReps,
        quarterResults:    State.quarterResults,
        semiWinner:        State.semiWinner,
        finalWinner:       State.finalWinner,
        currentGroupClass: State.currentGroupClass,
        matchScores:       State.matchScores,
        usedQuestions:     QuestionEngine.getUsed(),
        savedAt:           Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { save, load, clear };
})();

/* ─────────────────────────────────────────────────────────────
   GLOBAL STATE
───────────────────────────────────────────────────────────── */
const State = {
  stage: STAGE.IDLE,
  contestants:    [],
  groupReps:      [],
  match:          null,
  quarterResults: [],
  semiWinner:     null,
  finalWinner:    null,
  currentGroupClass: 0,
  _nextCallback:  null,
  matchScores:    {},
};

/* ─────────────────────────────────────────────────────────────
   SCREEN TRANSITIONS
───────────────────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const s = document.getElementById('screen-' + id);
  if (s) s.classList.add('active');
}

/* ─────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────── */
function toast(msg, isError = false) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.innerHTML = `<i class="fas fa-${isError ? 'triangle-exclamation' : 'circle-info'}"></i>${msg}`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'toast-out 0.3s ease both';
    setTimeout(() => t.remove(), 350);
  }, 3500);
}

/* ─────────────────────────────────────────────────────────────
   CONFETTI
───────────────────────────────────────────────────────────── */
function spawnConfetti(containerId, count = 60) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  const colors = ['var(--teal)','var(--white)','var(--gold)','var(--red)','var(--teal-lt)'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${2 + Math.random() * 3}s;
      animation-delay: ${Math.random() * 1.5}s;
    `;
    el.appendChild(p);
  }
}

/* ─────────────────────────────────────────────────────────────
   SETUP SCREEN BUILDER
───────────────────────────────────────────────────────────── */
function buildSetupForm() {
  const container = document.getElementById('class-rows');
  container.innerHTML = '';
  CLASS_LABELS.forEach((label, i) => {
    const row = document.createElement('div');
    row.className = 'class-row';
    row.innerHTML = `
      <div class="class-row-title">
        <i class="fas fa-users"></i>
        ${CLASS_FULL[i]}
      </div>
      <div class="class-row-inputs">
        <div class="input-field">
          <label><i class="fas fa-mars"></i> Boy's Name</label>
          <input type="text" id="boy-${i}" placeholder="Enter boy's name" maxlength="40" autocomplete="off">
        </div>
        <div class="input-field">
          <label><i class="fas fa-venus"></i> Girl's Name</label>
          <input type="text" id="girl-${i}" placeholder="Enter girl's name" maxlength="40" autocomplete="off">
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

/* ─────────────────────────────────────────────────────────────
   READY SCREEN
───────────────────────────────────────────────────────────── */
const ReadyScreen = (() => {
  let _interval = null;
  let _onDone   = null;

  function show(player, questionNumber, totalQuestions, onDone) {
    _onDone = onDone;
    if (_interval) clearInterval(_interval);

    document.getElementById('ready-player-name').textContent  = player.name;
    document.getElementById('ready-player-class').textContent = player.classLabel;
    document.getElementById('ready-q-info').textContent =
      `Question ${questionNumber} of ${totalQuestions}`;
    document.getElementById('ready-instruction').textContent =
      `Get ready — your question is coming up!`;

    let remaining = TIMER.READY_COUNTDOWN;
    document.getElementById('ready-countdown').textContent = remaining;
    showScreen('ready');

    _interval = setInterval(() => {
      remaining--;
      document.getElementById('ready-countdown').textContent = remaining;
      if (remaining <= 0) {
        clearInterval(_interval);
        _interval = null;
        if (_onDone) _onDone();
      }
    }, 1000);
  }

  function skip() {
    if (_interval) { clearInterval(_interval); _interval = null; }
    if (_onDone) { const cb = _onDone; _onDone = null; cb(); }
  }

  return { show, skip };
})();

/* ─────────────────────────────────────────────────────────────
   BRACKET SVG RENDERER
───────────────────────────────────────────────────────────── */
function renderBracket() {
  const container = document.getElementById('bracket-svg-container');
  const reps = State.groupReps;
  const qr   = State.quarterResults;
  const sw   = State.semiWinner;
  const fw   = State.finalWinner;
  const ms   = State.matchScores;

  const W = 800, H = 420;
  const BOX_W = 145, BOX_H = 38;
  const COL = [20, 215, 415, 605];

  const data = [
    { col: 0, y: 65,  name: reps[0] ? reps[0].name : '—', cls: 'P1', winner: qr[0] && qr[0].name === (reps[0]||{}).name },
    { col: 0, y: 125, name: reps[1] ? reps[1].name : '—', cls: 'P2', winner: qr[0] && qr[0].name === (reps[1]||{}).name },
    { col: 0, y: 230, name: reps[2] ? reps[2].name : '—', cls: 'P3', winner: qr[1] && qr[1].name === (reps[2]||{}).name },
    { col: 0, y: 290, name: reps[3] ? reps[3].name : '—', cls: 'P4', winner: qr[1] && qr[1].name === (reps[3]||{}).name },
    { col: 0, y: 365, name: reps[4] ? reps[4].name : '—', cls: 'P5 (Auto)', winner: false, auto: true },
  ];

  const sf1   = { col: 1, y: 95,  name: qr[0] ? qr[0].name : '—', cls: qr[0] ? qr[0].classLabel : '—', winner: sw && sw.name === (qr[0]||{}).name };
  const sf2   = { col: 1, y: 260, name: qr[1] ? qr[1].name : '—', cls: qr[1] ? qr[1].classLabel : '—', winner: sw && sw.name === (qr[1]||{}).name };
  const fn1   = { col: 2, y: 178, name: sw  ? sw.name  : '—', cls: sw  ? sw.classLabel  : '—', winner: fw && fw.name === (sw||{}).name };
  const fn2   = { col: 2, y: 330, name: reps[4] ? reps[4].name : '—', cls: 'P5', winner: fw && fw.name === (reps[4]||{}).name };
  const champ = { col: 3, y: 254, name: fw ? fw.name : '—', cls: fw ? fw.classLabel : '—' };

  function truncate(s) { return s.length > 18 ? s.slice(0,16)+'…' : s; }

  function box(x, y, text, cls, isWinner, isAuto, scoreLabel) {
    const fill   = isWinner ? '#00C4BB' : (isAuto ? '#D4A017' : '#1C2C2C');
    const stroke = isWinner ? '#00C4BB' : (isAuto ? '#D4A017' : '#2A3E3E');
    const tc     = isWinner ? '#090F0F' : '#FFFFFF';
    const clrTc  = isWinner ? 'rgba(9,15,15,0.65)' : '#7AACAC';
    const score  = (isWinner && scoreLabel)
      ? `<text x="${x+BOX_W-6}" y="${y+28}" text-anchor="end" font-family="Space Mono,monospace" font-size="11" font-weight="700" fill="${tc}" opacity="0.8">${scoreLabel}</text>`
      : '';
    return `
      <rect x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <text x="${x+9}" y="${y+14}" font-family="DM Sans,sans-serif" font-size="10" fill="${clrTc}" font-weight="600">${cls}</text>
      <text x="${x+9}" y="${y+29}" font-family="Barlow Condensed,sans-serif" font-size="15" font-weight="700" fill="${tc}">${truncate(text)}</text>
      ${score}
    `;
  }

  function line(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2A3E3E" stroke-width="1.5"/>`;
  }

  function scoreFor(key) {
    const s = ms[key];
    if (!s) return null;
    return `${s.scoreLeft}–${s.scoreRight}`;
  }

  const c0=COL[0], c1=COL[1], c2=COL[2], c3=COL[3];
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  const labelStyle = `font-family="Barlow Condensed,sans-serif" font-size="10" fill="#7AACAC" letter-spacing="2"`;
  svg += `<text x="${c0+BOX_W/2}" y="24" text-anchor="middle" ${labelStyle}>QUARTER-FINAL</text>`;
  svg += `<text x="${c1+BOX_W/2}" y="24" text-anchor="middle" ${labelStyle}>SEMI-FINAL</text>`;
  svg += `<text x="${c2+BOX_W/2}" y="24" text-anchor="middle" ${labelStyle}>FINAL</text>`;
  svg += `<text x="${c3+BOX_W/2}" y="24" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-size="10" fill="#D4A017" letter-spacing="2">CHAMPION</text>`;

  data.forEach((d, i) => {
    const key   = i < 2 ? 'QF1' : (i < 4 ? 'QF2' : null);
    const score = (key && d.winner) ? scoreFor(key) : null;
    svg += box(c0, d.y, d.name, d.cls, d.winner, d.auto, score);
  });

  const qfMid1 = (data[0].y + data[1].y + BOX_H) / 2;
  const qfMid2 = (data[2].y + data[3].y + BOX_H) / 2;
  svg += line(c0+BOX_W, data[0].y+BOX_H/2, c1, qfMid1);
  svg += line(c0+BOX_W, data[1].y+BOX_H/2, c1, qfMid1);
  svg += line(c0+BOX_W, data[2].y+BOX_H/2, c1, qfMid2);
  svg += line(c0+BOX_W, data[3].y+BOX_H/2, c1, qfMid2);

  svg += box(c1, sf1.y, sf1.name, sf1.cls, sf1.winner, false, sf1.winner ? scoreFor('SF') : null);
  svg += box(c1, sf2.y, sf2.name, sf2.cls, sf2.winner, false, sf2.winner ? scoreFor('SF') : null);

  const sfMid = (sf1.y + sf2.y + BOX_H) / 2;
  svg += line(c1+BOX_W, sf1.y+BOX_H/2, c2, sfMid);
  svg += line(c1+BOX_W, sf2.y+BOX_H/2, c2, sfMid);
  svg += line(c0+BOX_W, data[4].y+BOX_H/2, c2, fn2.y+BOX_H/2);

  svg += box(c2, fn1.y, fn1.name, fn1.cls, fn1.winner, false, fn1.winner ? scoreFor('FINAL') : null);
  svg += box(c2, fn2.y, fn2.name, fn2.cls, fn2.winner, false, fn2.winner ? scoreFor('FINAL') : null);

  const fnMid = (fn1.y + fn2.y + BOX_H) / 2;
  svg += line(c2+BOX_W, fn1.y+BOX_H/2, c3, fnMid);
  svg += line(c2+BOX_W, fn2.y+BOX_H/2, c3, fnMid);

  svg += box(c3, champ.y-BOX_H/2, champ.name, champ.cls, true, false, null);
  svg += '</svg>';
  container.innerHTML = svg;
}

/* ─────────────────────────────────────────────────────────────
   MATCH CONTROLLER
───────────────────────────────────────────────────────────── */
const Match = (() => {
  let ctx           = null;
  let _undoSnapshot = null;
  let _undoTimeout  = null;

  function start(config) {
    ctx = {
      left:               config.left,
      right:              config.right,
      questionsPerPlayer: config.questionsPerPlayer,
      stageLabel:         config.stageLabel,
      scoreKey:           config.scoreKey || null,
      onComplete:         config.onComplete,
      scoreLeft:          0,
      scoreRight:         0,
      roundIdx:           0,
      currentQuestion:    null,
      answered:           false,
      _advanceTimeout:    null,
    };
    showScreen('match');
    _renderHeader();
    _doNextRound();
  }

  function _totalRounds() { return ctx.questionsPerPlayer * 2; }
  function _sideForRound(idx) { return idx % 2 === 0 ? 'left' : 'right'; }

  function _renderHeader() {
    document.getElementById('match-stage-chip').textContent   = ctx.stageLabel;
    document.getElementById('player-name-left').textContent   = ctx.left.name;
    document.getElementById('player-name-right').textContent  = ctx.right.name;
    document.getElementById('player-class-left').textContent  = ctx.left.classLabel;
    document.getElementById('player-class-right').textContent = ctx.right.classLabel;
    document.getElementById('player-role-left').textContent   = ctx.left.role || '';
    document.getElementById('player-role-right').textContent  = ctx.right.role || '';
    _updateScores();
  }

  function _updateScores() {
    document.getElementById('player-score-left').textContent  = ctx.scoreLeft;
    document.getElementById('player-score-right').textContent = ctx.scoreRight;
    document.getElementById('score-left-mini').textContent    = ctx.scoreLeft;
    document.getElementById('score-right-mini').textContent   = ctx.scoreRight;
  }

  function _doNextRound() {
    if (ctx.roundIdx >= _totalRounds()) {
      _conclude();
      return;
    }
    const side        = _sideForRound(ctx.roundIdx);
    const player      = side === 'left' ? ctx.left : ctx.right;
    const questionNum = Math.floor(ctx.roundIdx / 2) + 1;

    ReadyScreen.show(
      player,
      questionNum,
      ctx.questionsPerPlayer,
      () => _showQuestion(side, player, questionNum)
    );
  }

  function _showQuestion(side, player, questionNum) {
    const q = QuestionEngine.pick(player.classKey, 'mcq');
    ctx.currentQuestion = { q, side };
    ctx.answered = false;
    _undoSnapshot = null;
    _hideUndoButton();

    const totalQ       = _totalRounds();
    const displayRound = ctx.roundIdx + 1;
    document.getElementById('match-round-info').textContent = `Turn ${displayRound} of ${totalQ}`;
    document.getElementById('q-counter').textContent        = `Q ${questionNum}/${ctx.questionsPerPlayer}`;

    document.getElementById('player-card-left').classList.toggle('active-answerer',  side === 'left');
    document.getElementById('player-card-right').classList.toggle('active-answerer', side === 'right');

    document.getElementById('question-answerer').textContent = player.name;
    document.getElementById('question-text').textContent     = q.q;

    // Build disabled buttons with no listeners yet.
    // Shield goes up BEFORE showScreen so it is active the instant
    // the match screen (and its option buttons) become visible.
    _renderOptions(q);
    _hideOverlay();
    GhostClickShield.activate();
    showScreen('match');

    // After INPUT_GUARD_MS the ghost-click window has passed.
    // Drop the shield and wire up real click listeners.
    setTimeout(() => {
      GhostClickShield.deactivate();
      _enableOptions();
      TimerController.start(
        TIMER.MCQ,
        (rem, tot) => _updateTimer(rem, tot),
        () => _handleTimeout()
      );
    }, INPUT_GUARD_MS);
  }

  function _renderOptions(q) {
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    const letters = ['A','B','C','D'];
    letters.forEach((letter, i) => {
      const btn = document.createElement('button');
      btn.className      = 'option-btn';
      btn.dataset.letter = letter;
      btn.disabled       = true; // also disabled; shield is primary guard
      btn.innerHTML = `
        <span class="option-letter">${letter}</span>
        <span class="option-text">${q.opts[i]}</span>
      `;
      // No click listener here — added only in _enableOptions().
      grid.appendChild(btn);
    });
  }

  function _enableOptions() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = false;
      const letter = btn.dataset.letter;
      btn.addEventListener('click', () => handleOptionClick(letter, btn), { once: true });
    });
  }

  function _updateTimer(remaining, total) {
    const pct  = (remaining / total) * 100;
    const fill = document.getElementById('timer-fill');
    fill.style.width = pct + '%';
    fill.className   = 'timer-fill' +
      (pct <= 25 ? ' danger' : pct <= 50 ? ' warn' : '');
    document.getElementById('timer-display').textContent = remaining;
    document.getElementById('timer-label').textContent   =
      remaining === 1 ? 'second remaining' : 'seconds remaining';
  }

  function _handleTimeout() {
    if (ctx.answered) return;
    ctx.answered = true;
    _disableOptions();
    _showCorrectAnswer();
    _showOverlay(false, 'Time Up!', ctx.currentQuestion.q.ans);
    ctx._advanceTimeout = setTimeout(() => {
      _hideOverlay();
      ctx.roundIdx++;
      _doNextRound();
    }, TIMER.RESULT_DISPLAY);
  }

  function _saveUndoSnapshot() {
    _undoSnapshot = {
      roundIdx:   ctx.roundIdx,
      scoreLeft:  ctx.scoreLeft,
      scoreRight: ctx.scoreRight,
      question:   ctx.currentQuestion,
    };
  }

  function _showUndoButton() {
    const btn = document.getElementById('undo-answer-btn');
    if (!btn) return;
    btn.style.display = 'inline-flex';
    if (_undoTimeout) clearTimeout(_undoTimeout);
    _undoTimeout = setTimeout(() => {
      _hideUndoButton();
      _undoSnapshot = null;
    }, TIMER.UNDO_WINDOW * 1000);
  }

  function _hideUndoButton() {
    const btn = document.getElementById('undo-answer-btn');
    if (btn) btn.style.display = 'none';
    if (_undoTimeout) { clearTimeout(_undoTimeout); _undoTimeout = null; }
  }

  function handleOptionClick(letter, btnEl) {
    if (ctx.answered) return;
    ctx.answered = true;
    TimerController.stop();
    _saveUndoSnapshot();

    const isCorrect = (letter === ctx.currentQuestion.q.ans);
    if (isCorrect) {
      if (ctx.currentQuestion.side === 'left') ctx.scoreLeft++;
      else                                      ctx.scoreRight++;
      _updateScores();
      Persist.save();
    }

    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.letter === ctx.currentQuestion.q.ans) btn.classList.add('correct');
      else if (btn.dataset.letter === letter && !isCorrect)  btn.classList.add('wrong');
    });

    _showOverlay(isCorrect, isCorrect ? 'Correct!' : 'Wrong!', isCorrect ? '' : ctx.currentQuestion.q.ans);
    _showUndoButton();

    ctx._advanceTimeout = setTimeout(() => {
      _hideUndoButton();
      _undoSnapshot = null;
      _hideOverlay();
      ctx.roundIdx++;
      _doNextRound();
    }, TIMER.RESULT_DISPLAY);
  }

  function undoLastAnswer() {
    if (!_undoSnapshot) { toast('Nothing to undo.', true); return; }
    if (ctx._advanceTimeout) { clearTimeout(ctx._advanceTimeout); ctx._advanceTimeout = null; }
    _hideUndoButton();
    _hideOverlay();

    ctx.scoreLeft       = _undoSnapshot.scoreLeft;
    ctx.scoreRight      = _undoSnapshot.scoreRight;
    ctx.roundIdx        = _undoSnapshot.roundIdx;
    ctx.currentQuestion = _undoSnapshot.question;
    ctx.answered        = false;
    _undoSnapshot       = null;
    _updateScores();

    const q           = ctx.currentQuestion.q;
    const side        = ctx.currentQuestion.side;
    const player      = side === 'left' ? ctx.left : ctx.right;

    document.getElementById('player-card-left').classList.toggle('active-answerer',  side === 'left');
    document.getElementById('player-card-right').classList.toggle('active-answerer', side === 'right');
    document.getElementById('question-answerer').textContent = player.name;
    document.getElementById('question-text').textContent     = q.q;

    _renderOptions(q);
    GhostClickShield.activate();

    setTimeout(() => {
      GhostClickShield.deactivate();
      _enableOptions();
      TimerController.start(
        TIMER.MCQ,
        (rem, tot) => _updateTimer(rem, tot),
        () => _handleTimeout()
      );
    }, INPUT_GUARD_MS);

    toast('Answer undone — question restarted with a fresh timer.');
  }

  function _disableOptions() {
    document.querySelectorAll('.option-btn').forEach(btn => { btn.disabled = true; });
  }

  function _showCorrectAnswer() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.dataset.letter === ctx.currentQuestion.q.ans) btn.classList.add('correct');
    });
  }

  function _showOverlay(correct, msg, correctAns) {
    const ov = document.getElementById('answer-overlay');
    const ic = document.getElementById('answer-icon');
    const ms = document.getElementById('answer-msg');
    const ct = document.getElementById('answer-correct-text');
    ic.innerHTML = correct
      ? '<i class="fas fa-circle-check" style="color:var(--teal)"></i>'
      : '<i class="fas fa-circle-xmark" style="color:var(--red)"></i>';
    ms.textContent = msg;
    if (ct) ct.textContent = (!correct && correctAns) ? `Correct answer: ${correctAns}` : '';
    ov.classList.add('show');
  }

  function _hideOverlay() {
    document.getElementById('answer-overlay').classList.remove('show');
  }

  function _conclude() {
    TimerController.stop();
    if (ctx.scoreLeft === ctx.scoreRight) {
      TieBreaker.start({
        left:       ctx.left,
        right:      ctx.right,
        stageLabel: ctx.stageLabel,
        scoreKey:   ctx.scoreKey,
        onWinner:   (winner) => _showResult(winner),
      });
      return;
    }
    const winner = ctx.scoreLeft > ctx.scoreRight
      ? { ...ctx.left,  score: ctx.scoreLeft,  otherScore: ctx.scoreRight }
      : { ...ctx.right, score: ctx.scoreRight, otherScore: ctx.scoreLeft  };
    _showResult(winner);
  }

  function _showResult(winner) {
    if (ctx.scoreKey) {
      State.matchScores[ctx.scoreKey] = {
        scoreLeft:  ctx.scoreLeft,
        scoreRight: ctx.scoreRight,
        leftName:   ctx.left.name,
        rightName:  ctx.right.name,
      };
    }
    Persist.save();

    document.getElementById('result-label').textContent    = 'Round Winner';
    document.getElementById('result-name').textContent     = winner.name;
    document.getElementById('result-class').textContent    = winner.classLabel;
    document.getElementById('rsc-name-left').textContent   = ctx.left.name;
    document.getElementById('rsc-score-left').textContent  = ctx.scoreLeft;
    document.getElementById('rsc-name-right').textContent  = ctx.right.name;
    document.getElementById('rsc-score-right').textContent = ctx.scoreRight;

    spawnConfetti('result-confetti', 40);
    showScreen('result');
    State._nextCallback = () => ctx.onComplete(winner);
  }

  return { start, handleOptionClick, undoLastAnswer };
})();

/* ─────────────────────────────────────────────────────────────
   TIE-BREAKER CONTROLLER
───────────────────────────────────────────────────────────── */
const TieBreaker = (() => {
  let ctx = null;

  function start(config) {
    ctx = {
      left:           config.left,
      right:          config.right,
      onWinner:       config.onWinner,
      scoreKey:       config.scoreKey || null,
      progressLeft:   [null, null, null],
      progressRight:  [null, null, null],
      questionsLeft:  [],
      questionsRight: [],
      currentSide:    'left',
      currentQIdx:    0,
      answered:       false,
      timerTotal:     TIMER.THEORY_PER_PLAYER,
    };

    for (let i = 0; i < 3; i++) {
      ctx.questionsLeft.push(QuestionEngine.pick(config.left.classKey,  'theory'));
      ctx.questionsRight.push(QuestionEngine.pick(config.right.classKey, 'theory'));
    }

    _renderUI();
    showScreen('tiebreaker');
    _startPlayerBlock('left');
  }

  function _renderUI() {
    document.getElementById('tb-name-left').textContent  = ctx.left.name;
    document.getElementById('tb-name-right').textContent = ctx.right.name;
    _updateChecks();
  }

  function _updateChecks() {
    ['left','right'].forEach(side => {
      const progress = side === 'left' ? ctx.progressLeft : ctx.progressRight;
      const checks   = document.querySelectorAll(`#tb-checks-${side} .tb-check`);
      checks.forEach((ch, i) => {
        ch.className = 'tb-check';
        if (progress[i] === 'pass') {
          ch.className = 'tb-check pass';
          ch.innerHTML = '<i class="fas fa-circle-check"></i>';
        } else if (progress[i] === 'fail') {
          ch.className = 'tb-check fail';
          ch.innerHTML = '<i class="fas fa-circle-xmark"></i>';
        } else {
          ch.innerHTML = '<i class="fas fa-circle"></i>';
        }
      });
    });
    document.getElementById('tb-player-left').classList.toggle('active-tb',  ctx.currentSide === 'left');
    document.getElementById('tb-player-right').classList.toggle('active-tb', ctx.currentSide === 'right');
  }

  function _startPlayerBlock(side) {
    ctx.currentSide  = side;
    ctx.currentQIdx  = 0;
    ctx.answered     = false;
    _updateChecks();

    const player = side === 'left' ? ctx.left : ctx.right;
    ReadyScreen.show(
      player, 1, 3,
      () => {
        showScreen('tiebreaker');
        _startBlockTimer(side);
        _showTBQuestion();
      }
    );
  }

  function _startBlockTimer(side) {
    const total = TIMER.THEORY_PER_PLAYER;
    TimerController.start(
      total,
      (rem, tot) => {
        const pct = (rem / tot) * 100;
        document.getElementById('tb-timer-fill').style.width    = pct + '%';
        document.getElementById('tb-timer-fill').className      =
          'tb-timer-fill' + (pct <= 25 ? ' danger' : pct <= 50 ? ' warn' : '');
        document.getElementById('tb-timer-display').textContent = rem;
      },
      () => _onPlayerTimerEnd()
    );
  }

  function _onPlayerTimerEnd() {
    const progress = ctx.currentSide === 'left' ? ctx.progressLeft : ctx.progressRight;
    for (let i = ctx.currentQIdx; i < 3; i++) {
      if (progress[i] === null) progress[i] = 'fail';
    }
    _updateChecks();
    document.getElementById('tb-result').textContent = 'Time Up!';
    document.getElementById('tb-result').className   = 'tb-result fail';
    setTimeout(() => _endPlayerBlock(), 2000);
  }

  function _showTBQuestion() {
    ctx.answered = false;
    document.getElementById('tb-answer-input').value = '';
    document.getElementById('tb-result').textContent  = '';
    document.getElementById('tb-result').className    = 'tb-result';

    const questions = ctx.currentSide === 'left' ? ctx.questionsLeft : ctx.questionsRight;
    const player    = ctx.currentSide === 'left' ? ctx.left : ctx.right;
    const q         = questions[ctx.currentQIdx];

    document.getElementById('tb-answerer').textContent      = player.name;
    document.getElementById('tb-q-number').textContent      = `Question ${ctx.currentQIdx + 1} of 3`;
    document.getElementById('tb-question-text').textContent = q.q;

    setTimeout(() => {
      const inp = document.getElementById('tb-answer-input');
      if (inp) inp.focus();
    }, 150);
  }

  function submit() {
    if (ctx.answered) return;
    const input = document.getElementById('tb-answer-input');
    const val   = input.value.trim();
    if (!val) { toast('Please enter an answer.', true); return; }

    ctx.answered = true;
    const questions = ctx.currentSide === 'left' ? ctx.questionsLeft : ctx.questionsRight;
    const progress  = ctx.currentSide === 'left' ? ctx.progressLeft  : ctx.progressRight;
    const q       = questions[ctx.currentQIdx];
    const correct = _checkAnswer(val, q.ans);

    progress[ctx.currentQIdx] = correct ? 'pass' : 'fail';
    _updateChecks();

    const res = document.getElementById('tb-result');
    if (correct) {
      res.textContent = '✓ Correct!';
      res.className   = 'tb-result pass';
    } else {
      res.textContent = '✗ Wrong. Answer: ' + q.ans;
      res.className   = 'tb-result fail';
    }

    ctx.currentQIdx++;
    if (ctx.currentQIdx >= 3) {
      setTimeout(() => _endPlayerBlock(), 2000);
    } else {
      setTimeout(() => _showTBQuestion(), 2000);
    }
  }

  function _endPlayerBlock() {
    TimerController.stop();
    if (ctx.currentSide === 'left') {
      _startPlayerBlock('right');
    } else {
      const lPass = ctx.progressLeft.filter(x  => x === 'pass').length;
      const rPass = ctx.progressRight.filter(x => x === 'pass').length;
      _decide(lPass, rPass);
    }
  }

  function _decide(lPass, rPass) {
    if      (lPass > rPass) _finish(ctx.left);
    else if (rPass > lPass) _finish(ctx.right);
    else {
      toast('Perfect tie! Left player advances by coin-toss rule.');
      _finish(ctx.left);
    }
  }

  function _finish(winner) {
    TimerController.stop();
    ctx.onWinner(winner);
  }

  function _checkAnswer(userAns, correctAns) {
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const stripUnits = s => s
      .replace(/₦|naira/gi, '')
      .replace(/\bcm²?\b|\bm²?\b|\bkm²?\b|\bmm²?\b/gi, '')
      .replace(/\bkg\b|\bgrams?\b|\bml\b|\blitre?s?\b/gi, '')
      .replace(/%/g, '')
      .replace(/°/g, '')
      .replace(/degrees?/gi, '')
      .replace(/[,;:=]/g, ' ')
      .replace(/\s+/g, ' ').trim();

    const u = norm(userAns);
    const c = norm(correctAns);
    if (u === c) return true;

    const uStripped = stripUnits(u).replace(/[^0-9.\s-]/g, '').trim();
    const cStripped = stripUnits(c).replace(/[^0-9.\s-]/g, '').trim();
    const uNum = parseFloat(uStripped);
    const cNum = parseFloat(cStripped);
    if (!isNaN(uNum) && !isNaN(cNum) && uNum === cNum) return true;

    const extractNums = s => {
      const matches = s.match(/-?\d+(\.\d+)?/g);
      return matches ? matches.map(Number) : [];
    };
    const modelNums = extractNums(cStripped || c);
    const userNums  = extractNums(uStripped  || u);
    if (modelNums.length > 0) {
      const allPresent = modelNums.every(n => userNums.some(un => Math.abs(un - n) < 0.001));
      if (allPresent) return true;
    }

    const uClean = u.replace(/[^a-z0-9]/g, '');
    const cClean = c.replace(/[^a-z0-9]/g, '');
    if (uClean === cClean) return true;

    return false;
  }

  return { start, submit };
})();

/* ─────────────────────────────────────────────────────────────
   BREAK CONTROLLER
───────────────────────────────────────────────────────────── */
const BreakCtrl = (() => {
  let _onDone = null;

  function start(seconds, title, subtitle, onDone) {
    _onDone = onDone;
    document.getElementById('break-title').textContent    = title;
    document.getElementById('break-subtitle').textContent = subtitle;
    showScreen('break');

    TimerController.start(
      seconds,
      (rem, tot) => {
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        document.getElementById('break-countdown').textContent =
          `${m}:${String(s).padStart(2, '0')}`;
        document.getElementById('break-progress-fill').style.width =
          ((rem / tot) * 100) + '%';
      },
      () => { if (_onDone) _onDone(); }
    );
  }

  function skip() {
    TimerController.stop();
    if (_onDone) { const cb = _onDone; _onDone = null; cb(); }
  }

  return { start, skip };
})();

/* ─────────────────────────────────────────────────────────────
   MAIN APP CONTROLLER
───────────────────────────────────────────────────────────── */
const App = {

  goIdle() {
    State.stage = STAGE.IDLE;
    showScreen('idle');
  },

  startCompetition() {
    buildSetupForm();
    showScreen('setup');
    State.stage = STAGE.SETUP;
  },

  advanceAfterResult() {
    if (typeof State._nextCallback === 'function') {
      const cb = State._nextCallback;
      State._nextCallback = null;
      cb();
    }
  },

  beginGroupStage() {
    const contestants = [];
    for (let i = 0; i < 5; i++) {
      const boy  = (document.getElementById(`boy-${i}`)?.value || '').trim();
      const girl = (document.getElementById(`girl-${i}`)?.value || '').trim();
      if (!boy || !girl) {
        toast(`Please fill both names for ${CLASS_FULL[i]}.`, true);
        return;
      }
      contestants.push({
        boy:  { name: boy,  classKey: CLASS_LABELS[i], classLabel: CLASS_FULL[i], role: 'BOY' },
        girl: { name: girl, classKey: CLASS_LABELS[i], classLabel: CLASS_FULL[i], role: 'GIRL' },
      });
    }

    State.contestants = contestants;
    State.groupReps   = [];
    State.currentGroupClass = 0;
    State.stage = STAGE.GROUP;
    QuestionEngine.reset();
    Persist.save();
    this._runGroupMatch(0);
  },

  _runGroupMatch(classIdx) {
    if (classIdx >= 5) {
      this._afterGroupStage();
      return;
    }
    const pair = State.contestants[classIdx];
    Match.start({
      left:               pair.boy,
      right:              pair.girl,
      questionsPerPlayer: QUESTIONS_PER_PLAYER.GROUP,
      stageLabel:         `GROUP STAGE · ${CLASS_LABELS[classIdx]}`,
      scoreKey:           `GROUP_${CLASS_LABELS[classIdx]}`,
      onComplete: (winner) => {
        State.groupReps.push(winner);
        State.currentGroupClass = classIdx + 1;
        Persist.save();
        State._nextCallback = () => App._runGroupMatch(classIdx + 1);
      }
    });
  },

  _afterGroupStage() {
    State.stage = STAGE.BRACKET;
    Persist.save();
    renderBracket();
    document.getElementById('bracket-stage-label').textContent = 'Quarter-Final';
    showScreen('bracket');
  },

  proceedFromBracket() {
    if (State.stage === STAGE.BRACKET || State.stage === STAGE.GROUP) {
      this._runQuarterFinal();
    } else if (State.stage === STAGE.QUARTER) {
      this._preSemi();
    } else if (State.stage === STAGE.PRE_SEMI || State.stage === STAGE.SEMI) {
      this._preFinal();
    }
  },

  _runQuarterFinal() {
    State.stage = STAGE.QUARTER;
    Persist.save();
    Match.start({
      left:               State.groupReps[0],
      right:              State.groupReps[1],
      questionsPerPlayer: QUESTIONS_PER_PLAYER.QUARTER,
      stageLabel:         'QUARTER-FINAL · P1 vs P2',
      scoreKey:           'QF1',
      onComplete: (winner) => {
        State.quarterResults[0] = winner;
        Persist.save();
        State._nextCallback = () => App._runQF2();
      }
    });
  },

  _runQF2() {
    Match.start({
      left:               State.groupReps[2],
      right:              State.groupReps[3],
      questionsPerPlayer: QUESTIONS_PER_PLAYER.QUARTER,
      stageLabel:         'QUARTER-FINAL · P3 vs P4',
      scoreKey:           'QF2',
      onComplete: (winner) => {
        State.quarterResults[1] = winner;
        Persist.save();
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Semi-Final';
        State._nextCallback = () => showScreen('bracket');
      }
    });
  },

  _preSemi() {
    State.stage = STAGE.PRE_SEMI;
    Persist.save();
    BreakCtrl.start(
      TIMER.BREAK_SEMI,
      '3-Minute Break',
      'Rest up — the Semi-Final is next!',
      () => App._runSemi()
    );
  },

  _runSemi() {
    State.stage = STAGE.SEMI;
    Persist.save();
    Match.start({
      left:               State.quarterResults[0],
      right:              State.quarterResults[1],
      questionsPerPlayer: QUESTIONS_PER_PLAYER.SEMI,
      stageLabel:         'SEMI-FINAL',
      scoreKey:           'SF',
      onComplete: (winner) => {
        State.semiWinner = winner;
        Persist.save();
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Final';
        State._nextCallback = () => showScreen('bracket');
      }
    });
  },

  _preFinal() {
    State.stage = STAGE.PRE_FINAL;
    Persist.save();
    BreakCtrl.start(
      TIMER.BREAK_FINAL,
      '2-Minute Break',
      'The Grand Final is about to begin!',
      () => App._runFinal()
    );
  },

  _runFinal() {
    State.stage = STAGE.FINAL;
    Persist.save();
    const p5Rep = State.groupReps[4];
    Match.start({
      left:               State.semiWinner,
      right:              p5Rep,
      questionsPerPlayer: QUESTIONS_PER_PLAYER.FINAL,
      stageLabel:         'THE GRAND FINAL',
      scoreKey:           'FINAL',
      onComplete: (winner) => {
        State.finalWinner = winner;
        Persist.save();
        App._showChampion(winner);
      }
    });
  },

  _showChampion(winner) {
    document.getElementById('champ-name').textContent  = winner.name;
    document.getElementById('champ-class').textContent = winner.classLabel;
    spawnConfetti('champ-confetti', 120);
    showScreen('champion');
    State.stage = STAGE.CHAMPION;
    Persist.save();
  },

  restart() {
    State.stage             = STAGE.IDLE;
    State.contestants       = [];
    State.groupReps         = [];
    State.quarterResults    = [];
    State.semiWinner        = null;
    State.finalWinner       = null;
    State.currentGroupClass = 0;
    State._nextCallback     = null;
    State.matchScores       = {};
    QuestionEngine.reset();
    TimerController.stop();
    Persist.clear();
    showScreen('idle');
    toast('Competition reset. Ready for a new session!');
  },

  checkRestore() {
    const saved = Persist.load();
    if (!saved || !saved.stage || saved.stage === STAGE.IDLE) return;
    if (saved.stage === STAGE.CHAMPION) return;

    const banner = document.getElementById('restore-banner');
    if (!banner) return;

    const mins    = Math.round((Date.now() - (saved.savedAt || 0)) / 60000);
    const timeStr = mins < 2 ? 'just now' : `${mins} minutes ago`;
    document.getElementById('restore-message').textContent =
      `Unfinished competition found (saved ${timeStr}). Resume where you left off?`;

    banner.classList.add('show');

    document.getElementById('restore-yes-btn').onclick = () => {
      banner.classList.remove('show');
      App._restoreSession(saved);
    };
    document.getElementById('restore-no-btn').onclick = () => {
      banner.classList.remove('show');
      Persist.clear();
    };
  },

  _restoreSession(saved) {
    State.stage             = saved.stage;
    State.contestants       = saved.contestants       || [];
    State.groupReps         = saved.groupReps         || [];
    State.quarterResults    = saved.quarterResults    || [];
    State.semiWinner        = saved.semiWinner        || null;
    State.finalWinner       = saved.finalWinner       || null;
    State.currentGroupClass = saved.currentGroupClass || 0;
    State.matchScores       = saved.matchScores       || {};

    QuestionEngine.restoreUsed(saved.usedQuestions);

    switch (saved.stage) {
      case STAGE.GROUP:
        App._runGroupMatch(State.currentGroupClass);
        break;
      case STAGE.BRACKET:
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Quarter-Final';
        showScreen('bracket');
        break;
      case STAGE.QUARTER:
        renderBracket();
        if (State.quarterResults.length === 0) {
          App._runQuarterFinal();
        } else if (State.quarterResults.length === 1) {
          State.stage = STAGE.QUARTER;
          App._runQF2();
        } else {
          renderBracket();
          document.getElementById('bracket-stage-label').textContent = 'Semi-Final';
          State.stage = STAGE.BRACKET;
          showScreen('bracket');
        }
        break;
      case STAGE.PRE_SEMI:
      case STAGE.SEMI:
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Semi-Final';
        State.stage = STAGE.QUARTER;
        showScreen('bracket');
        break;
      case STAGE.PRE_FINAL:
      case STAGE.FINAL:
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Final';
        State.stage = STAGE.SEMI;
        showScreen('bracket');
        break;
      case STAGE.CHAMPION:
        if (State.finalWinner) App._showChampion(State.finalWinner);
        break;
      default:
        showScreen('idle');
    }
    toast('Session restored! Continue from where you left off.');
  },
};

/* ─────────────────────────────────────────────────────────────
   GLOBAL BINDINGS
───────────────────────────────────────────────────────────── */
window.App         = App;
window.BreakCtrl   = BreakCtrl;
window.Match       = Match;
window.ReadyScreen = ReadyScreen;

App.submitTBAnswer = function() { TieBreaker.submit(); };

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('tb-answer-input');
  if (inp) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') TieBreaker.submit();
    });
  }
  App.checkRestore();
});
