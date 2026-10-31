"""Decode supported local audio containers to mono 16-kHz float PCM.

The shared PyAV decoder keeps import support consistent across ASR/diarization.
Only the first audio stream is selected; no video frames are decoded.
"""


def decode_audio(source):
    import av
    import numpy as np
    parts = []
    with av.open(source) as container:
        if not container.streams.audio:
            raise ValueError('Die Datei enthält keine Audiospur.')
        stream = container.streams.audio[0]
        resampler = av.AudioResampler(format='flt', layout='mono', rate=16000)
        decoded = False
        for frame in container.decode(stream):
            decoded = True
            parts.extend(item.to_ndarray().reshape(-1) for item in resampler.resample(frame))
        if decoded:
            parts.extend(item.to_ndarray().reshape(-1) for item in resampler.resample(None))
    return (np.concatenate(parts) if parts else np.empty(0, dtype='float32')), 16000
