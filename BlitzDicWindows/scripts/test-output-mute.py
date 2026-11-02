"""Mute lifecycle tests use fake endpoints; they never change Windows audio."""
import io
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'speech'))
from output_mute import MuteLease, serve


class FakeEndpoint:
    def __init__(self, muted=False):
        self.value = muted
        self.writes = []
        self.closed = 0
        self.fail_mute = False
        self.fail_restore = 0

    def muted(self):
        return self.value

    def set_muted(self, value):
        self.writes.append(value)
        if not value and self.fail_restore:
            self.fail_restore -= 1
            raise RuntimeError('driver failure')
        self.value = value
        if value and self.fail_mute:
            raise RuntimeError('partial driver failure')

    def close(self):
        self.closed += 1


class MuteTests(unittest.TestCase):
    def test_repeat_and_restore_once(self):
        endpoint = FakeEndpoint()
        lease = MuteLease(lambda: endpoint)
        lease.set_active(True); lease.set_active(True)
        self.assertEqual(endpoint.writes, [True])
        lease.set_active(False); lease.close()
        self.assertEqual(endpoint.writes, [True, False])
        self.assertEqual(endpoint.closed, 1)

    def test_existing_mute_belongs_to_user(self):
        endpoint = FakeEndpoint(True)
        lease = MuteLease(lambda: endpoint)
        lease.set_active(True); lease.close()
        self.assertEqual(endpoint.writes, [])
        self.assertTrue(endpoint.value)
        self.assertEqual(endpoint.closed, 1)

    def test_changed_default_never_redirects_restore(self):
        first, second = FakeEndpoint(), FakeEndpoint()
        devices = iter([first, second])
        lease = MuteLease(lambda: next(devices))
        lease.set_active(True); lease.restore()
        self.assertEqual(second.writes, [])
        lease.set_active(True); lease.close()
        self.assertEqual(first.writes, [True, False])
        self.assertEqual(second.writes, [True, False])

    def test_partial_mute_failure_restores_original_state(self):
        endpoint = FakeEndpoint(); endpoint.fail_mute = True
        lease = MuteLease(lambda: endpoint)
        with self.assertRaises(RuntimeError): lease.set_active(True)
        lease.close()
        self.assertFalse(endpoint.value)
        self.assertEqual(endpoint.writes, [True, False])
        self.assertEqual(endpoint.closed, 1)

    def test_failed_restore_retries_same_endpoint_on_eof(self):
        endpoint = FakeEndpoint(); endpoint.fail_restore = 1
        lease = MuteLease(lambda: endpoint); lease.set_active(True)
        with self.assertRaises(RuntimeError): lease.restore()
        self.assertEqual(endpoint.closed, 0)
        lease.close()
        self.assertFalse(endpoint.value)
        self.assertEqual(endpoint.writes, [True, False, False])
        self.assertEqual(endpoint.closed, 1)

    def test_eof_restores_and_malformed_commands_do_not_mute(self):
        endpoint = FakeEndpoint(); output = io.StringIO()
        serve(io.StringIO('{"id":1,"active":true}\n{"id":2,"active":"false"}\n'), output, lambda: endpoint)
        self.assertEqual(endpoint.writes, [True, False])
        self.assertEqual([json.loads(line)['event'] for line in output.getvalue().splitlines()], ['ready','state','error'])
        self.assertEqual(endpoint.closed, 1)


if __name__ == '__main__': unittest.main()
