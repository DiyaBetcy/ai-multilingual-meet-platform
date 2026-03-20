from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import base64
from gtts import gTTS
import uuid
import os
import time

app = Flask(__name__)

socketio = SocketIO(app, cors_allowed_origins="*")

# 🔥 STORE ROOMS
rooms = {}  # { roomId: [ {sid, name, language} ] }


# ---------- CONNECT ----------
@socketio.on("connect")
def handle_connect():
    print("Client connected:", request.sid)


# ---------- DISCONNECT ----------
@socketio.on("disconnect")
def handle_disconnect():
    print("Client disconnected:", request.sid)

    for roomId in rooms:
        rooms[roomId] = [p for p in rooms[roomId] if p["sid"] != request.sid]

        # send updated list
        emit_participants(roomId)


# ---------- REGISTER ----------
@socketio.on("register_participant")
def register(data):
    print("📩 Received:", data)   # 🔥 ADD THIS

    roomId = data.get("roomId")
    name = data.get("name", "Guest")
    language = data.get("language", "en")

    if not roomId:
        return

    join_room(roomId)
    print(f"{name} joined room {roomId}")

    if roomId not in rooms:
        rooms[roomId] = []

    # avoid duplicates
    rooms[roomId] = [p for p in rooms[roomId] if p["sid"] != request.sid]

    rooms[roomId].append({
        "sid": request.sid,
        "name": name,
        "language": language
    })

    print(f"{name} joined room {roomId}")

    emit_participants(roomId)


# ---------- SEND PARTICIPANT LIST ----------
def emit_participants(roomId):
    participants = [p["name"] for p in rooms.get(roomId, [])]

    socketio.emit(
        "participant_list",
        {"participants": participants},
        room=roomId
    )


# ---------- TEXT TO SPEECH ----------
def generate_audio(text):
    filename = f"temp_{uuid.uuid4()}.mp3"
    tts = gTTS(text=text, lang="en")
    tts.save(filename)

    with open(filename, "rb") as f:
        audio = base64.b64encode(f.read()).decode("utf-8")

    os.remove(filename)
    return audio


# ---------- RUN ANCHOR ----------
def run_anchor(data):
    roomId = data.get("roomId")
    sessions = data.get("sessions", [])
    time_per_speaker = data.get("time", 10)
    full_agenda = data.get("full_agenda", "")

    if not roomId:
        print("❌ No roomId received")
        return

    def speak(text):
        print("Speaking:", text)
        audio = generate_audio(text)

        socketio.emit("ai_audio", {"audio": audio}, room=roomId)
        time.sleep(2)

    # START FLOW
    speak(full_agenda)

    for s in sessions:
        speaker = s["speaker"]
        topic = s["topic"]

        speak(f"Now I invite {speaker} to present on {topic}")
        speak("You may begin now")

        time.sleep(time_per_speaker)

        speak("Time is up. Thank you")

    speak("Meeting ended. Thank you")


# ---------- START ANCHOR ----------
@app.route("/start-anchor", methods=["POST"])
def start_anchor():
    data = request.json

    # 🔥 IMPORTANT: must pass roomId
    roomId = data.get("roomId")

    if not roomId:
        return {"error": "roomId missing"}, 400

    socketio.start_background_task(run_anchor, data)

    return {"status": "started"}


# ---------- RUN ----------
if __name__ == "__main__":
    print("🚀 Server running on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000)