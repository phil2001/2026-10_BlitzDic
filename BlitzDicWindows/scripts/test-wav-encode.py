import io
from pathlib import Path
import sys
import unittest
import wave
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from wav_encode import encode_wav


class WaveEncoding(unittest.TestCase):
    def test_pcm_range_duration_and_rounding(self):
        samples = np.array([-2, -1, -.5, 0, .5, 1, 2, 1 / 32768], dtype=np.float32)
        with wave.open(io.BytesIO(encode_wav(samples, 16000))) as stream:
            self.assertEqual((stream.getnchannels(), stream.getsampwidth(), stream.getframerate(), stream.getnframes()),
                             (1, 2, 16000, len(samples)))
            self.assertEqual(np.frombuffer(stream.readframes(len(samples)), dtype='<i2').tolist(),
                             [-32768, -32768, -16384, 0, 16384, 32767, 32767, 1])

    def test_invalid_audio_and_empty_buffer(self):
        for samples in [np.array([np.nan]), np.array([np.inf]), np.zeros((2, 2))]:
            with self.assertRaises(ValueError): encode_wav(samples, 16000)
        with self.assertRaises(ValueError): encode_wav(np.zeros(2), 0)
        with wave.open(io.BytesIO(encode_wav(np.empty(0), 16000))) as stream:
            self.assertEqual(stream.getnframes(), 0)


if __name__ == '__main__': unittest.main()
