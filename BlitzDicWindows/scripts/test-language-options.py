"""Language profiles are tested without downloading/loading ASR models."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from language_options import PROFILES, prepare_language, whisper_language_options


class LanguageOptionsTests(unittest.TestCase):
    def test_fixed_languages_do_not_request_detection(self):
        for language in ('de', 'en'):
            self.assertEqual(whisper_language_options({'language': language}), {'language': language})

    def test_medical_profile_uses_german_and_propagates_context_through_nested_requests(self):
        original = {'language': 'de-medical', 'medicalTerms': ['  Fachwort  eins ', 42, '', 'Befund'], 'action': 'transcribe-speakers'}
        nested = prepare_language(original)
        self.assertEqual(original['language'], 'de-medical')
        self.assertEqual(nested['language'], 'de')
        self.assertTrue(nested['medicalGerman'])
        options = whisper_language_options({**nested, 'action': 'transcribe'})
        self.assertEqual(options['language'], 'de')
        self.assertIn('Medizinisches Diktat', options['initial_prompt'])
        self.assertEqual(options['hotwords'], 'Fachwort eins, Befund')

    def test_context_is_bounded_and_does_not_leak_to_other_choices(self):
        options = whisper_language_options({'language': 'de-medical', 'medicalTerms': ['A' * 200] * 100})
        self.assertLessEqual(len(options['hotwords']), 600)
        self.assertEqual(whisper_language_options({'language': 'en', 'medicalGerman': True}), {'language': 'en'})
        self.assertEqual(whisper_language_options({'language': 'de', 'medicalTerms': ['Befund']}), {'language': 'de'})

    def test_general_practice_profile_replaces_the_general_hint_and_leaves_room(self):
        options = whisper_language_options({'language': 'de-medical', 'medicalProfile': 'allgemeinmedizin', 'medicalTerms': ['A' * 60] * 20})
        self.assertEqual(options['initial_prompt'], PROFILES['allgemeinmedizin'])
        self.assertIn('Ramipril 5 mg 1-0-0', options['initial_prompt'])
        self.assertLessEqual(len(options['initial_prompt']), 400)
        self.assertLessEqual(len(options['hotwords']), 300)
        for profile in ('', 'unbekannt', None):
            self.assertEqual(whisper_language_options({'language': 'de-medical', 'medicalProfile': profile})['initial_prompt'],
                             'Medizinisches Diktat in deutscher Sprache.')
        self.assertEqual(whisper_language_options({'language': 'de', 'medicalProfile': 'allgemeinmedizin'}), {'language': 'de'})


if __name__ == '__main__':
    unittest.main()
