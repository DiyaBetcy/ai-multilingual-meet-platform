export const playBase64Audio = (base64) => {
  try {
    const audio = new Audio("data:audio/mpeg;base64," + base64);
    audio.play()
      .then(() => console.log("Playing audio 🔊"))
      .catch(err => console.error("Play error:", err));
  } catch (e) {
    console.error("Audio error:", e);
  }
};