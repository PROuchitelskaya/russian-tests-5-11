/* Тесты по русскому языку · 5–11 классы — Учительская */
(function () {
  "use strict";

  var DATA = window.TESTS_DATA;
  var STORE_KEY = DATA.meta.storeKey;
  var NAME_KEY = STORE_KEY + ":name";
  var SITE_URL = "https://prouchitelskaya.github.io/russian-tests-5-11/";
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
  function loadName() {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch (e) { return ""; }
  }
  function saveName(n) {
    try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* приватный режим */ }
  }

  /* ---------- состояние ---------- */
  var state = {
    grade: null,      // объект класса из DATA
    idx: 0,           // номер текущего вопроса
    score: 0,
    locked: false,    // ответ уже дан
    optOrders: [],    // перемешанный порядок вариантов для каждого вопроса
    result: null      // {gradeId, gradeLabel, topic, score, total} для грамоты
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

    state.result = { gradeId: g.id, gradeLabel: g.grade, topic: g.topic, score: score, total: total };

    $("result-grade").textContent = g.grade + " · " + g.topic;
    $("score-total").textContent = "из " + total;

    var v = verdictFor(score, total);
    $("verdict").textContent = v[0];
    $("verdict-sub").textContent = v[1];

    var ring = $("score-ring");
    var pct = Math.round(score / total * 100);
    ring.style.setProperty("--ring", score / total >= 0.7 ? "var(--good)" : "var(--accent)");

    prepareCert();

    show("result");
    animateScore(score, pct);
  }

  /* ---------- грамота ---------- */
  function shortRank(score, total) {
    var p = total ? score / total : 0;
    if (score === total) return "Идеально";
    if (p >= 0.9) return "Блестяще";
    if (p >= 0.7) return "Отлично";
    if (p >= 0.5) return "Хорошо";
    return "Участие";
  }
  function certKind(score, total) {
    return (total ? score / total : 0) >= 0.7 ? "Грамота" : "Сертификат";
  }
  function prepareCert() {
    var r = state.result;
    if (!r) return;
    var kind = certKind(r.score, r.total);
    $("cert-title").textContent = kind === "Грамота" ? "Именная грамота" : "Именной сертификат";
    var input = $("cert-name");
    if (input && !input.value) input.value = loadName();
    updateShare();
  }
  function buildReport() {
    var r = state.result;
    if (!r) return "";
    var name = (($("cert-name") || {}).value || "").trim();
    var pct = r.total ? Math.round(r.score / r.total * 100) : 0;
    var lines = ["🎓 " + certKind(r.score, r.total) + " · PRO Учительская"];
    if (name) lines.push("Ученик: " + name);
    lines.push(r.gradeLabel + " · " + r.topic);
    lines.push("Результат: " + r.score + " из " + r.total + " (" + pct + "%) — " + shortRank(r.score, r.total));
    lines.push(SITE_URL);
    return lines.join("\n");
  }
  function updateShare() {
    var a = $("cert-share");
    if (a) a.href = "https://t.me/share/url?url=" + encodeURIComponent(SITE_URL) + "&text=" + encodeURIComponent(buildReport());
  }
  function wrapLines(ctx, text, maxW) {
    var words = text.split(" ");
    var lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function drawCert() {
    var r = state.result;
    if (!r) return;
    var name = (($("cert-name") || {}).value || "").trim();
    if (name) saveName(name);
    var displayName = name || "Ученик(-ца)";
    var pct = r.total ? Math.round(r.score / r.total * 100) : 0;
    var kind = certKind(r.score, r.total);

    var W = 1240, H = 877;
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");

    var bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#fffdf9"); bg.addColorStop(1, "#f4e9db");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);

    x.strokeStyle = "rgba(216,84,58,0.75)"; x.lineWidth = 6; x.strokeRect(30, 30, W - 60, H - 60);
    x.strokeStyle = "rgba(216,84,58,0.32)"; x.lineWidth = 2; x.strokeRect(48, 48, W - 96, H - 96);

    x.textAlign = "center";
    x.fillStyle = "#d8543a"; x.font = "700 22px Inter, Arial, sans-serif";
    x.fillText("PRO УЧИТЕЛЬСКАЯ · РУССКИЙ ЯЗЫК", W / 2, 122);
    x.fillStyle = "#172d44"; x.font = "700 92px Lora, Georgia, serif";
    x.fillText(kind, W / 2, 228);
    x.fillStyle = "#5c6f84"; x.font = "400 28px Inter, Arial, sans-serif";
    x.fillText("награждается", W / 2, 290);
    x.fillStyle = "#172d44"; x.font = "italic 700 54px Lora, Georgia, serif";
    x.fillText(displayName, W / 2, 366);
    x.fillStyle = "#5c6f84"; x.font = "400 27px Inter, Arial, sans-serif";
    x.fillText("за прохождение теста · " + r.gradeLabel, W / 2, 428);
    x.fillStyle = "#3a5265"; x.font = "600 33px Lora, Georgia, serif";
    var topicLines = wrapLines(x, "«" + r.topic + "»", W - 280).slice(0, 2);
    var ty = 480;
    topicLines.forEach(function (ln) { x.fillText(ln, W / 2, ty); ty += 42; });

    var sy = 636;
    var cx = [W / 2 - 300, W / 2, W / 2 + 300];
    var vals = [r.score + " / " + r.total, pct + "%", shortRank(r.score, r.total)];
    var labs = ["РЕЗУЛЬТАТ", "ПРОЦЕНТ", "ОЦЕНКА"];
    for (var i = 0; i < 3; i++) {
      x.fillStyle = "#d8543a"; x.font = "700 40px Lora, Georgia, serif";
      x.fillText(vals[i], cx[i], sy);
      x.fillStyle = "#8fa0b2"; x.font = "700 16px Inter, Arial, sans-serif";
      x.fillText(labs[i], cx[i], sy + 34);
    }

    x.fillStyle = "#5c6f84"; x.font = "400 23px Inter, Arial, sans-serif";
    var dstr;
    try { dstr = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }
    catch (e) { dstr = new Date().toLocaleDateString(); }
    x.fillText("Дата: " + dstr, W / 2, 742);

    x.fillStyle = "#172d44"; x.font = "700 24px Lora, Georgia, serif";
    x.fillText("PRO Учительская · Арина Галицкая", W / 2, H - 96);
    x.fillStyle = "#8fa0b2"; x.font = "400 19px Inter, Arial, sans-serif";
    x.fillText("prouchitelskaya.github.io/russian-tests-5-11", W / 2, H - 66);

    x.beginPath(); x.arc(W - 168, H - 150, 52, 0, Math.PI * 2);
    x.fillStyle = "#d8543a"; x.fill();
    x.fillStyle = "#fff"; x.font = "700 30px Lora, Georgia, serif";
    x.fillText("PRO", W - 168, H - 140);

    c.toBlob(function (blob) {
      if (!blob) { toast("Не удалось создать картинку"); return; }
      var a = document.createElement("a");
      a.download = "gramota-" + r.gradeId + (name ? "-" + name.replace(/\s+/g, "_") : "") + ".png";
      a.href = URL.createObjectURL(blob);
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
      toast("Грамота сохранена картинкой — её можно отправить в PRO Учительскую");
    }, "image/png");
  }
  function downloadCert() {
    // Рисуем ГАРАНТИРОВАННО: пытаемся подгрузить шрифты, но не ждём дольше ~600 мс
    // (document.fonts.ready может «зависнуть», если внешний запрос шрифта не завершился).
    var done = false;
    function go() { if (done) return; done = true; drawCert(); }
    var f = document.fonts;
    if (f && f.load) {
      try {
        Promise.race([
          Promise.all([f.load("700 92px Lora"), f.load("italic 700 54px Lora"), f.load("400 28px Inter")]),
          new Promise(function (res) { setTimeout(res, 600); })
        ]).then(go, go);
      } catch (e) { go(); }
      setTimeout(go, 750);
    } else {
      go();
    }
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    void t.offsetWidth;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.hidden = true; }, 320);
    }, 3000);
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
  $("cert-download").addEventListener("click", downloadCert);
  (function () {
    var cn = $("cert-name");
    if (cn) cn.addEventListener("input", function () { saveName(cn.value.trim()); updateShare(); });
  })();

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
