from gtts import gTTS
import whisper
from transformers import MBartForConditionalGeneration, MBart50TokenizerFast
import os

# Step 1: Transcribe audio
model = whisper.load_model("base")
result = model.transcribe("hello-how-are-you-145245.mp3", fp16=False)
text = result["text"]  # This is the transcribed text
print(result["text"])

# Step 2: Load MBart for translation
tokenizer = MBart50TokenizerFast.from_pretrained("facebook/mbart-large-50-many-to-many-mmt")
mbart_model = MBartForConditionalGeneration.from_pretrained("facebook/mbart-large-50-many-to-many-mmt")

# Step 3: Prepare input for translation
tokenizer.src_lang = "en_XX"  # source language (English here)
inputs = tokenizer(text, return_tensors="pt")

# Step 4: Generate translation
translated_tokens = mbart_model.generate(**inputs, forced_bos_token_id=tokenizer.lang_code_to_id["ml_IN"])
translated_text = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

print(translated_text)

language = "fr"
tts = gTTS(text=translated_text,lang=language,slow=False)
tts.save("translated_audio.mp3")
os.system("start translated_audio.mp3.")