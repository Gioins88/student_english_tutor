"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const srs = require("../assets/js/srs.js");
const speech = require("../assets/js/speech.js");
const m2 = require("../assets/js/m2.js");
const math = require("../assets/js/math.js");

const DAY = srs.DAY_MS;
const T0 = Date.UTC(2026, 10, 15, 0, 0, 0);

test("new record starts due with half-life 1 day", () => {
  const record = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 });
  assert.equal(record.halfLife, 1);
  assert.equal(record.wrongCount, 0);
  assert.equal(srs.isDue(record, T0), true);
});

test("wrong answer halves half-life, floors at 0.5 and becomes due immediately", () => {
  let record = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 });
  record = srs.recordWrong(record, T0 + 10);
  assert.equal(record.halfLife, 0.5);
  assert.equal(record.wrongCount, 1);
  assert.equal(record.dueAt, T0 + 10);
  record = srs.recordWrong(record, T0 + 20);
  assert.equal(record.halfLife, 0.5);
  assert.equal(record.wrongCount, 2);
});

test("successful review doubles half-life and schedules future due", () => {
  let record = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 });
  record = srs.recordReview(record, true, T0 + DAY);
  assert.equal(record.halfLife, 2);
  assert.equal(record.reviewCount, 1);
  assert.ok(record.dueAt > T0 + DAY);
  assert.equal(srs.isDue(record, T0 + DAY + 1000), false);
});

test("failed review shrinks half-life and schedules a short retry", () => {
  let record = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 });
  record.halfLife = 8;
  record = srs.recordReview(record, false, T0);
  assert.equal(record.halfLife, 4);
  assert.equal(record.dueAt, T0 + 30 * 60 * 1000);
});

test("half-life is bounded to [0.5, 30] days", () => {
  let record = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 });
  record.halfLife = 30;
  record = srs.recordReview(record, true, T0);
  assert.equal(record.halfLife, 30);
  record.halfLife = 0.5;
  record = srs.recordReview(record, false, T0);
  assert.equal(record.halfLife, 0.5);
});

test("recall decays below the 0.7 threshold over time", () => {
  const record = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 });
  assert.ok(srs.recallProbability(record, T0) === 1);
  assert.ok(srs.recallProbability(record, T0 + DAY) < 0.7);
  assert.equal(srs.isDue(record, T0 + DAY), true);
});

test("prioritise orders lowest recall first", () => {
  const fresh = srs.createRecord({ lessonId: "l1", itemId: "q1", now: T0 + DAY });
  const stale = srs.createRecord({ lessonId: "l1", itemId: "q2", now: T0 });
  const ordered = srs.prioritise([fresh, stale], T0 + DAY);
  assert.equal(ordered[0].itemId, "q2");
});

test("speech similarity is 1 for identical and falls for different text", () => {
  assert.equal(speech.similarity("cocoa butter", "cocoa butter"), 1);
  assert.ok(speech.similarity("cocoa butter", "cocoa buter") > 0.85);
  assert.ok(speech.similarity("cocoa butter", "banana") < 0.4);
  assert.equal(speech.starsFor(0.9), 3);
  assert.equal(speech.starsFor(0.7), 2);
  assert.equal(speech.starsFor(0.5), 1);
  assert.equal(speech.starsFor(0.1), 0);
});

test("maskWord hides partial letters while keeping first letter and word length", () => {
  const masked = m2.maskWord("headmistress");
  assert.equal(masked.length, "headmistress".length);
  assert.equal(masked[0], "h");
  assert.ok(masked.includes("_"), "masked word should contain underscores");
  assert.notEqual(masked, "headmistress");
  const phrase = m2.maskWord("ice cream");
  assert.equal(phrase.length, "ice cream".length);
  assert.equal(phrase[3], " ");
  assert.ok(phrase.includes("_"));
});

test("calcListenTimeout gives >= 20s and scales with sentence length up to 45s", () => {
  assert.equal(speech.calcListenTimeout("apple"), 20000);
  assert.equal(speech.calcListenTimeout("I like playing football on Sunday"), 30000);
  assert.equal(speech.calcListenTimeout("one two three four five six seven eight nine ten eleven twelve"), 45000);
});

test("math helpers parse comma decimals, validate fractions, and format math HTML", () => {
  assert.equal(math.parseDecimal("3,5"), 3.5);
  assert.equal(math.parseDecimal("-6"), -6);
  assert.ok(Number.isNaN(math.parseDecimal("abc")));
  assert.equal(math.checkNumeric("3,5", 3.5).ok, true);
  assert.equal(math.checkNumeric("-4", -4).ok, true);
  const f1 = math.checkFraction("2", "4", 1, 2);
  assert.equal(f1.ok, true);
  assert.equal(f1.simplified, false);
  const f2 = math.checkFraction("1", "2", 1, 2);
  assert.equal(f2.ok, true);
  assert.equal(f2.simplified, true);
  assert.equal(math.checkFraction("1", "0", 1, 2).ok, false);
  assert.ok(math.formatMathHtml("3/4").includes("math-frac"));
  const rec = srs.createRecord({ subject: "math", lessonId: "m1", itemId: "q1", now: T0 });
  assert.equal(rec.subject, "math");
});