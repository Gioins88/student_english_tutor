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
    var active = null;

    function stop() {
      if (!active) return;
      try {
        active.stop();
      } catch (err) {
        /* noop */
      }
      active = null;
    }

    function listen(options) {
      options = options || {};
      if (!supported) {
        if (typeof options.onError === "function") options.onError("unsupported");
        return null;
      }
      stop();
      var recognition;
      try {
        recognition = new Recognition();
      } catch (err) {
        if (typeof options.onError === "function") options.onError("start-failed");
        return null;
      }
      active = recognition;
      recognition.lang = options.lang || "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 3;

      var finished = false;
      var timer = setTimeout(function () {
        try {
          recognition.stop();
        } catch (err) {
          /* noop */
        }
      }, options.timeout || 9000);

      recognition.onresult = function (event) {
        var results = event.results && event.results[0];
        var transcripts = [];
        if (results) {
          for (var i = 0; i < results.length; i += 1) {
            if (results[i] && results[i].transcript) transcripts.push(results[i].transcript);
          }
        }
        if (typeof options.onResult === "function") options.onResult(transcripts);
      };
      recognition.onerror = function (event) {
        if (typeof options.onError === "function") options.onError(event.error || "error");
      };
      recognition.onend = function () {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (active === recognition) active = null;
        if (typeof options.onEnd === "function") options.onEnd();
      };

      try {
        recognition.start();
      } catch (err) {
        clearTimeout(timer);
        active = null;
        if (typeof options.onError === "function") options.onError("start-failed");
        return null;
      }
      return recognition;
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
      clamp: clamp
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { similarity: similarity, starsFor: starsFor, normalize: normalizeText, levenshtein: levenshtein };
  }
})();