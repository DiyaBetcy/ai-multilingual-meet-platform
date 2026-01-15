from fastapi import FastAPI,UploadFile,File
import whisper
import tempfile
import os
from googletrans import Translator

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

    return translated.text
