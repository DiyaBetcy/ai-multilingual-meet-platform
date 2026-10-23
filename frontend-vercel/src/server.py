from flask import Flask, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import base64, os, uuid, time
from gtts import gTTS

app = Flask(__name__)
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*")

rooms = {}

# ---------- CONNECT ----------
@socketio.on("connect")
def connect():
    print("✅ Connected:", request.sid)

# ---------- DISCONNECT ----------
@socketio.on("disconnect")
def disconnect():
    print("❌ Disconnected:", request.sid)

    for roomId in list(rooms.keys()):
        if request.sid in rooms[roomId]:
            del rooms[roomId][request.sid]

            socketio.emit(
                "participant_list",
                {"participants": list(rooms[roomId].values())},
                room=roomId
            )

# ---------- JOIN ROOM ----------
@socketio.on("register_participant")
def register(data):
    name = data.get("name", "Guest")
    roomId = data.get("roomId")

    if not roomId:
        return

    roomId = roomId.strip().upper()

    print(f"👉 JOIN: {name} -> {roomId}")

    join_room(roomId)

    if roomId not in rooms:
        rooms[roomId] = {}

    rooms[roomId][request.sid] = name

    socketio.emit(
        "participant_list",
        {"participants": list(rooms[roomId].values())},
        room=roomId
    )

# ---------- AI ANCHOR ----------
@app.route("/start-anchor", methods=["POST"])
def start_anchor():
    data = request.json
    roomId = data.get("roomId", "").strip().upper()

    if not roomId:
        return {"error": "No roomId"}, 400

    print("🎤 Anchor started for:", roomId)

    def speak(text):
        filename = f"{uuid.uuid4()}.mp3"
        gTTS(text=text, lang="en").save(filename)

        with open(filename, "rb") as f:
            audio = base64.b64encode(f.read()).decode()

        socketio.emit("ai_audio", {"audio": audio}, room=roomId)

        os.remove(filename)

    def run():
        speak("Welcome to the meeting")
        time.sleep(2)
        speak("Meeting is starting now")
        time.sleep(2)
        speak("Please be ready")

    socketio.start_background_task(run)

    return {"status": "started"}

# ---------- RUN ----------
if __name__ == "__main__":
    print("🚀 Server running on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000)