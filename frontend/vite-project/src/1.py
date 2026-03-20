# anchor.py

import time
from pipeline import speak_pipeline

from gtts import gTTS
import playsound, os, uuid
from googletrans import Translator

def speak(text, language="en"):
    # Translate text if needed
    if language != "en":
        translator = Translator()
        text = translator.translate(text, dest=language).text

    # Generate TTS
    filename = f"temp_{uuid.uuid4()}.mp3"
    tts = gTTS(text=text, lang=language)
    tts.save(filename)

    playsound.playsound(filename)
    os.remove(filename)

    print("AI Anchor:", text)
# 🧠 Generate agenda dynamically
def generate_agenda(data):
    agenda = f"Welcome everyone to {data['meeting_title']}. "

    agenda += "We are pleased to have you all here. "

    agenda += "Today we have the following speakers. "

    for i, session in enumerate(data["sessions"]):
        agenda += f"Speaker {i+1}, {session['speaker']}, will present on {session['topic']}. "

    agenda += "Each speaker is requested to follow the allotted time. "

    agenda += "Let us begin the session. Thank you."

    return agenda


# 🧾 Input function
def get_host_input():
    meeting_title = input("Enter meeting title: ")
    language = input("Enter preferred language: ")

    sessions = []
    n = int(input("Enter number of sessions: "))

    for i in range(n):
        speaker = input(f"Enter speaker {i+1} name: ")
        topic = input(f"Enter topic for speaker {i+1}: ")
        sessions.append({
            "speaker": speaker,
            "topic": topic
        })

    time_per_speaker = int(input("Enter time per speaker (seconds): "))

    return {
        "meeting_title": meeting_title,
        "language": language,
        "sessions": sessions,
        "time": time_per_speaker
    }


# 🎤 Main function
def run_anchor():
    data = get_host_input()
    lang = data["language"]
    t = data["time"]

    # 🎬 Speak full agenda
    agenda_text = generate_agenda(data)
    speak_pipeline(agenda_text, lang)

    # 🔁 Speaker loop
    for session in data["sessions"]:
        speak_pipeline(
            f"Now I invite {session['speaker']} to present on {session['topic']}.",
            lang
        )

        speak_pipeline("You may begin now.", lang)

        # ⏱️ Time handling
        if t > 10:
            time.sleep(t - 10)
            print("\n⚠️ 10 seconds remaining!\n")
            time.sleep(10)
        else:
            time.sleep(t)

        speak_pipeline("Time is up. Thank you.", lang)
        time.sleep(2)

    # 🎬 Closing
    speak_pipeline("Thank you all for participating.", lang)
    speak_pipeline("The conference is now concluded.", lang)


if __name__ == "__main__":
    run_anchor()

    import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "./JoinPreview.css";

import micOnIcon from "../assets/mic-on.jpg";
import micOffIcon from "../assets/mic-off.jpg";
import camOnIcon from "../assets/cam-on.webp";
import camOffIcon from "../assets/cam-off.jpg";

