"""Encode internal mono audio as PCM16 WAV without a native codec dependency."""
import io
import wave
import numpy as np


def encode_wav(samples, sample_rate):
    samples = np.asarray(samples, dtype=np.float32)
    if samples.ndim != 1 or not np.isfinite(samples).all():
        raise ValueError('Interne Audioaufnahme muss endliche Mono-Samples enthalten.')
    if not isinstance(sample_rate, int) or sample_rate <= 0:
        raise ValueError('Ungültige Abtastrate.')
    # Match PCM16's asymmetric range; round to the nearest representable sample.
    pcm = np.clip(np.rint(samples.astype(np.float64) * 32768), -32768, 32767).astype('<i2')
    output = io.BytesIO()
    with wave.open(output, 'wb') as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(pcm.tobytes())
    return output.getvalue()
