"""Transcribe diarized turns with a shared ASR instance inside one worker.

Overlapping ranges are transcribed once with multiple possible speaker labels.
No word-level or real-world speaker identity is claimed.
"""
import base64
import io


def group_overlaps(ranges):
    groups = []
    for segment in sorted(ranges, key=lambda item: item['start']):
        if groups and segment['start'] < groups[-1]['end']:
            groups[-1]['end'] = max(groups[-1]['end'], segment['end'])
            groups[-1]['speakers'] = sorted(set(groups[-1]['speakers'] + [segment['speaker']]))
        else:
            groups.append({'start': segment['start'], 'end': segment['end'], 'speakers': [segment['speaker']]})
    return groups


def run(request, transcribe):
    import soundfile as sf
    from diarization import run as diarize
    audio = (io.BytesIO(base64.b64decode(request['audioBase64'], validate=True))
             if request.get('audioBase64') else request['audioPath'])
    waveform, rate = sf.read(audio, dtype='float32', always_2d=True)
    detection = diarize({**request, 'modelDirectory': request['diarizationDirectory']})
    groups = group_overlaps(detection['speakers'])
    entries = []
    for group in groups:
        # A small speech margin preserves initial/final consonants. Labels apply
        # to the detected range; the margin is only ASR context, not extra turns.
        start = max(0, int((group['start'] - 0.15) * rate))
        end = min(len(waveform), int((group['end'] + 0.15) * rate))
        buffer = io.BytesIO()
        sf.write(buffer, waveform[start:end], rate, format='WAV', subtype='PCM_16')
        result = transcribe({**request, 'action': 'transcribe',
                             'audioBase64': base64.b64encode(buffer.getvalue()).decode('ascii')})
        text = result['text'].strip()
        if text:
            entries.append({**group, 'text': text})
    lines = []
    for entry in entries:
        speakers = ' / '.join(str(speaker) for speaker in entry['speakers'])
        uncertainty = ' (überlappend)' if len(entry['speakers']) > 1 else ''
        lines.append(f"Sprecher {speakers}{uncertainty}: {entry['text']}")
    return {'text': '\n'.join(lines), 'segments': entries,
            'speakerCount': detection['speakerCount'], 'language': request.get('language')}