export default function JoinPreview() {
  const { mode } = useParams(); // "create" | "join"
  const navigate = useNavigate();
  const location = useLocation();

  /* ---------- HELPERS ---------- */
  const generateMeetingId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

  const generatePassword = () =>
    Math.random().toString(36).substring(2, 10);

  /* ---------- STATE ---------- */
  const [name, setName] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [password, setPassword] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [aiAnchor, setAiAnchor] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  /* ---------- NEW STATE FOR AI ANCHOR ---------- */
  const [meetingTitle, setMeetingTitle] = useState("");
  const [language, setLanguage] = useState("en");
  const [timePerSpeaker, setTimePerSpeaker] = useState(30);
  const [sessions, setSessions] = useState([{ speaker: "", topic: "" }]);

  /* ---------- AUTO GENERATE MEETING ID / PASSWORD ---------- */
  useEffect(() => {
    if (mode === "create") {
      setMeetingId(generateMeetingId());
      setPassword(generatePassword());
    }

    if (mode === "join" && location.state?.meetingId) {
      setMeetingId(location.state.meetingId);
    }
  }, [mode, location.state]);

  /* ---------- GET MEDIA STREAM ---------- */
  useEffect(() => {
    let localStream;

    const getMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        localStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
        setCamOn(true);
      } catch (err) {
        console.error(err);
      }
    };

    getMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  /* ---------- MICROPHONE / CAMERA TOGGLE ---------- */
  const toggleMic = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);
  };

  const toggleCam = async () => {
    try {
      if (camOn) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setStream(null);
        setCamOn(false);
      } else {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(newStream);
        if (videoRef.current) videoRef.current.srcObject = newStream;
        setCamOn(true);
      }
    } catch (err) {
      console.error("Camera toggle error:", err);
    }
  };

  /* ---------- START / JOIN MEETING ---------- */
  const handleMeetingStart = async () => {
    if (!name.trim()) return alert("Please enter your name");
    if (!meetingId.trim()) return alert("Meeting ID is required");
    if (!sessions[0].speaker || !sessions[0].topic)
      return alert("Please enter at least one speaker and topic");

    // Send data to backend if AI Anchor enabled
    if (aiAnchor) {
      try {
        await fetch("http://localhost:5000/start-anchor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meeting_title: meetingTitle,
            sessions,
            language,
            time: timePerSpeaker,
          }),
        });
      } catch (err) {
        console.error("Failed to start AI anchor:", err);
      }
    }

    // Navigate to meeting page
    navigate(`/meeting/${meetingId}`, {
      state: {
        name,
        mode,
        micOn,
        camOn,
        aiAnchor,
        waitingRoom,
        meetingTitle,
        language,
        timePerSpeaker,
        sessions,
      },
    });
  };

  return (
    <div className="jp-container">
      <div className="jp-top-info">
        <h2>{mode === "create" ? "Create Meeting" : "Join Meeting"}</h2>
      </div>

      <div className="jp-main">
        <div className="jp-details">
          <input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Meeting ID"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
          />
          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setMeetingId(generateMeetingId())}>
                New Meeting ID
              </button>
            </div>
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "create" && (
            <div className="jp-regenerate">
              <button onClick={() => setPassword(generatePassword())}>
                Set Default Password
              </button>
            </div>
          )}

          {/* ---------- AI ANCHOR INPUTS ---------- */}
          {mode === "create" && (
            <>
              <input
                placeholder="Meeting Title"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
              />

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="ml">Malayalam</option>
                <option value="ta">Tamil</option>
              </select>

              <input
                type="number"
                placeholder="Time per speaker (seconds)"
                value={timePerSpeaker}
                onChange={(e) => setTimePerSpeaker(Number(e.target.value))}
              />

              <div>
                <h3>Speakers & Topics</h3>
                {sessions.map((s, index) => (
                  <div key={index} style={{ marginBottom: "10px" }}>
                    <input
                      placeholder="Speaker Name"
                      value={s.speaker}
                      onChange={(e) => {
                        const updated = [...sessions];
                        updated[index].speaker = e.target.value;
                        setSessions(updated);
                      }}
                    />
                    <input
                      placeholder="Topic"
                      value={s.topic}
                      onChange={(e) => {
                        const updated = [...sessions];
                        updated[index].topic = e.target.value;
                        setSessions(updated);
                      }}
                    />
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSessions([...sessions, { speaker: "", topic: "" }])
                  }
                >
                  + Add Speaker
                </button>
              </div>

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={() => setWaitingRoom(!waitingRoom)}
                />
                Waiting Room
              </label>

              <label className="jp-toggle">
                <input
                  type="checkbox"
                  checked={aiAnchor}
                  onChange={() => setAiAnchor(!aiAnchor)}
                />
                AI Anchor Assistant
              </label>
            </>
          )}

          {mode === "join" && (
            <div className="jp-field">
              <select>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="ml">Malayalam</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
          )}
        </div>

        {/* ---------- VIDEO ---------- */}
        <div className="jp-video-section">
          <div className="jp-video-box">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <div className="jp-controls">
            <button onClick={toggleMic}>
              <img src={micOn ? micOnIcon : micOffIcon} alt="mic" />
            </button>

            <button onClick={toggleCam}>
              <img src={camOn ? camOnIcon : camOffIcon} alt="cam" />
            </button>
          </div>
        </div>
      </div>

      <button className="jp-action-btn" onClick={handleMeetingStart}>
        {mode === "create" ? "Start" : "Join"}
      </button>
    </div>
  );
}
# anchor.py
import time
from gtts import gTTS
import playsound, os, uuid
from googletrans import Translator
import threading

