import pyttsx3

engine = pyttsx3.init('sapi5')
voices = engine.getProperty('voices')

engine.setProperty('voice', voices[1].id)  # Microsoft Zira
engine.setProperty('rate', 150)
engine.setProperty('volume', 1.0)

engine.say("Hello. This is the AI anchor speaking using Microsoft Zira.")
engine.runAndWait()
