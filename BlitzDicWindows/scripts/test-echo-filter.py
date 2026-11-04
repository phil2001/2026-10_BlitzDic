"""Behavioral cases ported from the original MIT EchoFilterTests.swift."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'speech'))
from echo_filter import remove_echo


def words(text, start):
    return [dict(text=word, start=start + i * .4, end=start + i * .4 + .3)
            for i, word in enumerate(text.split())]


class EchoFilter(unittest.TestCase):
    def test_speaker_echo_is_removed_between_own_sentences_without_mutation(self):
        system = words('Das hier ist mein Live-Kanal und nicht mein Hauptkanal.', 10)
        own = words('Das ist jetzt ein Video.', 4) + words('Jetzt sage ich wieder was.', 16)
        mic = own[:5] + words('Das hier ist mein Live-Kanal und nicht mein Hauptkanal.', 10.3) + own[5:]
        original = [word.copy() for word in mic]
        self.assertEqual(remove_echo(mic, system), own)
        self.assertEqual(mic, original)

    def test_track_offset_and_single_letters(self):
        text = 'Wir sehen uns am Donnerstag im Büro und besprechen den Plan.'
        self.assertEqual(remove_echo(words(text, 6.4), words(text, 5)), [])
        self.assertEqual(remove_echo(words("I have a rather, I a a", 40.2),
                                    words("I have a rather, I don't know, a bit embarrassing problem.", 40)), [])

    def test_trailing_single_number_in_an_echo_run_is_pruned(self):
        system = words('The meeting starts tomorrow at 9.', 0)
        mic = words('The meeting starts tomorrow at 9.', .3)
        mic[-1]['start'] += .1; mic[-1]['end'] += .1
        self.assertEqual(remove_echo(mic, system), [])

    def test_garbled_words_and_short_echo_scraps(self):
        system = words('Ihr habt vielleicht meinen Hauptkanal schon abonniert vielen Dank.', 30)
        mic = words('Ihr habt vielleicht meinen Hauptkanal schon abonniert vielen Dank.', 30.2)
        mic[4]['text'] = 'Hauptkranich'
        self.assertEqual(remove_echo(mic, system), [])
        system = words('And we have again planned a little squad work which comes to the topic of ownership.', 10)
        mic = words('soul I', 10.4) + words('a little spot work with', 12.1) + words('comes to the topic of ownership.', 14.1)
        self.assertEqual(remove_echo(mic, system), [])

    def test_coincidence_headphone_replies_pauses_and_crosstalk_stay(self):
        cases = [
            ('Ja klar, ich kümmere mich drum heute.', 20.2, 'Ja genau so machen wir das.', 20),
            ('Danke, ich', 10.8, 'Das mache ich dann am besten selbst.', 10),
            ('Ja, genau.', 6, 'Können wir die Zahlen bis Freitag haben?', 0),
            ('Ich bereite für Donnerstag eine kleine Demo mit lokalen Modellen vor.', 11,
             'Dann gehen wir jetzt in die Räume und treffen uns um halb wieder.', 10),
            ('Ja, das schaffe ich bis Donnerstag.', 7, 'Können wir die Zahlen bis Freitag haben?', 3),
        ]
        for text, at, remote, start in cases:
            with self.subTest(text=text):
                mic = words(text, at)
                self.assertEqual(remove_echo(mic, words(remote, start)), mic)
                self.assertEqual(remove_echo(mic, []), mic)
        mic = words('Mach ich.', 12) + words('Ja, übernehme ich.', 14)
        self.assertEqual(remove_echo(mic, words('Wer kann sich bis morgen um die Zahlen für den Bericht kümmern?', 10)), mic)


if __name__ == '__main__':
    unittest.main()
