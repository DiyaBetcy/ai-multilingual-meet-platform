# pipeline.py

import os
import time
from gtts import gTTS
from deep_translator import GoogleTranslator
import pygame

pygame.mixer.init()

LANG_MAP = {
    "english": "en", "en": "en",
    "hindi": "hi", "hi": "hi",
    "malayalam": "ml", "ml": "ml",
    "tamil": "ta", "ta": "ta"
}


def translate_text(text, target_language):
    target_language = target_language.lower().strip()
    lang_code = LANG_MAP.get(target_language, "en")

    if lang_code == "en":
        return text, lang_code

    try:
        translated = GoogleTranslator(source='auto', target=lang_code).translate(text)
        return translated, lang_code
    except:
        return text, "en"


def text_to_speech(text, lang_code):
    filename = "temp.mp3"
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


def speak_pipeline(text, language="english"):
    print("Original:", text)

    translated_text, lang_code = translate_text(text, language)

    print("Translated:", translated_text)

    file = text_to_speech(translated_text, lang_code)
    play_audio(file)
    cleanup(file)