from fastapi import FastAPI, UploadFile, File
import whisper
import tempfile
import os
from gtts import gTTS
from backend.pipeline import translate_text  # your mBART function

app = FastAPI()

# Load Whisper once
model = whisper.load_model("base")

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):

    # Save uploaded file temporarily
    temp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    temp.write(await audio.read())
    temp.close()

    # Step 1: Speech to text
    result = model.transcribe(temp.name, fp16=False)
    os.remove(temp.name)

    original_text = result["text"]

    # Step 2: Translate (Example: Malayalam)
    translated_text = translate_text(original_text, "ml_IN")

    # Step 3: Convert to speech
    tts = gTTS(text=translated_text, lang="ml")
    tts.save("output.mp3")

    return {
        "original": original_text,
        "translated": translated_text,
        "voice_file": "output.mp3"
    }