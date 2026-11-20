"""Persistent capture/insert service, tested without reading any application field."""
from contextlib import redirect_stderr
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest

speech = Path(__file__).resolve().parents[1] / 'speech'
sys.path.insert(0, str(speech))
from target_service import serve


def exchange(lines, handle):
    output = io.StringIO()
    with redirect_stderr(io.StringIO()):
        serve(handle, [line.encode('utf-8') for line in lines], output)
    return [json.loads(line) for line in output.getvalue().splitlines()]


def line(id, request):
    return json.dumps({'id': id, 'request': request}, ensure_ascii=False) + '\n'


class ServeTests(unittest.TestCase):
    def test_answers_in_order_with_utf8_text_and_clean_stdout(self):
        def handle(request):
            print('Bibliotheksausgabe')  # Must not reach the answer stream.
            return {'text': request.get('text')}
        answers = exchange([line(1, {'action': 'insert-text', 'text': 'Grüße 🌍'}),
                            line(2, {'action': 'capture-target'})], handle)
        self.assertEqual(answers, [{'event': 'ready'}, {'id': 1, 'result': {'text': 'Grüße 🌍'}},
                                   {'id': 2, 'result': {'text': None}}])

    def test_invalid_requests_and_handler_errors_are_answered_and_serving_continues(self):
        def handle(request):
            if request['action'] == 'insert-text':
                raise RuntimeError('Feld geändert')
            return {'ok': True}
        answers = exchange(['kein json\n', line(1, {'action': 'transcribe'}), json.dumps({'id': 'x'}) + '\n',
                            line(2, {'action': 'insert-text'}), line(3, {'action': 'capture-target'})], handle)
        self.assertEqual(answers[0], {'event': 'ready'})
        self.assertEqual([answer.get('id') for answer in answers[1:]], [None, 1, 'x', 2, 3])
        self.assertTrue(all('error' in answer for answer in answers[1:4]))
        self.assertEqual(answers[4], {'id': 2, 'error': 'Feld geändert'})
        self.assertEqual(answers[5], {'id': 3, 'result': {'ok': True}})

    def test_real_worker_serves_repeated_requests_in_one_process(self):
        process = subprocess.Popen([sys.executable, str(speech / 'worker.py'), '--target-service'],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            self.assertEqual(json.loads(process.stdout.readline()), {'event': 'ready'})
            impossible = {'window': 9223372036854775807, 'process': 1}
            for id in (1, 2):
                process.stdin.write(line(id, {'action': 'capture-target', 'website': True, 'scope': impossible}).encode('utf-8'))
                process.stdin.flush()
                answer = json.loads(process.stdout.readline())
                self.assertEqual(answer['id'], id)
                self.assertIsNone(answer['result']['target'])
                self.assertEqual(answer['result']['reason'], 'Vordergrundfenster geändert.')
            process.stdin.close()
            self.assertEqual(process.wait(timeout=10), 0)
        finally:
            process.kill()


if __name__ == '__main__':
    unittest.main()
