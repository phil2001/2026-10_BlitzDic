import sys
from pathlib import Path
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from meeting_asr import group_overlaps


class SpeakerRanges(unittest.TestCase):
    def test_overlapping_speakers_are_not_duplicated_or_assigned_to_one_person(self):
        source = [{'start': 3, 'end': 5, 'speaker': 3},
                  {'start': 0, 'end': 2, 'speaker': 1},
                  {'start': 1, 'end': 4, 'speaker': 2},
                  {'start': 6, 'end': 7, 'speaker': 1}]
        self.assertEqual(group_overlaps(source), [
            {'start': 0, 'end': 5, 'speakers': [1, 2, 3]},
            {'start': 6, 'end': 7, 'speakers': [1]}])
        self.assertNotIn('speakers', source[0])

    def test_touching_turns_and_silence(self):
        self.assertEqual(group_overlaps([]), [])
        source = [{'start': 0, 'end': 1, 'speaker': 1}, {'start': 1, 'end': 2, 'speaker': 2}]
        self.assertEqual(len(group_overlaps(source)), 2)


if __name__ == '__main__': unittest.main()
