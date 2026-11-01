"""Escape ownership and real hook lifecycle; never synthesizes input."""
from pathlib import Path
import json
import os
import subprocess
import sys
import unittest

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'speech'))
from escape_control import EscapeGate


class EscapeTest(unittest.TestCase):
    def test_idle_other_keys_and_preheld_escape_pass_through(self):
        gate = EscapeGate()
        self.assertEqual(gate.key(0x1B, True), (False, False))
        gate.arm(already_down=True)
        self.assertEqual(gate.key(0x1B, True), (False, False))
        self.assertEqual(gate.key(0x1B, False), (False, False))
        self.assertEqual(gate.key(0x41, True), (False, False))
        self.assertEqual(gate.key(0x41, False), (False, False))
        self.assertEqual(gate.key(0x1B, True), (True, True))

    def test_repeat_and_keyup_are_owned_after_disarm(self):
        gate = EscapeGate(); gate.arm()
        self.assertEqual(gate.key(0x1B, True), (True, True))
        self.assertEqual(gate.key(0x1B, True), (True, False))
        gate.disarm()
        self.assertEqual(gate.key(0x1B, True), (True, False))
        self.assertEqual(gate.key(0x1B, False), (True, False))
        self.assertFalse(gate.owned)
        self.assertEqual(gate.key(0x1B, True), (False, False))

    def test_rearm_during_same_press_does_not_emit_again(self):
        gate = EscapeGate(); gate.arm()
        gate.key(0x1B, True); gate.disarm(); gate.arm()
        self.assertEqual(gate.key(0x1B, True), (True, False))
        gate.key(0x1B, False)
        self.assertEqual(gate.key(0x1B, True), (True, True))

    @unittest.skipUnless(sys.platform == 'win32', 'Windows hook lifecycle')
    def test_native_arm_disarm_and_pipe_close(self):
        commands = ''.join(json.dumps({'id': i, 'active': active}) + '\n'
                           for i, active in enumerate((True, False, True, False), 1))
        runtime = os.environ.get('BLITZDIC_TEST_RUNTIME')
        runner = [runtime] if runtime else [sys.executable, str(root / 'speech/worker.py')]
        result = subprocess.run([*runner, '--escape-control'],
                                input=commands, capture_output=True, text=True, timeout=10,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        events = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(events, [{'event': 'ready'}] + [
            {'event': 'state', 'id': i, 'active': active}
            for i, active in enumerate((True, False, True, False), 1)])


if __name__ == '__main__': unittest.main()
