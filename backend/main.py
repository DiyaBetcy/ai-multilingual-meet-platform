from fastapi import FastAPI,UploadFile,File
import whisper
import tempfile
import os
from googletrans import Translator
from gtts import gTTS

app = FastAPI()

model = whisper.load_model("base")
translator = Translator()

@app.post("/transcribe")
async def transcribe(audio: UploadFile=File(...)):
    temp=tempfile.NamedTemporaryFile(delete=False,suffix=".wav")
    temp.write(await audio.read())
    temp.close()

    result = model.transcribe(temp.name)
    os.remove(temp.name)

    original = result["text"]
    translated = translator.translate(original,dest="ml")
    tts = gTTS(text=translated.text,lang="ml")
    tts.save("output.mp3")

    return {"original":original,
            "translated": translated.text,
            "voice": "output.mp3"}
