from fastapi import FastAPI,UploadFile,File
import whisper
import tempfile
import os

app = FastAPI()

model = whisper.load_model("base")
@app.post("/transcribe")
async def transcribe(audio: UploadFile=File(...)):
    temp=tempfile.NamedTemporaryFile(delete=False,suffix=".wav")
    temp.write(await audio.read())
    temp.close()

    result = model.transcribe(temp.name)
    os.remove(temp.name)
    return {"text":result["text"]}
