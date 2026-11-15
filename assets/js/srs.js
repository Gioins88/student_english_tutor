/* Space Explorer · Spaced Repetition (half-life model)
   Pure, clock-injected functions. UMD: window.SET_SRS in the browser, module.exports in Node. */
(function (root, factory) {
  var lib = factory();
  if (typeof module === "object" && module.exports) module.exports = lib;
  if (root) root.SET_SRS = lib;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var DAY_MS = 24 * 60 * 60 * 1000;
  var HOUR_MS = 60 * 60 * 1000;
  var MIN_HALF_LIFE = 0.5;
  var MAX_HALF_LIFE = 30;
  var GAMMA_PASS = 2;
  var GAMMA_FAIL = 0.5;
  var DUE_THRESHOLD = 0.7;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normaliseKey(value) {
    return String(value || "").trim();
  }

  function createRecord(input) {
    var now = input.now || Date.now();
    return {
      lessonId: normaliseKey(input.lessonId),
      itemId: normaliseKey(input.itemId),
      quizId: normaliseKey(input.quizId || input.itemId),
      skill: normaliseKey(input.skill || "vocabulary"),
      section: normaliseKey(input.section || "quiz_bank"),
      wrongCount: 0,
      reviewCount: 0,
      halfLife: 1,
      lastReview: now,
      lastWrong: now,
      dueAt: now,
      createdAt: now
    };
  }

  function recallProbability(record, now) {
    if (!record || !record.lastReview) return 0;
    var elapsedDays = Math.max(0, (now - record.lastReview) / DAY_MS);
    var halfLife = clamp(Number(record.halfLife) || 1, MIN_HALF_LIFE, MAX_HALF_LIFE);
    return Math.pow(2, -elapsedDays / halfLife);
  }

  function isDue(record, now) {
    if (!record) return false;
    if (typeof record.dueAt === "number" && record.dueAt <= now) return true;
    return recallProbability(record, now) < DUE_THRESHOLD;
  }

  function recordWrong(record, now) {
    var base = record || createRecord({ now: now });
    var halfLife = clamp((Number(base.halfLife) || 1) * GAMMA_FAIL, MIN_HALF_LIFE, MAX_HALF_LIFE);
    return Object.assign({}, base, {
      wrongCount: (base.wrongCount || 0) + 1,
      halfLife: halfLife,
      lastWrong: now,
      lastReview: now,
      dueAt: now
    });
  }

  function recordReview(record, correct, now) {
    var base = record || createRecord({ now: now });
    var current = clamp(Number(base.halfLife) || 1, MIN_HALF_LIFE, MAX_HALF_LIFE);
    var halfLife = correct ? clamp(current * GAMMA_PASS, MIN_HALF_LIFE, MAX_HALF_LIFE) : clamp(current * GAMMA_FAIL, MIN_HALF_LIFE, MAX_HALF_LIFE);
    var delay = correct ? Math.max(HOUR_MS, halfLife * 0.6 * DAY_MS) : 30 * 60 * 1000;
    return Object.assign({}, base, {
      reviewCount: (base.reviewCount || 0) + 1,
      halfLife: halfLife,
      lastReview: now,
      dueAt: now + delay
    });
  }

  function dueRecords(records, now) {
    return (records || []).filter(function (record) {
      return isDue(record, now);
    });
  }

  function prioritise(records, now) {
    return (records || []).slice().sort(function (a, b) {
      var recallA = recallProbability(a, now);
      var recallB = recallProbability(b, now);
      if (recallA !== recallB) return recallA - recallB;
      return (a.dueAt || 0) - (b.dueAt || 0);
    });
  }

  return {
    DAY_MS: DAY_MS,
    HOUR_MS: HOUR_MS,
    MIN_HALF_LIFE: MIN_HALF_LIFE,
    MAX_HALF_LIFE: MAX_HALF_LIFE,
    DUE_THRESHOLD: DUE_THRESHOLD,
    createRecord: createRecord,
    recallProbability: recallProbability,
    isDue: isDue,
    recordWrong: recordWrong,
    recordReview: recordReview,
    dueRecords: dueRecords,
    prioritise: prioritise
  };
});