# anchor.py

import time
from pipeline import speak_pipeline


def get_host_input():
    meeting_title = input("Enter meeting title: ")
    language = input("Enter preferred language: ").lower().strip()
    

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


def run_anchor():
    data = get_host_input()
    lang = data["language"]
    t = data["time"]

    # 🎬 Opening
    speak_pipeline(f"Welcome everyone to {data['meeting_title']}.", lang)
    speak_pipeline(f"The session language is {lang}.", lang)
    speak_pipeline("I am your AI anchor for this conference.", lang)

    # 🔁 Speaker loop
    for session in data["sessions"]:
        speak_pipeline(f"Now inviting {session['speaker']} to present.", lang)
        speak_pipeline(f"The topic is {session['topic']}.", lang)
        speak_pipeline("You may begin now.", lang)

        if t > 10:
            time.sleep(t - 10)
            print("⚠️ 10 seconds remaining!")
            time.sleep(10)
        else:
            time.sleep(t)

        speak_pipeline(" Thank you.", lang)
        time.sleep(2)

    # 🎬 Closing
    speak_pipeline("Thank you all for participating.", lang)
    speak_pipeline("The conference is now concluded.", lang)


if __name__ == "__main__":
    run_anchor()