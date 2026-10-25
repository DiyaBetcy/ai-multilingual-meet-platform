/* Shared translation and speech-synthesis helpers.
 *
 * The translation service (translation.js) and the AI anchoring service
 * (anchoring-service.js) used to keep separate copies of the provider
 * code. That is how the deployed service ended up relying on providers
 * that are not reachable from Render while the anchoring service still
 * worked in local tests. Keeping one implementation makes provider
 * order, timeouts, errors and audio handling identical in both services.
 *
 * Provider order:
 *   1. Sarvam AI  (same provider/API key already used for TTS)
 *   2. MyMemory   (free fallback)
 *   3. Google Translate (last-resort fallback)
 */

const axios = require("axios");
const { translate: googleTranslate } = require("@vitalets/google-translate-api");

const languageCodeMap = {
  en: "en-IN",
  ml: "ml-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  as: "as-IN",
  od: "od-IN",
  or: "od-IN",
};

const languageNames = {
  en: "English",
  ml: "Malayalam",
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  bn: "Bengali",
  gu: "Gujarati",
  mr: "Marathi",
  od: "Odia",
  pa: "Punjabi",
  as: "Assamese",
  ur: "Urdu",
};

/* Sarvam's text-to-speech endpoint does not currently expose Assamese
 * or Urdu voices to every account (it returns a 400 beta-access error).
 * Translation for both languages still works; the browser synthesises
 * the translated text instead of the server returning wrong-language
 * audio. */
const SARVAM_TTS_UNSUPPORTED = new Set(["as", "ur"]);

const normalizeLangCode = (language) => {
  if (!language) return "en";
  const value = String(language).trim().toLowerCase();
  if (!value) return "en";
  if (value === "or" || value.startsWith("or-")) return "od";
  return value.split("-")[0];
};

const sarvamLanguageCode = (language) =>
  languageCodeMap[normalizeLangCode(language)] || "en-IN";

/* MyMemory and Google both use `or` for Odia while the UI uses `od`. */
const providerLanguageCode = (language) => {
  const normalized = normalizeLangCode(language);
  return normalized === "od" ? "or" : normalized;
};

const withTimeout = (promise, ms, label) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutId)
  );
};

const getBase64Audio = (ttsResponse) =>
  ttsResponse?.audio ||
  ttsResponse?.data ||
  ttsResponse?.audios?.[0] ||
  ttsResponse?.outputs?.[0]?.audio ||
  null;

/* Long utterances are rare in live captions, but AI anchor scripts can
 * be a few hundred characters. Split on sentence boundaries so the
 * providers' request limits are respected without truncating speech. */
const splitForProvider = (text, maxLength = 1800) => {
  const value = String(text || "").trim();
  if (value.length <= maxLength) return [value];

  const chunks = [];
  let remaining = value;

  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength);
    const boundary = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf("\n"),
      window.lastIndexOf(", ")
    );
    const cut = boundary > maxLength * 0.4 ? boundary + 1 : maxLength;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
};

const translateWithSarvam = async (sarvamClient, text, sourceLang, targetLang) => {
  if (!sarvamClient?.text?.translate) {
    throw new Error("Sarvam translation is not configured");
  }

  const response = await withTimeout(
    sarvamClient.text.translate({
      input: text,
      source_language_code: sarvamLanguageCode(sourceLang),
      target_language_code: sarvamLanguageCode(targetLang),
      model: "sarvam-translate:v1",
    }),
    15000,
    "Sarvam translation"
  );

  const translatedText = String(
    response?.translated_text ?? response?.translation ?? ""
  ).trim();

  if (!translatedText) {
    throw new Error("Sarvam translation returned empty text");
  }

  return translatedText;
};

const translateWithMyMemory = async (text, sourceLang, targetLang) => {
  const response = await withTimeout(
    axios.get("https://api.mymemory.translated.net/get", {
      params: {
        q: text,
        langpair: `${providerLanguageCode(sourceLang)}|${providerLanguageCode(
          targetLang
        )}`,
      },
      timeout: 10000,
    }),
    12000,
    "MyMemory translation"
  );

  const status = Number(response.data?.responseStatus);
  const translatedText = String(
    response.data?.responseData?.translatedText || ""
  ).trim();

  if (status !== 200 || !translatedText) {
    throw new Error(
      `MyMemory returned status ${
        response.data?.responseStatus || "unknown"
      }`
    );
  }

  if (
    /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR|PLEASE SELECT TWO DISTINCT/i.test(
      translatedText
    )
  ) {
    throw new Error(`MyMemory error: ${translatedText}`);
  }

  return translatedText;
};

