# pipeline.py

import os
import time
from gtts import gTTS
from deep_translator import GoogleTranslator
import pygame

# 🎧 Initialize once
pygame.mixer.init()

# 🌍 Language mapping
LANG_MAP = {
    "english": "en",
    "en": "en",

    "malayalam": "ml",
    "ml": "ml",

    "hindi": "hi",
    "hi": "hi",

    "tamil": "ta",
    "ta": "ta"
}


def translate_text(text, target_language):
    target_language = target_language.lower().strip()
    lang_code = LANG_MAP.get(target_language, "en")

    print("Target language code:", lang_code)

    if lang_code == "en":
        return text, lang_code

    try:
        translated = GoogleTranslator(
            source='auto',
            target=lang_code
        ).translate(text)

        print("Translated text:", translated)

        return translated, lang_code

    except Exception as e:
        print("Translation failed:", e)
        return text, "en"


def text_to_speech(text, lang_code, filename="temp.mp3"):
    tts = gTTS(text=text, lang=lang_code)
    tts.save(filename)
    return filename


def play_audio(filename):
    pygame.mixer.music.load(filename)
    pygame.mixer.music.play()

    while pygame.mixer.music.get_busy():
        time.sleep(0.1)

    pygame.mixer.music.unload()


def cleanup(filename):
    try:
        os.remove(filename)
    except:
        pass


# 🎤 MAIN PIPELINE FUNCTION
def speak_pipeline(text, target_language="english"):
    try:
        # Step 1: Translate
        translated_text, lang_code = translate_text(text, target_language)
        print(f"[Translated]: {translated_text}")

        print("Original:", text)
        # Step 2: TTS
        file = text_to_speech(translated_text, lang_code)

        # Step 3: Play
        play_audio(file)

        # Step 4: Cleanup
        cleanup(file)

    except Exception as e:
        print("Pipeline Error:", e)
