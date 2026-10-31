"""Create original, deterministic ambient instrumentals. Requires numpy and ffmpeg."""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'public' / 'audio'
RATE = 22050
DURATION = 64

def synth(name, chords, seed, bpm):
    rng = np.random.default_rng(seed)
    size = RATE * DURATION
    sound = np.zeros(size, dtype=np.float64)
    def add(freq, at, length, gain, style='pad'):
        start = int(at * RATE)
        count = min(int(length * RATE), size-start)
        if count <= 0: return
        t = np.arange(count)/RATE
        if style == 'pad':
            envelope = np.minimum(t/1.5, 1) * np.minimum((length-t)/2.3, 1)
            tone = np.sin(2*np.pi*freq*t) + .25*np.sin(2*np.pi*freq*2.003*t) + .14*np.sin(2*np.pi*freq*.998*t)
        else:
            envelope = (1-np.exp(-t*100))*np.exp(-t*2.3)
            tone = np.sin(2*np.pi*freq*t)+.2*np.sin(2*np.pi*freq*2*t)
        sound[start:start+count] += gain*tone*envelope
    for i in range(8):
        chord=chords[i % len(chords)]
        for note in chord:
            add(440*2**((note-69)/12), i*8, 10, .065)
        add(440*2**((chord[0]-24-69)/12),i*8,8,.08)
    beat=60/bpm
    for i,at in enumerate(np.arange(0,DURATION,beat)):
        chord=chords[int(at//8)%len(chords)]
        note=chord[(i*3+i//4)%len(chord)]+12
        add(440*2**((note-69)/12),float(at),2.5,.075,'pluck')
        count=min(int(.25*RATE),size-int(at*RATE)); t=np.arange(count)/RATE
        kick=np.sin(2*np.pi*(45*t+3*(1-np.exp(-t*30))))*np.exp(-t*24)*.12
        sound[int(at*RATE):int(at*RATE)+count]+=kick
        if i%2:
            start=int((at+beat/2)*RATE); n=min(int(.12*RATE),size-start)
            if n>0:
                noise=rng.normal(0,1,n)*np.exp(-np.arange(n)/RATE*60)*.015
                sound[start:start+n]+=noise
    delay=int(RATE*.31)
    echo=np.zeros(size); echo[delay:]=sound[:-delay]*.22
    left=sound+echo
    right=sound+np.roll(echo,int(RATE*.08))
    fade=np.minimum(np.arange(size)/RATE/2,1)*np.minimum((size-np.arange(size))/RATE/4,1)
    stereo=np.stack([left*fade,right*fade],axis=1)
    stereo=stereo/(max(np.max(np.abs(stereo)),.001))*0.72
    with tempfile.TemporaryDirectory() as tmp:
        wav=Path(tmp)/'track.wav'
        with wave.open(str(wav),'wb') as stream:
            stream.setnchannels(2); stream.setsampwidth(2); stream.setframerate(RATE); stream.writeframes((stereo*32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','128k','-metadata','artist=Rustimin Originals','-metadata',f'title={name}',str(OUT/f'{name}.mp3')],check=True)
    print(f'{name}: {DURATION}s original stereo instrumental')

if __name__ == '__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    synth('night',[[57,60,64,67],[53,57,60,64],[48,55,59,62],[55,59,62,65]],10,75)
    synth('orbit',[[54,57,61,64],[50,54,57,61],[57,61,64,68],[52,56,59,63]],20,90)
    synth('dawn',[[60,64,67,71],[57,60,64,67],[53,57,60,64],[55,59,62,67]],30,66)
