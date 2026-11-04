import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from word_timing import token_words


class TokenTiming(unittest.TestCase):
    def test_actual_subword_times_punctuation_and_chunk_offset(self):
        words = token_words([' Local', ' speech', ' recog', 'nition', ' test', '.'],
                            [0.2, 0.5, 1.2, 1.3, 1.8, 2.1], 2.2, 20)
        self.assertEqual([word['text'] for word in words], ['Local', 'speech', 'recognition', 'test.'])
        self.assertEqual([word['start'] for word in words], [20.2, 20.5, 21.2, 21.8])
        self.assertAlmostEqual(words[2]['end'], 21.38)
        self.assertAlmostEqual(words[-1]['end'], 21.88)

    def test_unicode_spaces_empty_and_end_clamp(self):
        self.assertEqual(token_words([], [], 0), [])
        words = token_words(['▁Über', 'prüfung,', '\n', '😀', '\t', '2500', ' Euro'],
                            [0, 0.1, 0.5, 0.6, 0.7, 0.8, 1.0], 1)
        self.assertEqual([word['text'] for word in words], ['Überprüfung,', '😀', '2500', 'Euro'])
        self.assertEqual(words[-1]['end'], 1)

    def test_a_long_pause_does_not_extend_the_previous_word(self):
        words = token_words([' 9', '.', ' Next'], [5.2, 11.28, 11.4], 12)
        self.assertAlmostEqual(words[0]['end'], 5.28)
        self.assertEqual(words[1]['start'], 11.4)

    def test_missing_mismatched_invalid_or_reversed_times_fail(self):
        for tokens, times, duration in [(None, None, 1), (['a'], [], 1), (['a'], [float('nan')], 1),
                                       (['a'], [-0.1], 1), (['a'], [2], 1), (['a', 'b'], [0.8, 0.1], 1),
                                       (['a'], [0], float('inf')), ([3], [0], 1)]:
            with self.assertRaises(ValueError):
                token_words(tokens, times, duration)


if __name__ == '__main__':
    unittest.main()
