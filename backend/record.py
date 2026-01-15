import sounddevice as sd
import soundfile as sf

fs = 16000
duration = 5
print("Speak now")
audio=sd.rec(int(duration*fs),samplerate=fs,channels=1)
sd.wait()

sf.write("test.wav",audio,fs)
print("Saved test.wav")