# -------------------- AI SPEAK FUNCTION --------------------
def speak(text, language="en"):
    # Translate text if needed
    if language != "en":
        translator = Translator()
        text = translator.translate(text, dest=language).text

    # Generate TTS
    filename = f"temp_{uuid.uuid4()}.mp3"
    tts = gTTS(text=text, lang=language)
    tts.save(filename)

    playsound.playsound(filename)  # Play audio
    os.remove(filename)
    print("AI Anchor:", text)

# -------------------- GENERATE AGENDA --------------------
def generate_agenda(meeting_title, sessions):
    agenda = f"Welcome everyone to {meeting_title}. "
    agenda += "We are pleased to have you all here. "
    agenda += "Today we have the following speakers. "
    for i, session in enumerate(sessions):
        agenda += f"Speaker {i+1}, {session['speaker']}, will present on {session['topic']}. "
    agenda += "Each speaker is requested to follow the allotted time. "
    agenda += "Let us begin the session. Thank you."
    return agenda

# -------------------- MAIN RUN FUNCTION --------------------
def run_anchor(meeting_title, language, sessions, time_per_speaker):
    # 🎬 Speak full agenda
    agenda_text = generate_agenda(meeting_title, sessions)
    speak(agenda_text, language)

    # 🔁 Speaker loop
    for session in sessions:
        speak(f"Now I invite {session['speaker']} to present on {session['topic']}.", language)
        speak("You may begin now.", language)

        # ⏱️ Timer for speaker
        if time_per_speaker > 10:
            time.sleep(time_per_speaker - 10)
            speak("10 seconds remaining!", language)
            time.sleep(10)
        else:
            time.sleep(time_per_speaker)

        speak("Time is up. Thank you.", language)
        time.sleep(2)

    # 🎬 Closing
    speak("Thank you all for participating.", language)
    speak("The conference is now concluded.", language)

# -------------------- THREAD-LAUNCHED FUNCTION --------------------
def start_meeting_anchor(meeting_title, language, sessions, time_per_speaker):
    """Call this function when host clicks Start"""
    threading.Thread(
        target=run_anchor,
        args=(meeting_title, language, sessions, time_per_speaker)
    ).start()


# -------------------- EXAMPLE USAGE --------------------
if __name__ == "__main__":
    # Example usage for testing:
    meeting_title = "AI Multilingual Conference"
    language = "en"
    sessions = [
        {"speaker": "Alice", "topic": "AI in Healthcare"},
        {"speaker": "Bob", "topic": "Deep Learning Applications"}
    ]
    time_per_speaker = 15  # seconds per speaker

    start_meeting_anchor(meeting_title, language, sessions, time_per_speaker)

    # ---------- AI Anchor speaking logic ----------
def run_anchor(data):
    meeting_title = data.get("meeting_title", "Meeting")
    sessions = data.get("sessions", [])
    host_language = data.get("language", "en")
    time_per_speaker = data.get("time", 30)
    full_agenda = data.get("full_agenda", "")

    # 1️⃣ Speak full agenda
    if full_agenda:
        audio_b64 = text_to_audio_base64(full_agenda, host_language)
        print("Emitting full agenda audio...")
        socketio.emit("ai_audio", {"audio": audio_b64})

    time.sleep(2)

    # 2️⃣ Loop through speakers
    for session in sessions:
        intro_text = f"Now I invite {session['speaker']} to present on {session['topic']}."
        audio_b64 = text_to_audio_base64(intro_text, host_language)
        print(f"Emitting intro audio for {session['speaker']}...")
        socketio.emit("ai_audio", {"audio": audio_b64})

        begin_text = "You may begin now."
        audio_b64 = text_to_audio_base64(begin_text, host_language)
        socketio.emit("ai_audio", {"audio": audio_b64})
