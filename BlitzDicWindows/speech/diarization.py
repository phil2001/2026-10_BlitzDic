"""Offline speaker time ranges, using separately bundled auxiliary models.

Speaker IDs describe clusters within one recording, not real-world identities.
"""
import base64
import io
from pathlib import Path


def run(request):
    import av
    import numpy as np
    import soundfile as sf
    import sherpa_onnx as sherpa
    root = Path(request['modelDirectory']).resolve()
    count = request.get('speakerCount', -1)
    if type(count) is not int or (count != -1 and not 1 <= count <= 20):
        raise ValueError('Sprecherzahl muss automatisch oder zwischen 1 und 20 sein.')
    config = sherpa.OfflineSpeakerDiarizationConfig(
        segmentation=sherpa.OfflineSpeakerSegmentationModelConfig(
            pyannote=sherpa.OfflineSpeakerSegmentationPyannoteModelConfig(
                model=str(root / 'model.int8.onnx'), window_shift_ratio=0.1)),
        embedding=sherpa.SpeakerEmbeddingExtractorConfig(model=str(root / 'nemo_en_titanet_small.onnx')),
        clustering=sherpa.FastClusteringConfig(num_clusters=count, threshold=0.5),
        min_duration_on=0.3, min_duration_off=0.5)
    if not config.validate():
        raise ValueError('Lokale Sprecherzuordnungsmodelle fehlen oder sind unvollständig.')
    audio = (io.BytesIO(base64.b64decode(request['audioBase64'], validate=True))
             if request.get('audioBase64') else str(Path(request['audioPath']).resolve(strict=True)))
    waveform, rate = sf.read(audio, dtype='float32', always_2d=True)
    waveform = waveform.mean(axis=1)
    if not len(waveform): return {'speakers': [], 'speakerCount': 0}
    model = sherpa.OfflineSpeakerDiarization(config)
    if rate != model.sample_rate:
        frame = av.AudioFrame.from_ndarray(waveform.reshape(1, -1), format='flt', layout='mono')
        frame.sample_rate = rate
        resampler = av.AudioResampler(format='flt', layout='mono', rate=model.sample_rate)
        frames = resampler.resample(frame) + resampler.resample(None)
        waveform = np.concatenate([item.to_ndarray().reshape(-1) for item in frames])
    result = model.process(waveform)
    segments = result.sort_by_start_time()
    # Normalize cluster IDs by first appearance for understandable display.
    labels = {}
    items = []
    for segment in segments:
        speaker = labels.setdefault(segment.speaker, len(labels) + 1)
        items.append({'start': segment.start, 'end': segment.end, 'speaker': speaker})
    return {'speakers': items, 'speakerCount': len(labels)}
