import base64
import io
import sys
import unittest
import wave
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from dual_meeting import run


def audio(channels=2):
    target = io.BytesIO()
    with wave.open(target, 'wb') as stream:
        stream.setnchannels(channels); stream.setsampwidth(2); stream.setframerate(16000)
        stream.writeframes(bytes(16000 * channels * 2 * 4))
    return base64.b64encode(target.getvalue()).decode('ascii')


def result(text, start=0):
    words = [dict(text=word, start=start + i * .3, end=start + i * .3 + .2) for i, word in enumerate(text.split())]
    return dict(text=text, words=words)


class DualMeeting(unittest.TestCase):
    def test_echo_removed_only_from_microphone_and_system_is_retained(self):
        sources = [result('Remote words echoed here.'), result('Remote words echoed here.')]
        def recognize(request):
            self.assertTrue(request['wordTimestamps'])
            with wave.open(io.BytesIO(base64.b64decode(request['audioBase64']))) as stream:
                self.assertEqual(stream.getnchannels(), 1)
            return sources.pop(0)
        output = run({'audioBase64': audio()}, recognize)
        self.assertEqual(output['echoRemovedWords'], 4)
        self.assertEqual(output['text'], 'Systemaudio: Remote words echoed here.')
        self.assertEqual(output['segments'][0]['source'], 'system')

    def test_own_reply_stays_and_remote_speakers_do_not_claim_mic_identity(self):
        sources = [result('I can prepare it.', 2), result('Please prepare the file.')]
        calls = []
        def detection(request):
            calls.append(request)
            return {'speakers': [{'start': 0, 'end': 1.5, 'speaker': 1}]}
        output = run({'audioBase64': audio(), 'diarize': True, 'diarizationDirectory': 'models/diarization', 'speakerCount': 1},
                     lambda _: sources.pop(0), detection)
        self.assertEqual(output['echoRemovedWords'], 0)
        self.assertEqual(output['speakerCount'], 2)
        self.assertEqual(calls[0]['modelDirectory'], 'models/diarization')
        self.assertEqual([item['speakers'] for item in output['segments']], [[2], [1]])
        self.assertIn('Sprecher 1: I can prepare it.', output['text'])

    def test_missing_timing_falls_back_to_the_complete_mixed_transcript_with_warning(self):
        requests = []
        def recognize(request):
            requests.append(request)
            return {'text': 'Complete mixed transcript.'}
        output = run({'audioBase64': audio(), 'diarize': True}, recognize)
        self.assertEqual(requests[-1]['action'], 'transcribe-speakers')
        self.assertFalse(requests[-1]['wordTimestamps'])
        self.assertEqual(requests[-1]['audioBase64'], audio())
        self.assertEqual(output['text'], 'Complete mixed transcript.')
        self.assertIn('gemischte Aufnahme', output['warning'])

    def test_invalid_layout_rejected_before_any_asr(self):
        with self.assertRaises(ValueError):
            run({'audioBase64': audio(1)}, lambda _: self.fail('No ASR on invalid input'))


if __name__ == '__main__':
    unittest.main()
