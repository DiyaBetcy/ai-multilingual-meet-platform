# server.py
from flask import Flask, request
from flask_socketio import SocketIO
from flask_cors import CORS
import threading
import time
from gtts import gTTS
import io
import base64

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*")

clients = set()

# ---------- Convert text to audio ----------
def text_to_audio(text, lang="en"):
    tts = gTTS(text=text, lang=lang)
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    fp.seek(0)
    return base64.b64encode(fp.read()).decode("utf-8")

# ---------- Socket connect ----------
@socketio.on("connect")
def handle_connect():
    print("Client connected:", request.sid)
    clients.add(request.sid)

@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected:", request.sid)
    clients.discard(request.sid)

# ---------- AI Anchor ----------
def run_anchor(data):
    if not clients:
        print("❌ No clients connected")
        return

    def speak(text):
        print("Speaking:", text)
        audio = text_to_audio(text)
    
    room_id = data.get("roomId", "default")

    socketio.emit("ai_audio", {"audio": audio}, room=room_id)

        time.sleep(2)

    speak(data.get("full_agenda", "Welcome to AI meeting"))

    participants_in_room = {}
    room_id = data.get("roomId", "default")

if room_id not in participants_in_room:
    participants_in_room[room_id] = 0

participants_in_room[room_id] += 1

socketio.emit("participant_count", {
    "count": participants_in_room[room_id]
}, room=room_id)

@socketio.on("disconnect")
@socketio.on("disconnect")
def handle_disconnect():
    sid = request.sid

    if sid in participant_languages:
        room_id = participant_languages[sid]["room"]

        participants_in_room[room_id] -= 1

        print(f"❌ {sid} left room {room_id}")
        print(f"👥 Count: {participants_in_room[room_id]}")

        socketio.emit(
            "participant_count",
            {"count": participants_in_room[room_id]},
            room=room_id
        )

        del participant_languages[sid]
def handle_disconnect():
    sid = request.sid

    if sid in participant_languages:
        room_id = participant_languages[sid]["room"]

        participants_in_room[room_id] -= 1

        socketio.emit("participant_count", {
            "count": participants_in_room[room_id]
        }, room=room_id)

        del participant_languages[sid]
    for s in data.get("sessions", []):
        speak(f"Now I invite {s['speaker']} to present on {s['topic']}")
        speak("You may begin now")
        time.sleep(data.get("time", 10))
        speak("Time is up. Thank you")

    speak("Meeting ended. Thank you")

# ---------- Start anchor ----------
@app.route("/start-anchor", methods=["POST"])
def start_anchor():
    data = request.json
    threading.Thread(target=run_anchor, args=(data,), daemon=True).start()
    return {"status": "started"}

room_id = data.get("roomId", "default")
join_room(room_id)

participant_languages[request.sid] = {
    "language": language,
    "room": room_id
}
if __name__ == "__main__":
    print("🚀 Server running on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)

    participant_languages = {}
participants_in_room = {}

@socketio.on("register_participant")
participant_data = {}  # sid -> {name, language, room}

@socketio.on("register_participant")
def handle_register(data):
    room_id = data.get("roomId")
    language = data.get("language", "en")
    name = data.get("name", "Guest")

    if not room_id:
        return

    room_id = room_id.strip().upper()

    join_room(room_id)

    participant_data[request.sid] = {
        "name": name,
        "language": language,
        "room": room_id
    }

    print(f"✅ {name} joined {room_id}")

    # 🔥 Build participant list
    users = [
        p["name"]
        for p in participant_data.values()
        if p["room"] == room_id
    ]

    # 🔥 Send list to all in room
    socketio.emit(
        "participant_list",
        {"participants": users},
        room=room_id
    )