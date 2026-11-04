"""Offline meeting ASR for synchronized PCM16 stereo (mic left, system right)."""
import base64
import io
import math
import wave


def checked_words(result, duration):
    words = result.get('words')
    if not isinstance(words, list) or (result.get('text', '').strip() and not words):
        raise ValueError('Wortzeitpunkte fehlen.')
    previous = -1
    for word in words:
        if (not isinstance(word, dict) or not isinstance(word.get('text'), str) or
                not word['text'].strip() or
                any(type(word.get(key)) not in (int, float) or not math.isfinite(word[key]) for key in ('start', 'end')) or
                not previous <= word['start'] <= word['end'] <= duration + 0.5 or word['start'] < 0):
            raise ValueError('Ungültige Wortzeitpunkte.')
        previous = word['start']
    return words


def paragraphs(words, source, labels):
    entries = []
    for word in words:
        speakers = labels(word)
        if (entries and entries[-1]['speakers'] == speakers and
                word['start'] - entries[-1]['end'] <= 1 and
                word['start'] - entries[-1]['start'] < 15 and
                not entries[-1]['text'].endswith(('.', '?', '!'))):
            entries[-1]['text'] += ' ' + word['text']
            entries[-1]['end'] = max(entries[-1]['end'], word['end'])
        else:
            entries.append({**word, 'source': source, 'speakers': speakers})
    return entries


def run(request, transcribe, detect=None):
    import numpy as np
    from wav_encode import encode_wav
    from echo_filter import remove_echo
    encoded = request.get('audioBase64')
    source = io.BytesIO(base64.b64decode(encoded, validate=True)) if encoded else request['audioPath']
    with wave.open(source, 'rb') as stream:
        rate, count = stream.getframerate(), stream.getnframes()
        if (stream.getnchannels() != 2 or stream.getsampwidth() != 2 or rate != 16000 or
                stream.getcomptype() != 'NONE' or count > rate * 1801):
            raise ValueError('Echo-Filter erwartet eine synchrone PCM16-Stereoaufnahme mit 16 kHz, höchstens 30 Minuten.')
        pcm = stream.readframes(count)
        if len(pcm) != count * 4:
            raise ValueError('Unvollständige Zweispuraufnahme.')
    tracks = np.frombuffer(pcm, dtype='<i2').reshape(-1, 2).astype(np.float32) / 32768
    duration = count / rate
    base = {**request, 'action': 'transcribe', 'wordTimestamps': True}
    try:
        mic = checked_words(transcribe({**base, 'audioBase64': base64.b64encode(encode_wav(tracks[:, 0], rate)).decode('ascii')}), duration)
        system_audio = base64.b64encode(encode_wav(tracks[:, 1], rate)).decode('ascii')
        system = checked_words(transcribe({**base, 'audioBase64': system_audio}), duration)
        own = remove_echo(mic, system)
        diarize = request.get('diarize') is True
        bias = 1 if own else 0
        ranges = []
        if diarize and system:
            if detect is None:
                from diarization import run as detect
            detection = detect({**request, 'action': 'diarize', 'modelDirectory': request['diarizationDirectory'],
                                'audioBase64': system_audio})
            ranges = detection['speakers']

        def system_labels(word):
            if not diarize:
                return []
            middle = (word['start'] + word['end']) / 2
            # Unmatched words retain their source label, rather than inventing a speaker.
            return sorted({item['speaker'] + bias for item in ranges
                           if item['start'] <= middle <= item['end'] and item['speaker'] + bias <= 20})

        entries = paragraphs(own, 'microphone', lambda _: [1] if diarize else [])
        entries += paragraphs(system, 'system', system_labels)
        entries.sort(key=lambda item: item['start'])
        lines = []
        for item in entries:
            label = 'Sprecher ' + ' / '.join(map(str, item['speakers'])) if item['speakers'] else (
                'Mikrofon' if item['source'] == 'microphone' else 'Systemaudio')
            if len(item['speakers']) > 1:
                label += ' (überlappend)'
            lines.append(f"{label}: {item['text']}")
        return {'text': '\n'.join(lines), 'segments': entries, 'language': request.get('language'),
                'speakerCount': len({speaker for item in entries for speaker in item['speakers']}),
                'echoRemovedWords': len(mic) - len(own)}
    except Exception:
        # Keep the complete mixed transcript available when custom models cannot
        # provide timing or source/speaker processing fails. Cancellation kills
        # this entire owned worker; it cannot start a fallback after process exit.
        action = 'transcribe-speakers' if request.get('diarize') is True else 'transcribe'
        result = transcribe({**request, 'action': action, 'wordTimestamps': False})
        return {**result, 'warning': 'Echo-Filter nicht verfügbar. Die vollständige gemischte Aufnahme wurde transkribiert; Dopplungen sind möglich.'}
