/* Space Explorer · speech layer
   TTS (speechSynthesis) + STT (SpeechRecognition) + kid-friendly fuzzy scoring.
   Exposed as window.SETSpeech; no external dependencies. */
(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
      .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, "-")
      .replace(/[.,!?;:"'()\[\]{}<>/\\|`~@#$%^&*+=_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var previous = new Array(b.length + 1);
    var current = new Array(b.length + 1);
    for (var j = 0; j <= b.length; j += 1) previous[j] = j;
    for (var i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (var k = 1; k <= b.length; k += 1) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        current[k] = Math.min(current[k - 1] + 1, previous[k] + 1, previous[k - 1] + cost);
      }
      var swap = previous;
      previous = current;
      current = swap;
    }
    return previous[b.length];
  }

  function similarity(target, transcript) {
    var a = normalizeText(target);
    var b = normalizeText(transcript);
    if (!a && !b) return 0;
    if (!a || !b) return 0;
    var distance = levenshtein(a, b);
    return clamp(1 - distance / Math.max(a.length, b.length), 0, 1);
  }

  function starsFor(score) {
    if (score >= 0.85) return 3;
    if (score >= 0.65) return 2;
    if (score >= 0.45) return 1;
    return 0;
  }

  function coachMessage(stars) {
    if (stars === 3) return "Tuyệt vời! Con đọc rất rõ.";
    if (stars === 2) return "Rất tốt! Con đọc thêm một lần nữa nhé.";
    if (stars === 1) return "Cố lên! Con đọc chậm và rõ từng âm nhé.";
    return "Không sao! Con nghe lại rồi thử đọc to hơn nhé.";
  }

  function calcListenTimeout(target) {
    var words = normalizeText(target).split(/\s+/).filter(Boolean).length;
    return clamp(words * 3000 + 12000, 20000, 45000);
  }

  var TTS = (function () {
    var supported = Boolean(root && "speechSynthesis" in root && "SpeechSynthesisUtterance" in root);
    var voices = [];
    var preferred = null;
    var rate = 1;

    function pickVoice() {
      if (!supported) return;
      voices = root.speechSynthesis.getVoices() || [];
      var english = voices.filter(function (voice) {
        return /^en(-|_)/i.test(voice.lang || "");
      });
      var names = [
        "Samantha",
        "Daniel",
        "Google UK English Female",
        "Google US English",
        "Microsoft Aria",
        "Microsoft Jenny"
      ];
      preferred = null;
      for (var i = 0; i < names.length && !preferred; i += 1) {
        preferred = english.filter(function (voice) {
          return (voice.name || "").indexOf(names[i]) !== -1;
        })[0] || null;
      }
      if (!preferred) {
        preferred = english.filter(function (voice) {
          return /en-GB/i.test(voice.lang || "");
        })[0] || english[0] || null;
      }
    }

    if (supported) {
      pickVoice();
      if (typeof root.speechSynthesis.addEventListener === "function") {
        root.speechSynthesis.addEventListener("voiceschanged", pickVoice);
      } else {
        root.speechSynthesis.onvoiceschanged = pickVoice;
      }
    }

    function speak(text, options) {
      if (!supported || !text) return null;
      options = options || {};
      try {
        if (!options.append) root.speechSynthesis.cancel();
        var utter = new root.SpeechSynthesisUtterance(String(text));
        utter.lang = (preferred && preferred.lang) || "en-US";
        if (preferred) utter.voice = preferred;
        utter.rate = options.rate || rate;
        utter.pitch = 1.05;
        if (typeof options.onStart === "function") utter.onstart = options.onStart;
        if (typeof options.onEnd === "function") utter.onend = options.onEnd;
        if (typeof options.onError === "function") utter.onerror = options.onError;
        if (typeof options.onBoundary === "function") utter.onboundary = options.onBoundary;
        root.speechSynthesis.speak(utter);
        return utter;
      } catch (err) {
        return null;
      }
    }

    function stop() {
      if (!supported) return;
      try {
        root.speechSynthesis.cancel();
      } catch (err) {
        /* noop */
      }
    }

    function setRate(next) {
      rate = next === 0.75 ? 0.75 : 1;
      return rate;
    }

    return {
      supported: supported,
      speak: speak,
      stop: stop,
      setRate: setRate,
      getRate: function () {
        return rate;
      },
      refreshVoices: pickVoice
    };
  })();

  var STT = (function () {
    var Recognition = root ? root.SpeechRecognition || root.webkitSpeechRecognition || null : null;
    var supported = Boolean(Recognition);
    var activeController = null;

    function stop() {
      if (!activeController) return;
      var controller = activeController;
      activeController = null;
      controller.stop();
    }

    function listen(options) {
      options = options || {};
      if (!supported) {
        if (typeof options.onError === "function") options.onError("unsupported");
        return null;
      }
      stop();

      var timeoutMs = options.timeout || 25000;
      var silenceMs = options.silenceMs || 4500;
      var continuous = options.continuous !== false;
      var startedAt = Date.now();
      var persistedFinals = [];
      var persistedAlts = [];
      var currentFinals = [];
      var currentAlts = [];
      var latestInterim = "";
      var hasSpoken = false;
      var stoppedManually = false;
      var timedOut = false;
      var silenceTimedOut = false;
      var fatalError = null;
      var finished = false;
      var restartCount = 0;
      var recognition = null;
      var silenceTimer = null;

      function buildCombinedText() {
        var chunks = persistedFinals.concat(currentFinals).filter(Boolean);
        if (latestInterim) chunks.push(latestInterim);
        return chunks.join(" ").replace(/\s+/g, " ").trim();
      }

      function buildCandidates() {
        var prefix = persistedFinals.filter(Boolean).join(" ").trim();
        var merged = buildCombinedText();
        var list = [];
        if (merged) list.push(merged);
        var tailAlts = currentAlts.length ? currentAlts : persistedAlts;
        tailAlts.forEach(function (alt) {
          var full = prefix && currentFinals.length <= 1 ? (prefix + " " + alt).trim() : alt;
          if (full && list.indexOf(full) === -1) list.push(full);
        });
        return list;
      }

      function finalize() {
        if (finished) return;
        finished = true;
        clearTimeout(maxTimer);
        clearTimeout(silenceTimer);
        if (activeController && activeController.id === controller.id) activeController = null;
        var candidates = buildCandidates();
        if (fatalError && !candidates.length) {
          if (typeof options.onError === "function") options.onError(fatalError);
        } else if (candidates.length) {
          if (typeof options.onResult === "function") options.onResult(candidates);
        }
        if (typeof options.onEnd === "function") options.onEnd();
      }

      function requestStop(reason) {
        if (reason === "manual") stoppedManually = true;
        else if (reason === "timeout") timedOut = true;
        else if (reason === "silence") silenceTimedOut = true;
        clearTimeout(silenceTimer);
        if (recognition) {
          try {
            recognition.stop();
            return;
          } catch (err) {
            /* fallback to finalize */
          }
        }
        finalize();
      }

      var maxTimer = setTimeout(function () {
        requestStop("timeout");
      }, timeoutMs);

      var controller = {
        id: Math.random(),
        stop: function () {
          requestStop("manual");
        }
      };
      activeController = controller;

      function startSession() {
        try {
          recognition = new Recognition();
        } catch (err) {
          fatalError = "start-failed";
          finalize();
          return null;
        }
        recognition.lang = options.lang || "en-US";
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        recognition.onresult = function (event) {
          currentFinals = [];
          currentAlts = [];
          var interimParts = [];
          for (var i = 0; i < event.results.length; i += 1) {
            var res = event.results[i];
            if (!res || !res[0]) continue;
            if (res.isFinal) {
              currentFinals.push(res[0].transcript);
              if (i === event.results.length - 1) {
                for (var a = 0; a < res.length; a += 1) {
                  if (res[a] && res[a].transcript) currentAlts.push(res[a].transcript);
                }
              }
            } else {
              interimParts.push(res[0].transcript);
            }
          }
          latestInterim = interimParts.join(" ").trim();
          var combined = buildCombinedText();
          if (combined) {
            hasSpoken = true;
            if (typeof options.onInterim === "function") options.onInterim(combined);
            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(function () {
              requestStop("silence");
            }, silenceMs);
          }
        };

        recognition.onerror = function (event) {
          var code = event.error || "error";
          if (code === "no-speech" && !stoppedManually && !timedOut && Date.now() - startedAt < timeoutMs - 2000) {
            return;
          }
          if (code === "aborted" && (stoppedManually || timedOut || silenceTimedOut)) {
            return;
          }
          fatalError = code;
        };

        recognition.onend = function () {
          if (finished) return;
          if (!stoppedManually && !timedOut && !silenceTimedOut && !fatalError && continuous) {
            var elapsed = Date.now() - startedAt;
            if (elapsed < timeoutMs - 1500 && restartCount < 5) {
              if (currentFinals.length) {
                persistedFinals = persistedFinals.concat(currentFinals);
                persistedAlts = currentAlts.slice();
                currentFinals = [];
                currentAlts = [];
              }
              if (latestInterim) {
                persistedFinals.push(latestInterim);
                latestInterim = "";
              }
              restartCount += 1;
              try {
                startSession();
                return;
              } catch (err) {
                /* fall through to finalize */
              }
            }
          }
          finalize();
        };

        try {
          recognition.start();
        } catch (err) {
          fatalError = "start-failed";
          finalize();
          return null;
        }
        return recognition;
      }

      return startSession();
    }

    function score(target, transcripts) {
      var list = Array.isArray(transcripts) ? transcripts : [transcripts];
      var best = 0;
      var bestText = "";
      list.forEach(function (transcript) {
        var value = similarity(target, transcript);
        if (value > best) {
          best = value;
          bestText = String(transcript || "");
        }
      });
      return { score: best, stars: starsFor(best), transcript: bestText, message: coachMessage(starsFor(best)) };
    }

    return {
      supported: supported,
      listen: listen,
      stop: stop,
      score: score,
      similarity: similarity,
      starsFor: starsFor,
      coachMessage: coachMessage,
      normalize: normalizeText
    };
  })();

  if (root) {
    root.SETSpeech = {
      tts: TTS,
      stt: STT,
      similarity: similarity,
      starsFor: starsFor,
      coachMessage: coachMessage,
      normalize: normalizeText,
      clamp: clamp,
      calcListenTimeout: calcListenTimeout
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      similarity: similarity,
      starsFor: starsFor,
      normalize: normalizeText,
      levenshtein: levenshtein,
      calcListenTimeout: calcListenTimeout
    };
  }
})();