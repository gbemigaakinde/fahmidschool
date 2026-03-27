/**
 * FAHMID NURSERY & PRIMARY SCHOOL
 * Inter-Class Mathematics Competition – Main App
 *
 * Architecture:
 *   • State machine: one phase at a time, no shared mutable globals
 *   • QuestionEngine: picks questions per class, never repeats
 *   • TimerController: zero-error countdown, single source of truth
 *   • MatchController: runs one match (group/quarter/semi/final)
 *   • TieController: handles 3-question theoretical tie-breaker
 *   • BreakController: timed intermission
 *   • BracketRenderer: draws SVG bracket
 *   • UI helpers: screen transitions, confetti, toasts
 */

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
  PRE_SEMI:    'PRE_SEMI',   // break before semi
  SEMI:        'SEMI',
  PRE_FINAL:   'PRE_FINAL',  // break before final
  FINAL:       'FINAL',
  CHAMPION:    'CHAMPION',
};

const ROUNDS = {
  GROUP:   5,
  QUARTER: 5,
  SEMI:    7,
  FINAL:   10,
};

const TIMER = {
  MCQ:     40,
  THEORY:  90,
  BREAK_SEMI:  3 * 60,
  BREAK_FINAL: 2 * 60,
};

const CLASS_LABELS = ['P1','P2','P3','P4','P5'];
const CLASS_FULL   = ['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5'];

