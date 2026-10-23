/* Test preload: replaces the paid/external providers with deterministic
 * fakes so the translation routing can be verified without credentials.
 *
 * Loaded with `node --require ./tests/mock-services.cjs`.
 *
 * Environment switches:
 *   MOCK_TRANSLATE_FAIL_MATCH  substring that makes translation fail
 *   MOCK_TTS_FAIL              "1" makes Sarvam TTS fail
 */

const axios = require("../node_modules/axios");

const originalAxiosGet = axios.get.bind(axios);
const failMatch = process.env.MOCK_TRANSLATE_FAIL_MATCH || "";

axios.get = async (url, config) => {
  if (String(url).includes("api.mymemory.translated.net")) {
    const langpair = String(config?.params?.langpair || "");
    const [from, to] = langpair.split("|");
    const q = String(config?.params?.q || "");

    if (failMatch && q.includes(failMatch)) {
      throw new Error(`Mock translation failure for "${failMatch}"`);
    }

    if (q.includes("FAILME")) {
      throw new Error("Mock translation failure requested by payload");
    }

    if (from === to) {
      throw new Error("Mock received identical language pair");
    }

    return {
      data: {
        responseStatus: 200,
        responseData: { translatedText: `[${to}] ${q}` },
      },
    };
  }

  return originalAxiosGet(url, config);
};

const googleTranslate = require("../node_modules/@vitalets/google-translate-api");
googleTranslate.translate = async (text, options = {}) => {
  const to = String(options.to || "").split("-")[0];
  if (failMatch && String(text).includes(failMatch)) {
    throw new Error(`Mock translation failure for "${failMatch}"`);
  }
  if (String(text).includes("FAILME")) {
    throw new Error("Mock translation failure requested by payload");
  }
  return { text: `[${to}] ${text}` };
};

const sarvamai = require("../node_modules/sarvamai");
const FakeSarvamAIClient = class {
  constructor() {
    this.textToSpeech = {
      convert: async ({ text, target_language_code }) => {
        if (process.env.MOCK_TTS_FAIL === "1") {
          throw new Error("Mock TTS failure");
        }

        console.log(
          `[MOCK-TTS] target=${target_language_code} text=${text}`
        );

        return {
          audio: Buffer.from(
            `audio:${target_language_code}:${text}`,
            "utf8"
          ).toString("base64"),
        };
      },
    };
  }
};

Object.defineProperty(sarvamai, "SarvamAIClient", {
  value: FakeSarvamAIClient,
  writable: true,
  configurable: true,
  enumerable: true,
});
