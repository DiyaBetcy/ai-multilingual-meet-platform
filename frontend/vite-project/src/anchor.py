import threading
import time
from gtts import gTTS
import base64
import io
from flask import Flask, request
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# ---------- Helper to generate TTS audio and return base64 ----------
def text_to_audio_base64(text, language="en"):
    tts = gTTS(text=text, lang=language)
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    fp.seek(0)
    return base64.b64encode(fp.read()).decode("utf-8")

def run_anchor(data):
    meeting_title = data.get("meeting_title", "Meeting")
    sessions = data.get("sessions", [])
    host_language = data.get("language", "en")
    time_per_speaker = data.get("time", 30)
    full_agenda = data.get("full_agenda", "")

    # Speak full agenda
    if full_agenda:
        audio_b64 = text_to_audio_base64(full_agenda, host_language)
        print(f"[BACKEND] Emitting full agenda ({len(audio_b64)} bytes)...")
        socketio.emit("ai_audio", {"audio": audio_b64})

    # Loop through speakers
    for session in sessions:
        intro_text = f"Now I invite {session['speaker']} to present on {session['topic']}."
        audio_b64 = text_to_audio_base64(intro_text, host_language)
        print(f"[BACKEND] Emitting intro audio for {session['speaker']} ({len(audio_b64)} bytes)...")
        socketio.emit("ai_audio", {"audio": audio_b64})

        begin_text = "You may begin now."
        audio_b64 = text_to_audio_base64(begin_text, host_language)
        print(f"[BACKEND] Emitting start audio for {session['speaker']} ({len(audio_b64)} bytes)...")
        socketio.emit("ai_audio", {"audio": audio_b64})

        # ... rest of your timer code
        
        # Timer for speaker
        if time_per_speaker > 10:
            time.sleep(time_per_speaker - 10)
            warning_text = "10 seconds remaining!"
            audio_b64 = text_to_audio_base64(warning_text, host_language)
            socketio.emit("ai_audio", {"audio": audio_b64})
            time.sleep(10)
        else:
            time.sleep(time_per_speaker)

        end_text = "Time is up. Thank you."
        audio_b64 = text_to_audio_base64(end_text, host_language)
        socketio.emit("ai_audio", {"audio": audio_b64})
        time.sleep(2)

    # 3️⃣ Closing
    closing_text = "Thank you all for participating. The conference is now concluded."
    audio_b64 = text_to_audio_base64(closing_text, host_language)
    socketio.emit("ai_audio", {"audio": audio_b64})

# ---------- Endpoint to start AI Anchor ----------
@app.route("/start-anchor", methods=["POST"])
def start_anchor():
    data = request.json
    # Run the anchor in a separate thread so Flask doesn't block
    threading.Thread(target=run_anchor, args=(data,), daemon=True).start()
    return {"status": "started"}

if __name__ == "__main__":
    # Use allow_unsafe_werkzeug=True to prevent SocketIO warnings on Windows
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)