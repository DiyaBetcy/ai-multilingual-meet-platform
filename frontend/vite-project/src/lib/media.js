/* Browser media helpers shared by the WebRTC hook and the video grid.
 *
 * Keeping the srcObject assignment in one place makes the local preview
 * behave the same whether the stream arrives before or after the <video>
 * element mounts. That ordering is exactly what produced a black local
 * tile: the element did not exist when getUserMedia resolved, and the
 * ref callback that would have attached it never re-ran.
 */
export function attachStreamToVideo(video, stream, { muted = false } = {}) {
  if (!video || !stream) return false;

  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }

  if (muted) {
    video.muted = true;
  }

  try {
    const playResult = video.play?.();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        /* Autoplay can be blocked until the user interacts with the
           page. The stream is still attached and will render then. */
      });
    }
  } catch {
    // Older browsers throw instead of returning a promise.
  }

  return true;
}
