"""Actual local models, synthetic fixture tracks; no microphone/system capture."""
import base64
import io
from pathlib import Path
import sys
import wave
import json
import os
import subprocess
import numpy as np
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'speech'))
from audio_decode import decode_audio
if '--resources' in sys.argv:
    resources = Path(sys.argv[sys.argv.index('--resources') + 1]).resolve()
    model_root = resources / 'models'
    def run(request):
        env = {**os.environ, 'PATH': os.pathsep.join([str(Path(os.environ['SystemRoot']) / 'System32'), os.environ['SystemRoot']])}
        process = subprocess.run([str(resources / 'speech-runtime/blitzdic-speech.exe')],
                                 input=json.dumps(request), capture_output=True, text=True,
                                 encoding='utf-8', env=env, timeout=600, check=True)
        return json.loads(process.stdout)
else:
    from worker import run
    model_root = root / 'models'

speech, rate = decode_audio(str(root / '.runtime/test-speech.wav'))
length = len(speech) * 2 + rate * 7
system = np.zeros(length, dtype=np.float32)
mic = np.zeros(length, dtype=np.float32)
system[:len(speech)] = speech
delay = int(rate * .3)
mic[delay:delay + len(speech)] = speech * .7
own_start = len(speech) + rate * 6
mic[own_start:own_start + len(speech)] = speech
stereo = np.column_stack((mic, system))
target = io.BytesIO()
with wave.open(target, 'wb') as stream:
    stream.setnchannels(2); stream.setsampwidth(2); stream.setframerate(rate)
    stream.writeframes(np.clip(np.rint(stereo * 32768), -32768, 32767).astype('<i2').tobytes())
for preset in ('whisper', 'parakeet-ultra'):
    request = {'action': 'transcribe-meeting', 'preset': preset,
               'modelDirectory': str(model_root / preset), 'language': 'en',
               'audioBase64': base64.b64encode(target.getvalue()).decode('ascii'),
               **({'diarize': True, 'diarizationDirectory': str(model_root / 'diarization'), 'speakerCount': 1} if '--speakers' in sys.argv else {})}
    output = run(request)
    assert not output.get('warning'), output.get('warning')
    assert output['echoRemovedWords'] >= 6, output
    for source in ('microphone', 'system'):
        text = ' '.join(item['text'] for item in output['segments'] if item['source'] == source)
        assert text.lower().count('local speech recognition test') == 1, (preset, source, text)
    assert all(item['start'] >= own_start / rate - 1 for item in output['segments'] if item['source'] == 'microphone')
    if '--speakers' in sys.argv:
        assert output['speakerCount'] == 2, output
        assert any(item['speakers'] == [1] and item['source'] == 'microphone' for item in output['segments'])
        assert any(item['speakers'] == [2] and item['source'] == 'system' for item in output['segments'])
    print(f"PASS {preset}: real token/word times, delayed acoustic-copy fixture removed ({output['echoRemovedWords']} words), later own reply + original system text retained.", flush=True)
