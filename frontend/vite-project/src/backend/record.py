import sounddevice as sd
import soundfile as sf

def record_audio(filename="test.wav", duration=5, fs=16000):
    print("Speak now...")
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1)
    sd.wait()
    sf.write(filename, audio, fs)
    print(f"Saved {filename}")
    return filename