"""Model preloading is tested without ASR libraries or model files."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

speech = Path(__file__).resolve().parents[1] / 'speech'
sys.path.insert(0, str(speech))
import worker


class PreloadTests(unittest.TestCase):
    def setUp(self):
        self.loaded = []
        self.original = worker.load_whisper, worker.load_parakeet
        worker.load_whisper = lambda root: self.loaded.append(('whisper', root))
        worker.load_parakeet = lambda root: self.loaded.append(('parakeet', root))

    def tearDown(self):
        worker.load_whisper, worker.load_parakeet = self.original

    def test_preload_warms_the_cache_key_used_by_a_request_for_the_same_directory(self):
        directory = str(Path('models') / 'whisper')
        worker.preload('whisper', directory)
        worker.preload('parakeet', directory)
        expected = str(Path(directory).resolve())  # As run() computes it.
        self.assertEqual(self.loaded, [('whisper', expected), ('parakeet', expected)])

    def test_unknown_engine_is_rejected(self):
        with self.assertRaises(ValueError):
            worker.preload('unknown', 'models')
        self.assertEqual(self.loaded, [])

    def test_failed_preload_still_answers_the_request_with_clean_json(self):
        result = subprocess.run([sys.executable, str(speech / 'worker.py'), '--preload', 'unknown', 'models'],
                                input=json.dumps({'action': 'transcribe', 'modelDirectory': 'models'}).encode(),
                                capture_output=True, timeout=60)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout), {'error': 'Unbekannte Spracherkennungs-Engine.'})
        self.assertIn('Vorladen fehlgeschlagen', result.stderr.decode('utf-8', errors='replace'))


if __name__ == '__main__':
    unittest.main()