const translateWithGoogle = async (text, sourceLang, targetLang) => {
  const response = await withTimeout(
    googleTranslate(text, {
      from: providerLanguageCode(sourceLang),
      to: providerLanguageCode(targetLang),
    }),
    12000,
    "Google Translate"
  );

  const translatedText = String(response?.text || "").trim();

  if (!translatedText) {
    throw new Error("Google Translate returned empty text");
  }

  return translatedText;
};

/* Create an isolated translator (and cache) for one service instance. */
const createTranslator = ({
  sarvamClient = null,
  cacheSize = 100,
  logger = console,
} = {}) => {
  const cache = new Map();

  const translateChunk = async (text, source, target) => {
    const providers = [
      {
        name: "Sarvam",
        run: () => translateWithSarvam(sarvamClient, text, source, target),
      },
      {
        name: "MyMemory",
        run: () => translateWithMyMemory(text, source, target),
      },
      {
        name: "Google Translate",
        run: () => translateWithGoogle(text, source, target),
      },
    ];

    let lastError = null;

    for (const provider of providers) {
      try {
        return await provider.run();
      } catch (error) {
        lastError = error;
        logger.error(
          `Translation provider ${provider.name} failed (${source} -> ${target}):`,
          error.message
        );
      }
    }

    throw lastError || new Error("Translation failed");
  };

  const translate = async (text, sourceLang, targetLang) => {
    const cleanText = String(text || "").trim();
    const source = normalizeLangCode(sourceLang);
    const target = normalizeLangCode(targetLang);

    if (!cleanText) {
      throw new Error("Cannot translate empty text");
    }

    if (source === target) {
      return cleanText;
    }

    if (!languageNames[source] || !languageNames[target]) {
      throw new Error(`Unsupported language pair: ${source} -> ${target}`);
    }

    const cacheKey = `${cleanText}:${source}:${target}`;

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const chunks = splitForProvider(cleanText);
    const translatedChunks = [];

    for (const chunk of chunks) {
      translatedChunks.push(await translateChunk(chunk, source, target));
    }

    const translatedText = translatedChunks.join(" ").trim();

    cache.set(cacheKey, translatedText);

    if (cache.size > cacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return translatedText;
  };

  return {
    translate,
    clearCache: () => cache.clear(),
  };
};

/* Synthesise speech with Sarvam. Returns a result object instead of
 * throwing so callers can attach a reason to the socket payload and the
 * client can fall back to browser speech synthesis. */
const synthesizeSpeech = async ({
  sarvamClient = null,
  text,
  language,
  timeoutMs = 20000,
  logger = console,
} = {}) => {
  const cleanText = String(text || "").trim();
  const lang = normalizeLangCode(language);

  if (!cleanText) {
    return { audio: null, mimeType: "", provider: null, error: "Empty text" };
  }

  if (!sarvamClient?.textToSpeech?.convert) {
    return {
      audio: null,
      mimeType: "",
      provider: null,
      error: "Server speech synthesis is not configured",
    };
  }

  if (SARVAM_TTS_UNSUPPORTED.has(lang)) {
    return {
      audio: null,
      mimeType: "",
      provider: null,
      error: `Server speech synthesis is unavailable for ${
        languageNames[lang] || language
      }; using browser speech`,
    };
  }

  try {
    const ttsResponse = await withTimeout(
      sarvamClient.textToSpeech.convert({
        text: cleanText,
        target_language_code: sarvamLanguageCode(lang),
        output_audio_codec: "wav",
      }),
      timeoutMs,
      "Sarvam TTS"
    );

    const audio = getBase64Audio(ttsResponse);

    if (!audio) {
      throw new Error("Sarvam TTS returned no audio");
    }

    return { audio, mimeType: "audio/wav", provider: "sarvam", error: "" };
  } catch (error) {
    logger.error(`TTS failed (${lang}):`, error.message);
    return {
      audio: null,
      mimeType: "",
      provider: null,
      error: error.message || "Speech synthesis failed",
    };
  }
};

module.exports = {
  SARVAM_TTS_UNSUPPORTED,
  createTranslator,
  getBase64Audio,
  languageCodeMap,
  languageNames,
  normalizeLangCode,
  providerLanguageCode,
  sarvamLanguageCode,
  splitForProvider,
  synthesizeSpeech,
  withTimeout,
};