/* ─────────────────────────────────────────────────────────────
   QUESTION ENGINE
   Tracks used question IDs per class to prevent repetition
───────────────────────────────────────────────────────────── */
const QuestionEngine = (() => {
  const used = { P1: new Set(), P2: new Set(), P3: new Set(), P4: new Set(), P5: new Set() };

  function pick(classKey, type = 'mcq') {
    const pool = window.QUESTIONS[classKey][type];
    const available = pool.filter(q => !used[classKey].has(q.id));
    if (!available.length) {
      console.warn(`Question pool exhausted for ${classKey} ${type}. Re-using questions.`);
      used[classKey].clear();
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const q = available[Math.floor(Math.random() * available.length)];
    used[classKey].add(q.id);
    return q;
  }

  function reset() {
    for (const k of Object.keys(used)) used[k].clear();
  }

  return { pick, reset };
})();

/* ─────────────────────────────────────────────────────────────
   TIMER CONTROLLER
───────────────────────────────────────────────────────────── */
const TimerController = (() => {
  let _interval = null;
  let _remaining = 0;
  let _total = 0;
  let _onTick = null;
  let _onEnd  = null;

  function start(seconds, onTick, onEnd) {
    stop();
    _remaining = seconds;
    _total = seconds;
    _onTick = onTick;
    _onEnd  = onEnd;
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
   GLOBAL STATE
───────────────────────────────────────────────────────────── */
const State = {
  stage: STAGE.IDLE,

  // 5 pairs: each = { boy: {name, class}, girl: {name, class} }
  contestants: [],

  // Group stage reps: reps[i] = winner from class i (0-indexed)
  groupReps: [],

  // Current match context
  match: null,

  // Bracket results
  quarterResults: [],   // [qf1winner, qf2winner]  (p5 is auto)
  semiWinner: null,
  finalWinner: null,

  // Which group class is currently playing (0-4)
  currentGroupClass: 0,
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
   BRACKET SVG RENDERER
───────────────────────────────────────────────────────────── */
function renderBracket() {
  const container = document.getElementById('bracket-svg-container');
  const reps = State.groupReps;
  const qr   = State.quarterResults;
  const sw   = State.semiWinner;
  const fw   = State.finalWinner;

  const W = 800, H = 400;
  const BOX_W = 140, BOX_H = 36;
  const COL = [20, 210, 400, 590];

  function boxX(col) { return COL[col]; }

  const data = [
    // QF matches
    { col: 0, y: 60,  name: reps[0] ? reps[0].name : '—', cls: 'P1', winner: qr[0] && qr[0].name === (reps[0]||{}).name },
    { col: 0, y: 120, name: reps[1] ? reps[1].name : '—', cls: 'P2', winner: qr[0] && qr[0].name === (reps[1]||{}).name },
    { col: 0, y: 220, name: reps[2] ? reps[2].name : '—', cls: 'P3', winner: qr[1] && qr[1].name === (reps[2]||{}).name },
    { col: 0, y: 280, name: reps[3] ? reps[3].name : '—', cls: 'P4', winner: qr[1] && qr[1].name === (reps[3]||{}).name },
    // P5 auto
    { col: 0, y: 350, name: reps[4] ? reps[4].name : '—', cls: 'P5 (Auto)', winner: false, auto: true },
  ];

  // SF
  const sf1 = { col: 1, y: 90,  name: qr[0] ? qr[0].name : '—', cls: qr[0] ? qr[0].classLabel : '—', winner: sw && sw.name === (qr[0]||{}).name };
  const sf2 = { col: 1, y: 250, name: qr[1] ? qr[1].name : '—', cls: qr[1] ? qr[1].classLabel : '—', winner: sw && sw.name === (qr[1]||{}).name };

  // Final
  const fn1 = { col: 2, y: 170, name: sw ? sw.name : '—', cls: sw ? sw.classLabel : '—', winner: fw && fw.name === (sw||{}).name };
  const fn2 = { col: 2, y: 320, name: reps[4] ? reps[4].name : '—', cls: 'P5', winner: fw && fw.name === (reps[4]||{}).name };

  // Winner
  const champ = { col: 3, y: 245, name: fw ? fw.name : '—', cls: fw ? fw.classLabel : '—' };

  function box(x, y, text, cls, isWinner, isAuto) {
    const fill = isWinner ? '#0FA9A0' : (isAuto ? '#C9922A' : '#1E2C2C');
    const tc   = isWinner ? '#0D1717' : '#FFFFFF';
    return `
      <rect x="${x}" y="${y}" width="${BOX_W}" height="${BOX_H}" rx="6" fill="${fill}" stroke="${isWinner ? '#0FA9A0' : '#3B5050'}" stroke-width="1.5"/>
      <text x="${x + 8}" y="${y + 13}" font-family="DM Sans,sans-serif" font-size="11" fill="${tc}" opacity="0.7">${cls}</text>
      <text x="${x + 8}" y="${y + 28}" font-family="Barlow Condensed,sans-serif" font-size="14" font-weight="700" fill="${tc}">${text.length > 18 ? text.slice(0,16)+'…' : text}</text>
    `;
  }

  function line(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3B5050" stroke-width="1.5"/>`;
  }

  const c0 = COL[0]; const c1 = COL[1]; const c2 = COL[2]; const c3 = COL[3];

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="DM Sans,sans-serif">`;

  // Labels
  svg += `<text x="${c0+BOX_W/2}" y="22" text-anchor="middle" font-size="11" fill="#8AADAD" letter-spacing="1" font-family="Barlow Condensed,sans-serif">QUARTER-FINAL</text>`;
  svg += `<text x="${c1+BOX_W/2}" y="22" text-anchor="middle" font-size="11" fill="#8AADAD" letter-spacing="1" font-family="Barlow Condensed,sans-serif">SEMI-FINAL</text>`;
  svg += `<text x="${c2+BOX_W/2}" y="22" text-anchor="middle" font-size="11" fill="#8AADAD" letter-spacing="1" font-family="Barlow Condensed,sans-serif">FINAL</text>`;
  svg += `<text x="${c3+BOX_W/2}" y="22" text-anchor="middle" font-size="11" fill="#C9922A" letter-spacing="1" font-family="Barlow Condensed,sans-serif">CHAMPION</text>`;

  // QF boxes
  data.forEach(d => { svg += box(c0, d.y, d.name, d.cls, d.winner, d.auto); });

  // QF connector lines
  const qfMid1 = (data[0].y + data[1].y + BOX_H) / 2;
  const qfMid2 = (data[2].y + data[3].y + BOX_H) / 2;
  svg += line(c0+BOX_W, data[0].y+BOX_H/2, c1, qfMid1);
  svg += line(c0+BOX_W, data[1].y+BOX_H/2, c1, qfMid1);
  svg += line(c0+BOX_W, data[2].y+BOX_H/2, c1, qfMid2);
  svg += line(c0+BOX_W, data[3].y+BOX_H/2, c1, qfMid2);

  // SF boxes
  svg += box(c1, sf1.y, sf1.name, sf1.cls, sf1.winner, false);
  svg += box(c1, sf2.y, sf2.name, sf2.cls, sf2.winner, false);

  // SF connector lines
  const sfMid = (sf1.y + sf2.y + BOX_H) / 2;
  svg += line(c1+BOX_W, sf1.y+BOX_H/2, c2, sfMid);
  svg += line(c1+BOX_W, sf2.y+BOX_H/2, c2, sfMid);

  // P5 auto → Final line
  svg += line(c0+BOX_W, data[4].y+BOX_H/2, c2, fn2.y+BOX_H/2);

  // Final boxes
  svg += box(c2, fn1.y, fn1.name, fn1.cls, fn1.winner, false);
  svg += box(c2, fn2.y, fn2.name, fn2.cls, fn2.winner, false);

  // Final connector
  const fnMid = (fn1.y + fn2.y + BOX_H) / 2;
  svg += line(c2+BOX_W, fn1.y+BOX_H/2, c3, fnMid);
  svg += line(c2+BOX_W, fn2.y+BOX_H/2, c3, fnMid);

  // Champion box
  svg += box(c3, champ.y-BOX_H/2, champ.name, champ.cls, true, false);

  svg += '</svg>';
  container.innerHTML = svg;
}

/* ─────────────────────────────────────────────────────────────
   MATCH CONTROLLER
   Manages a single head-to-head match
───────────────────────────────────────────────────────────── */
const Match = (() => {
  let ctx = null;

  function start(config) {
    // config: { left, right, rounds, stageLabel, onComplete }
    // left/right: { name, classKey, classLabel, role }
    ctx = {
      left:         config.left,
      right:        config.right,
      totalRounds:  config.rounds,
      stageLabel:   config.stageLabel,
      onComplete:   config.onComplete,
      scoreLeft:    0,
      scoreRight:   0,
      currentRound: 1,
      // alternate: even rounds → left answers, odd rounds → right
      // Actually: each round has ONE question asked to each player alternately
      // We simplify: each "round" = one question; players alternate who gets the question
      // round 1: left, round 2: right, round 3: left ...
      currentQuestion: null,
      answered: false,
    };
    showScreen('match');
    _renderHeader();
    _nextRound();
  }

  function _answererThisRound() {
    return ctx.currentRound % 2 === 1 ? 'left' : 'right';
  }

  function _renderHeader() {
    document.getElementById('match-stage-chip').textContent = ctx.stageLabel;
    document.getElementById('player-name-left').textContent  = ctx.left.name;
    document.getElementById('player-name-right').textContent = ctx.right.name;
    document.getElementById('player-class-left').textContent  = ctx.left.classLabel;
    document.getElementById('player-class-right').textContent = ctx.right.classLabel;
    document.getElementById('player-role-left').textContent  = ctx.left.role || '';
    document.getElementById('player-role-right').textContent = ctx.right.role || '';
    _updateScores();
  }

  function _updateScores() {
    document.getElementById('player-score-left').textContent  = ctx.scoreLeft;
    document.getElementById('player-score-right').textContent = ctx.scoreRight;
    document.getElementById('score-left-mini').textContent    = ctx.scoreLeft;
    document.getElementById('score-right-mini').textContent   = ctx.scoreRight;
  }

  function _nextRound() {
    if (ctx.currentRound > ctx.totalRounds) {
      _conclude();
      return;
    }

    const side       = _answererThisRound();
    const player     = side === 'left' ? ctx.left : ctx.right;
    const q          = QuestionEngine.pick(player.classKey, 'mcq');
    ctx.currentQuestion = { q, side };
    ctx.answered = false;

    // Update round display
    document.getElementById('match-round-info').textContent = `Round ${ctx.currentRound} of ${ctx.totalRounds}`;
    document.getElementById('q-counter').textContent = `Q ${ctx.currentRound}/${ctx.totalRounds}`;

    // Highlight answerer
    document.getElementById('player-card-left').classList.toggle('active-answerer', side === 'left');
    document.getElementById('player-card-right').classList.toggle('active-answerer', side === 'right');

    document.getElementById('question-whose').querySelector('#question-answerer').textContent = player.name;
    document.getElementById('question-text').textContent = q.q;

    _renderOptions(q);
    _hideOverlay();

    // Timer
    TimerController.start(
      TIMER.MCQ,
      (rem, tot) => _updateTimer(rem, tot),
      () => _handleTimeout()
    );
  }

  function _renderOptions(q) {
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    const letters = ['A','B','C','D'];
    letters.forEach((letter, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.letter = letter;
      btn.innerHTML = `
        <span class="option-letter">${letter}</span>
        <span class="option-text">${q.opts[i]}</span>
      `;
      btn.addEventListener('click', () => handleOptionClick(letter, btn));
      grid.appendChild(btn);
    });
  }

  function _updateTimer(remaining, total) {
    const pct = (remaining / total) * 100;
    const fill = document.getElementById('timer-fill');
    fill.style.width = pct + '%';
    fill.className = 'timer-fill' +
      (pct <= 25 ? ' danger' : pct <= 50 ? ' warn' : '');
    document.getElementById('timer-display').textContent = remaining;
    document.getElementById('timer-label').textContent = remaining === 1 ? 'second remaining' : 'seconds remaining';
  }

  function _handleTimeout() {
    if (ctx.answered) return;
    ctx.answered = true;
    _disableOptions();
    _showCorrectAnswer();
    _showOverlay(false, 'Time Up!');
    setTimeout(() => {
      _hideOverlay();
      ctx.currentRound++;
      _nextRound();
    }, 2000);
  }

  function handleOptionClick(letter, btnEl) {
    if (ctx.answered) return;
    ctx.answered = true;
    TimerController.stop();

    const isCorrect = (letter === ctx.currentQuestion.q.ans);
    if (isCorrect) {
      if (ctx.currentQuestion.side === 'left')  ctx.scoreLeft++;
      else ctx.scoreRight++;
      _updateScores();
    }

    // Visual feedback on all buttons
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.letter === ctx.currentQuestion.q.ans) btn.classList.add('correct');
      else if (btn.dataset.letter === letter && !isCorrect)  btn.classList.add('wrong');
    });

    _showOverlay(isCorrect, isCorrect ? 'Correct!' : 'Wrong!');
    setTimeout(() => {
      _hideOverlay();
      ctx.currentRound++;
      _nextRound();
    }, 2000);
  }

  function _disableOptions() {
    document.querySelectorAll('.option-btn').forEach(btn => { btn.disabled = true; });
  }

  function _showCorrectAnswer() {
    document.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.dataset.letter === ctx.currentQuestion.q.ans) btn.classList.add('correct');
    });
  }

  function _showOverlay(correct, msg) {
    const ov = document.getElementById('answer-overlay');
    const ic = document.getElementById('answer-icon');
    const ms = document.getElementById('answer-msg');
    ic.innerHTML = correct
      ? '<i class="fas fa-circle-check" style="color:var(--teal)"></i>'
      : '<i class="fas fa-circle-xmark" style="color:var(--red)"></i>';
    ms.textContent = msg;
    ov.classList.add('show');
  }

  function _hideOverlay() {
    document.getElementById('answer-overlay').classList.remove('show');
  }

  function _conclude() {
    TimerController.stop();
    // Determine winner
    if (ctx.scoreLeft === ctx.scoreRight) {
      // Tie! Go to tiebreaker
      TieBreaker.start({
        left:       ctx.left,
        right:      ctx.right,
        stageLabel: ctx.stageLabel,
        onWinner: (winner) => {
          _showResult(winner);
        }
      });
      return;
    }
    const winner = ctx.scoreLeft > ctx.scoreRight
      ? { ...ctx.left,  score: ctx.scoreLeft,  otherScore: ctx.scoreRight }
      : { ...ctx.right, score: ctx.scoreRight, otherScore: ctx.scoreLeft  };
    _showResult(winner);
  }

  function _showResult(winner) {
    const loser = winner.name === ctx.left.name
      ? { name: ctx.right.name, score: ctx.scoreRight }
      : { name: ctx.left.name,  score: ctx.scoreLeft  };
    const winnerScore = winner.name === ctx.left.name ? ctx.scoreLeft  : ctx.scoreRight;
    const loserScore  = winner.name === ctx.left.name ? ctx.scoreRight : ctx.scoreLeft;

    document.getElementById('result-label').textContent    = 'Round Winner';
    document.getElementById('result-name').textContent     = winner.name;
    document.getElementById('result-class').textContent    = winner.classLabel;
    document.getElementById('rsc-name-left').textContent   = ctx.left.name;
    document.getElementById('rsc-score-left').textContent  = ctx.scoreLeft;
    document.getElementById('rsc-name-right').textContent  = ctx.right.name;
    document.getElementById('rsc-score-right').textContent = ctx.scoreRight;

    spawnConfetti('result-confetti', 40);
    showScreen('result');

    document.getElementById('result-next-label').textContent = 'Continue';
    document.getElementById('result-next-btn').onclick = () => ctx.onComplete(winner);
  }

  return { start, handleOptionClick };
})();

/* ─────────────────────────────────────────────────────────────
   TIE-BREAKER CONTROLLER
───────────────────────────────────────────────────────────── */
const TieBreaker = (() => {
  let ctx = null;

  function start(config) {
    // config: { left, right, stageLabel, onWinner }
    ctx = {
      left:        config.left,
      right:       config.right,
      onWinner:    config.onWinner,
      // Each player gets 3 theory questions; first to get all 3 correct wins
      progressLeft:  [null, null, null],  // null / 'pass' / 'fail'
      progressRight: [null, null, null],
      queue: [],       // alternating: L0, R0, L1, R1, L2, R2
      queueIdx: 0,
      answered: false,
    };

    // Build queue: L0, R0, L1, R1, L2, R2
    for (let i = 0; i < 3; i++) {
      ctx.queue.push({ side: 'left',  q: QuestionEngine.pick(config.left.classKey,  'theory'), i });
      ctx.queue.push({ side: 'right', q: QuestionEngine.pick(config.right.classKey, 'theory'), i });
    }

    _renderUI();
    showScreen('tiebreaker');
    _nextQuestion();
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
  }

  function _nextQuestion() {
    ctx.answered = false;
    document.getElementById('tb-answer-input').value = '';
    document.getElementById('tb-result').textContent = '';
    document.getElementById('tb-result').className = 'tb-result';

    if (ctx.queueIdx >= ctx.queue.length) {
      // All questions done – decide by count
      const lPass = ctx.progressLeft.filter(x => x === 'pass').length;
      const rPass = ctx.progressRight.filter(x => x === 'pass').length;
      _decide(lPass, rPass);
      return;
    }

    const item   = ctx.queue[ctx.queueIdx];
    const player = item.side === 'left' ? ctx.left : ctx.right;

    document.getElementById('tb-answerer').textContent    = player.name;
    document.getElementById('tb-question-text').textContent = item.q.q;
    document.getElementById('tb-answer-input').focus();

    TimerController.start(
      TIMER.THEORY,
      (rem, tot) => {
        const pct = (rem / tot) * 100;
        document.getElementById('tb-timer-fill').style.width = pct + '%';
        document.getElementById('tb-timer-display').textContent = rem;
      },
      () => {
        if (ctx.answered) return;
        ctx.answered = true;
        const item = ctx.queue[ctx.queueIdx];
        _markAnswer(item.side, item.i, false);
        document.getElementById('tb-result').textContent = 'Time Up! Answer: ' + item.q.ans;
        document.getElementById('tb-result').className = 'tb-result fail';
        _checkEarlyWin();
        setTimeout(() => { ctx.queueIdx++; _nextQuestion(); }, 2500);
      }
    );
  }

  function _markAnswer(side, i, pass) {
    if (side === 'left')  ctx.progressLeft[i]  = pass ? 'pass' : 'fail';
    else                  ctx.progressRight[i] = pass ? 'pass' : 'fail';
    _updateChecks();
  }

  function _checkEarlyWin() {
    const lFails = ctx.progressLeft.filter(x => x === 'fail').length;
    const rFails = ctx.progressRight.filter(x => x === 'fail').length;
    const lPass  = ctx.progressLeft.filter(x => x === 'pass').length;
    const rPass  = ctx.progressRight.filter(x => x === 'pass').length;

    if (lPass === 3) { _finish(ctx.left);  return true; }
    if (rPass === 3) { _finish(ctx.right); return true; }
    return false;
  }

  function _decide(lPass, rPass) {
    if (lPass > rPass) _finish(ctx.left);
    else if (rPass > lPass) _finish(ctx.right);
    else {
      // True tie – left wins (could also be randomised; using alphabetical lower)
      toast('Perfect tie! Left player advances by coin toss rule.');
      _finish(ctx.left);
    }
  }

  function _finish(winner) {
    TimerController.stop();
    showScreen('idle'); // briefly, then result
    ctx.onWinner(winner);
  }

  function submit() {
    if (ctx.answered) return;
    const input = document.getElementById('tb-answer-input');
    const val   = input.value.trim();
    if (!val) { toast('Please enter an answer.', true); return; }

    ctx.answered = true;
    TimerController.stop();

    const item    = ctx.queue[ctx.queueIdx];
    const correct = _checkAnswer(val, item.q.ans);

    _markAnswer(item.side, item.i, correct);

    const res = document.getElementById('tb-result');
    if (correct) {
      res.textContent = '✓ Correct!';
      res.className   = 'tb-result pass';
    } else {
      res.textContent = '✗ Wrong. Answer: ' + item.q.ans;
      res.className   = 'tb-result fail';
    }

    if (_checkEarlyWin()) return;

    setTimeout(() => {
      ctx.queueIdx++;
      _nextQuestion();
    }, 2500);
  }

  function _checkAnswer(userAns, correctAns) {
    // Flexible check: numeric match, keyword match
    const u = userAns.toLowerCase().replace(/[^a-z0-9.]/g,'');
    const c = correctAns.toLowerCase().replace(/[^a-z0-9.]/g,'');
    if (u === c) return true;
    // Try extracting first number from each
    const uNum = parseFloat(u);
    const cNum = parseFloat(c);
    if (!isNaN(uNum) && !isNaN(cNum) && uNum === cNum) return true;
    return false;
  }

  return { start, submit };
})();

/* ─────────────────────────────────────────────────────────────
   BREAK CONTROLLER
───────────────────────────────────────────────────────────── */
const BreakCtrl = (() => {
  function start(seconds, title, subtitle, onDone) {
    const total = seconds;
    document.getElementById('break-title').textContent    = title;
    document.getElementById('break-subtitle').textContent = subtitle;
    showScreen('break');

    TimerController.start(
      total,
      (rem, tot) => {
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        document.getElementById('break-countdown').textContent =
          `${m}:${String(s).padStart(2,'0')}`;
        document.getElementById('break-progress-fill').style.width =
          ((rem / tot) * 100) + '%';
      },
      () => { onDone(); }
    );
  }

  return { start };
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

  beginGroupStage() {
    // Collect names
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

    this._runGroupMatch(0);
  },

  _runGroupMatch(classIdx) {
    if (classIdx >= 5) {
      // All group matches done
      this._afterGroupStage();
      return;
    }
    const pair = State.contestants[classIdx];
    Match.start({
      left:       pair.boy,
      right:      pair.girl,
      rounds:     ROUNDS.GROUP,
      stageLabel: `GROUP STAGE · ${CLASS_LABELS[classIdx]}`,
      onComplete: (winner) => {
        State.groupReps.push(winner);
        // Show result then proceed
        document.getElementById('result-next-btn').onclick = () => {
          App._runGroupMatch(classIdx + 1);
        };
      }
    });
  },

  _afterGroupStage() {
    State.stage = STAGE.BRACKET;
    renderBracket();
    document.getElementById('bracket-stage-label').textContent = 'Quarter-Final';
    document.getElementById('bracket-proceed-btn').textContent = 'Start Quarter-Final';
    document.getElementById('bracket-proceed-btn').onclick = () => App._runQuarterFinal();
    showScreen('bracket');
  },

  _runQuarterFinal() {
    // QF1: P1 vs P2
    State.stage = STAGE.QUARTER;
    Match.start({
      left:       State.groupReps[0],
      right:      State.groupReps[1],
      rounds:     ROUNDS.QUARTER,
      stageLabel: 'QUARTER-FINAL · P1 vs P2',
      onComplete: (winner) => {
        winner.classLabel = winner.classLabel; // keep
        State.quarterResults[0] = winner;
        // Show result then QF2
        document.getElementById('result-next-btn').onclick = () => {
          App._runQF2();
        };
      }
    });
  },

  _runQF2() {
    Match.start({
      left:       State.groupReps[2],
      right:      State.groupReps[3],
      rounds:     ROUNDS.QUARTER,
      stageLabel: 'QUARTER-FINAL · P3 vs P4',
      onComplete: (winner) => {
        State.quarterResults[1] = winner;
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Semi-Final';
        document.getElementById('bracket-proceed-btn').textContent = 'Proceed to Semi-Final Break';
        document.getElementById('bracket-proceed-btn').onclick = () => App._preSemi();
        document.getElementById('result-next-btn').onclick = () => { showScreen('bracket'); };
      }
    });
  },

  _preSemi() {
    State.stage = STAGE.PRE_SEMI;
    BreakCtrl.start(
      TIMER.BREAK_SEMI,
      '3-Minute Break',
      'Rest up — the Semi-Final is next!',
      () => App._runSemi()
    );
  },

  _runSemi() {
    State.stage = STAGE.SEMI;
    Match.start({
      left:       State.quarterResults[0],
      right:      State.quarterResults[1],
      rounds:     ROUNDS.SEMI,
      stageLabel: 'SEMI-FINAL',
      onComplete: (winner) => {
        State.semiWinner = winner;
        renderBracket();
        document.getElementById('bracket-stage-label').textContent = 'Final';
        document.getElementById('bracket-proceed-btn').textContent = 'Proceed to Final Break';
        document.getElementById('bracket-proceed-btn').onclick = () => App._preFinal();
        document.getElementById('result-next-btn').onclick = () => { showScreen('bracket'); };
      }
    });
  },

  _preFinal() {
    State.stage = STAGE.PRE_FINAL;
    BreakCtrl.start(
      TIMER.BREAK_FINAL,
      '2-Minute Break',
      'The Grand Final is about to begin!',
      () => App._runFinal()
    );
  },

  _runFinal() {
    State.stage = STAGE.FINAL;
    const p5Rep = State.groupReps[4];
    Match.start({
      left:       State.semiWinner,
      right:      p5Rep,
      rounds:     ROUNDS.FINAL,
      stageLabel: 'THE GRAND FINAL',
      onComplete: (winner) => {
        State.finalWinner = winner;
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
  },

  proceedFromBracket() {
    // Handled by individual onclick overrides
  },

  advanceAfterResult() {
    // Handled by result-next-btn onclick override
  },

  restart() {
    State.stage = STAGE.IDLE;
    State.contestants = [];
    State.groupReps = [];
    State.quarterResults = [];
    State.semiWinner = null;
    State.finalWinner = null;
    State.currentGroupClass = 0;
    QuestionEngine.reset();
    TimerController.stop();
    showScreen('idle');
    toast('Competition reset. Ready for a new session!');
  }
};

// Expose to HTML onclick attributes
window.App = App;

// Allow Enter key in tie-breaker input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('tb-answer-input');
  if (inp) {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') App.submitTBAnswer && App.submitTBAnswer();
    });
  }
});

App.submitTBAnswer = function() { TieBreaker.submit(); };
