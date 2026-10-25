/* ============================================================
   Service base URLs.

   Production builds must always use the explicitly configured
   VITE_*_URL values. Deriving a host from window.location (for
   example http://<vercel-host>:3001) can never work in production:
   Vercel only serves HTTPS on 443, and the signaling/translation/
   anchoring services live on different Render hosts.

   Local development keeps the historical localhost defaults.
   When a production URL is missing or malformed, the value is left
   empty so callers can show a configuration error instead of
   silently connecting to the wrong server.
   ============================================================ */

const cleanUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const parseServiceUrl = (value) => {
  const url = cleanUrl(value);

  if (!url) return "";

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    /* A production page is served over HTTPS. An http:// service URL
       would be blocked by the browser as mixed content, so keep the
       connection usable by upgrading it. Local development is not
       affected because its page is also http://. */
    if (
      typeof window !== "undefined" &&
      window.location?.protocol === "https:" &&
      parsed.protocol === "http:"
    ) {
      parsed.protocol = "https:";
    }

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
};

const localUrl = (url) => (import.meta.env.DEV ? url : "");

export const WEBRTC_URL = parseServiceUrl(import.meta.env.VITE_WEBRTC_URL) ||
  localUrl("http://localhost:3001");

export const TRANSLATION_URL = parseServiceUrl(
  import.meta.env.VITE_TRANSLATION_URL
) || localUrl("http://localhost:5000");

export const ANCHORING_URL = parseServiceUrl(
  import.meta.env.VITE_ANCHORING_URL
) || localUrl("http://localhost:3002");

export const SERVICE_CONFIG_ERRORS = {
  webrtc:
    "WebRTC is not configured for this deployment. Set VITE_WEBRTC_URL to the Render signaling URL (https://meet-2-deploying.onrender.com) and redeploy the frontend.",

  translation:
    "Live translation is not configured for this deployment. Set VITE_TRANSLATION_URL to the Render translation URL (https://meet-2-deploying-1.onrender.com) and redeploy the frontend.",

  anchoring:
    "AI anchoring is not configured for this deployment. Set VITE_ANCHORING_URL to the Render anchoring URL (https://meet-2-deploying-2.onrender.com) and redeploy the frontend.",
};
