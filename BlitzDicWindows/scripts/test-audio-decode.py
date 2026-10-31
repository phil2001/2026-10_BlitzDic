import io
from pathlib import Path
import sys
import unittest
import av
import numpy as np
import wave
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from audio_decode import decode_audio


class AudioDecode(unittest.TestCase):
    def test_stereo_resampling_preserves_duration_and_frequency(self):
        rate = 48000
        tone = (.2 * np.sin(2 * np.pi * 440 * np.arange(14400) / rate)).astype('float32')
        wav = io.BytesIO()
        with wave.open(wav, 'wb') as output:
            output.setnchannels(2); output.setsampwidth(2); output.setframerate(rate)
            output.writeframes((np.stack([tone, tone], axis=1) * 32767).astype('<i2').tobytes())
        wav.seek(0)
        samples, decoded_rate = decode_audio(wav)
        self.assertEqual(decoded_rate, 16000)
        self.assertEqual(samples.dtype, np.float32)
        self.assertEqual(samples.ndim, 1)
        self.assertLessEqual(abs(len(samples) - 4800), 1)
        frequencies = np.fft.rfftfreq(len(samples), 1 / decoded_rate)
        peak = frequencies[np.abs(np.fft.rfft(samples)).argmax()]
        self.assertLess(abs(peak - 440), 4)
        self.assertTrue(np.isfinite(samples).all())

    def test_video_only_container_is_rejected_without_decoding_video(self):
        output = io.BytesIO()
        with av.open(output, 'w', format='mp4') as container:
            stream = container.add_stream('mpeg4', rate=1); stream.width = 16; stream.height = 16
            frame = av.VideoFrame(16, 16, 'yuv420p')
            for plane in frame.planes: plane.update(bytes(plane.buffer_size))
            for packet in stream.encode(frame): container.mux(packet)
            for packet in stream.encode(None): container.mux(packet)
        output.seek(0)
        with self.assertRaisesRegex(ValueError, 'keine Audiospur'): decode_audio(output)


if __name__ == '__main__': unittest.main()
