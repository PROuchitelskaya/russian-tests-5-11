/* Тесты по русскому языку · 5–11 классы — Учительская */
(function () {
  "use strict";

  var DATA = window.TESTS_DATA;
  var STORE_KEY = DATA.meta.storeKey;
  var LETTERS = ["А", "Б", "В", "Г"];

  var $ = function (id) { return document.getElementById(id); };

  var views = {
    home: $("view-home"),
    quiz: $("view-quiz"),
    result: $("view-result")
  };

  /* ---------- хранилище ---------- */
  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (e) { return {}; }
  }
  function saveStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* приватный режим */ }
  }

  /* ---------- состояние ---------- */
  var state = {
    grade: null,      // объект класса из DATA
    idx: 0,           // номер текущего вопроса
    score: 0,
    locked: false,    // ответ уже дан
    optOrders: []     // перемешанный порядок вариантов для каждого вопроса
  };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function show(name) {
    Object.keys(views).forEach(function (k) {
      views[k].classList.toggle("hidden", k !== name);
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------- главная ---------- */
  function renderHome() {
    var store = loadStore();
    var grid = $("grade-grid");
    grid.innerHTML = "";
    DATA.grades.forEach(function (g) {
      var best = store[g.id];
      var card = document.createElement("button");
      card.type = "button";
      card.className = "grade-card";
      card.style.setProperty("--h", g.hue);
      card.setAttribute("aria-label", g.grade + ": " + g.topic);
      card.innerHTML =
        '<span class="gc-top"><span class="gc-grade">' + g.grade + "</span>" +
        '<span class="gc-chip">' + g.questions.length + " вопросов</span></span>" +
        '<span class="gc-topic">' + g.topic + "</span>" +
        '<p class="gc-desc">' + g.desc + "</p>" +
        '<span class="gc-meta">' +
        (best
          ? '<span class="gc-best">Лучший результат: ' + best.best + " / " + best.total + "</span>"
          : "<span>Тест ещё не пройден</span>") +
        '<span class="gc-go">Пройти →</span></span>';
      card.addEventListener("click", function () { startQuiz(g.id); });
      grid.appendChild(card);
    });
    show("home");
  }

  /* ---------- тест ---------- */
  function startQuiz(gradeId) {
    var grade = null;
    for (var i = 0; i < DATA.grades.length; i++) {
      if (DATA.grades[i].id === gradeId) { grade = DATA.grades[i]; break; }
    }
    if (!grade) { renderHome(); return; }

    state.grade = grade;
    state.idx = 0;
    state.score = 0;
    state.locked = false;
    state.optOrders = grade.questions.map(function () { return shuffle([0, 1, 2, 3]); });

    if (location.hash !== "#" + grade.id) {
      try { history.replaceState(null, "", "#" + grade.id); } catch (e) { location.hash = grade.id; }
    }

    $("quiz-grade").textContent = grade.grade;
    $("quiz-topic").textContent = grade.topic;
    renderQuestion();
    show("quiz");
  }

  function renderQuestion() {
    var g = state.grade;
    var q = g.questions[state.idx];
    var order = state.optOrders[state.idx];

    state.locked = false;

    $("counter").textContent = "Вопрос " + (state.idx + 1) + " из " + g.questions.length;
    $("progress-fill").style.width = (state.idx / g.questions.length * 100) + "%";
    $("q-text").textContent = q.q;

    var box = $("opts");
    box.innerHTML = "";
    order.forEach(function (origIdx, pos) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.dataset.orig = origIdx;
      b.innerHTML = '<span class="opt-letter">' + LETTERS[pos] + "</span><span>" + escapeHtml(q.options[origIdx]) + "</span>";
      b.addEventListener("click", function () { choose(b, origIdx); });
      box.appendChild(b);
    });

    var ex = $("explain");
    ex.classList.add("hidden");
    ex.classList.remove("correct");
    $("btn-next").classList.add("hidden");
    $("btn-next").textContent = state.idx === g.questions.length - 1 ? "К результату →" : "Дальше →";
  }

  function choose(btn, origIdx) {
    if (state.locked) return;
    state.locked = true;

    var q = state.grade.questions[state.idx];
    var correct = origIdx === q.answer;
    if (correct) state.score++;

    var buttons = $("opts").querySelectorAll(".opt");
    buttons.forEach(function (b) {
      b.disabled = true;
      var orig = parseInt(b.dataset.orig, 10);
      if (orig === q.answer) b.classList.add("good");
      else if (b === btn) b.classList.add("bad");
      else b.classList.add("dim");
    });

    var ex = $("explain");
    ex.classList.remove("hidden");
    ex.classList.toggle("correct", correct);
    $("explain-verdict").textContent = correct ? "Верно!" : "Не совсем.";
    $("explain-text").textContent = q.explain;

    $("progress-fill").style.width = ((state.idx + 1) / state.grade.questions.length * 100) + "%";
    $("btn-next").classList.remove("hidden");
    $("btn-next").focus({ preventScroll: true });
  }

  function next() {
    if (state.idx < state.grade.questions.length - 1) {
      state.idx++;
      renderQuestion();
    } else {
      finish();
    }
  }

  /* ---------- результат ---------- */
  function verdictFor(score, total) {
    var p = score / total;
    if (score === total) return ["Идеально!", "Ни одной ошибки. Тема усвоена на отлично."];
    if (p >= 0.9) return ["Блестяще!", "Почти максимум – вы отлично разобрались в теме."];
    if (p >= 0.7) return ["Отлично!", "Уверенный результат. Загляните в объяснения к ошибкам – и будет идеально."];
    if (p >= 0.5) return ["Хорошо!", "База есть. Перечитайте конспект урока и попробуйте ещё раз."];
    return ["Только начало", "Стоит перечитать материал урока – а потом вернуться к тесту. Всё получится!"];
  }

  function finish() {
    var g = state.grade;
    var total = g.questions.length;
    var score = state.score;

    var store = loadStore();
    var prev = store[g.id];
    if (!prev || score > prev.best) {
      store[g.id] = { best: score, total: total, when: new Date().toISOString() };
      saveStore(store);
    }

    $("result-grade").textContent = g.grade + " · " + g.topic;
    $("score-total").textContent = "из " + total;

    var v = verdictFor(score, total);
    $("verdict").textContent = v[0];
    $("verdict-sub").textContent = v[1];

    var ring = $("score-ring");
    var pct = Math.round(score / total * 100);
    ring.style.setProperty("--ring", score / total >= 0.7 ? "var(--good)" : "var(--accent)");

    show("result");
    animateScore(score, pct);
  }

  function animateScore(score, pct) {
    var num = $("score-num");
    var ring = $("score-ring");
    /* rAF в скрытых вкладках «замирает» – подстраховка setTimeout */
    if (document.hidden || !window.requestAnimationFrame) {
      num.textContent = String(score);
      ring.style.setProperty("--p", pct);
      return;
    }
    var t0 = null;
    var DUR = 700;
    var done = false;
    function tick(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / DUR);
      var e = 1 - Math.pow(1 - k, 3);
      num.textContent = String(Math.round(score * e));
      ring.style.setProperty("--p", pct * e);
      if (k < 1) requestAnimationFrame(tick);
      else done = true;
    }
    requestAnimationFrame(tick);
    setTimeout(function () {
      if (!done) {
        num.textContent = String(score);
        ring.style.setProperty("--p", pct);
      }
    }, DUR + 400);
  }

  /* ---------- утилиты ---------- */
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function goHome() {
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
    renderHome();
  }

  /* ---------- события ---------- */
  $("btn-next").addEventListener("click", next);
  $("quiz-exit").addEventListener("click", goHome);
  $("btn-retry").addEventListener("click", function () { startQuiz(state.grade.id); });
  $("btn-home").addEventListener("click", goHome);

  window.addEventListener("hashchange", function () {
    var id = location.hash.replace("#", "");
    var known = DATA.grades.some(function (g) { return g.id === id; });
    if (!known) { renderHome(); return; }
    var quizHidden = views.quiz.classList.contains("hidden");
    if (!state.grade || state.grade.id !== id || quizHidden) startQuiz(id);
  });

  /* отладочный хук (не документирован в UI) */
  window.__TESTS = { state: state, startQuiz: startQuiz, next: next, finish: finish };

  /* ---------- старт ---------- */
  var initial = location.hash.replace("#", "");
  var exists = DATA.grades.some(function (g) { return g.id === initial; });
  if (exists) startQuiz(initial);
  else renderHome();
})();
