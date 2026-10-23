import threading
import time
from gtts import gTTS
import base64
import io
from flask import Flask, request
from flask_socketio import SocketIO, join_room

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# ---------- JOIN ROOM ----------
@socketio.on("register_participant")
def handle_register(data):
    room_id = data.get("roomId")
    if room_id:
        join_room(room_id)
        print("👤 Joined room:", room_id)

# ---------- Helper ----------
def text_to_audio_base64(text, language="en"):
    tts = gTTS(text=text, lang=language)
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    fp.seek(0)
    return base64.b64encode(fp.read()).decode("utf-8")

# ---------- ANCHOR ----------
def run_anchor(data):
    meeting_title = data.get("meeting_title", "Meeting")
    sessions = data.get("sessions", [])
    host_language = data.get("language", "en")
    time_per_speaker = data.get("time", 30)
    full_agenda = data.get("full_agenda", "")
    room_id = data.get("roomId")  # 🔥 IMPORTANT

    def speak(text):
        audio_b64 = text_to_audio_base64(text, host_language)
        print("🔊 Speaking:", text)

        # ✅ SEND TO ROOM ONLY
        socketio.emit("ai_audio", {"audio": audio_b64}, room=room_id)

    # 1️⃣ Agenda
    if full_agenda:
        speak(full_agenda)

    # 2️⃣ Speakers
    for session in sessions:
        speak(f"Now I invite {session['speaker']} to present on {session['topic']}.")
        speak("You may begin now.")

        if time_per_speaker > 10:
            time.sleep(time_per_speaker - 10)
            speak("10 seconds remaining!")
            time.sleep(10)
        else:
            time.sleep(time_per_speaker)

        speak("Time is up. Thank you.")
        time.sleep(2)

    # 3️⃣ Closing
    speak("Thank you all for participating. The conference is now concluded.")

# ---------- START ----------
@app.route("/start-anchor", methods=["POST"])
def start_anchor():
    data = request.json
    threading.Thread(target=run_anchor, args=(data,), daemon=True).start()
    return {"status": "started"}

# ---------- RUN ----------
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)

