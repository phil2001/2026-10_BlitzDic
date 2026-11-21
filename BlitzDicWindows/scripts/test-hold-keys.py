"""Windows shortcut-state tests; never reads or synthesizes real keystrokes."""
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from keyboard_hold import shortcut_keys, wait_for_release


class HoldKeysTest(unittest.TestCase):
    def test_accelerators(self):
        self.assertEqual(shortcut_keys('CommandOrControl+Shift+1'), [[0x11], [0x10], [0x31]])
        self.assertEqual(shortcut_keys('Super+F24'), [[0x5B, 0x5C], [0x87]])
        self.assertEqual(shortcut_keys('AltGr+num3'), [[0xA5], [0x63]])
        self.assertEqual(shortcut_keys('Alt+PageDown'), [[0x12], [0x22]])
        # Default dictation shortcut; a sequence like Alt+Space+1 is held on its first part.
        self.assertEqual(shortcut_keys('Alt+Space'), [[0x12], [0x20]])
        self.assertEqual(shortcut_keys('Control+Plus')[0], [0x11])
        for value in ('', 'Control+', 'Control++', 'Shift', 'Command+A', 'F25', 'Bad+1', None):
            with self.assertRaises(ValueError): shortcut_keys(value)

    def test_release_and_timeout(self):
        now = [0]
        def pause(amount): now[0] += amount
        result = wait_for_release([[17], [49]], down=lambda key: key == 17 or now[0] < .04,
                                  clock=lambda: now[0], pause=pause)
        self.assertTrue(result['released']); self.assertGreaterEqual(now[0], .04)
        self.assertTrue(wait_for_release([[49]], down=lambda _key: False)['released'])
        result = wait_for_release([[49]], down=lambda _key: True, clock=lambda: now[0], pause=pause, limit=.03)
        self.assertTrue(result['timedOut'])
        # Either Windows key satisfies the Super group; releasing the main key ends it.
        self.assertTrue(wait_for_release([[91, 92], [65]], down=lambda key: key == 92)['released'])


if __name__ == '__main__': unittest.main()
