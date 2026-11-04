"""Word boundaries from Parakeet's actual token times, never uniform text timing.

onnx-asr replaces SentencePiece word separators with spaces. Token ends are not
provided: word ends use the final token + 80 ms, capped by the next word onset.
This avoids assigning intervening silence to the preceding word.
"""
import math


def token_words(tokens, timestamps, duration, offset=0):
    if tokens is None or timestamps is None or len(tokens) != len(timestamps):
        raise ValueError('Das Sprachmodell liefert keine vollständigen Wortzeitpunkte.')
    if not math.isfinite(duration) or duration < 0 or not math.isfinite(offset) or offset < 0:
        raise ValueError('Ungültige Audiodauer.')
    words = []
    text, start, last = '', 0.0, 0.0
    previous = -1.0

    def finish(end):
        nonlocal text
        if text:
            words.append({'text': text, 'start': offset + start,
                          'end': offset + min(duration, max(start, min(end, last + 0.08)))})
            text = ''

    for token, at in zip(tokens, timestamps):
        if not isinstance(token, str) or not isinstance(at, (int, float)) or not math.isfinite(at) or at < previous or at < 0 or at > duration + 0.5:
            raise ValueError('Ungültige Tokenzeitpunkte vom Sprachmodell.')
        previous = at
        at = min(duration, at)
        for char in token.replace('\u2581', ' '):
            if char.isspace():
                finish(at)
            else:
                if not text:
                    start = at
                    last = at
                text += char
                # Punctuation may be emitted only after a long silence. Keep it
                # in the text without extending the spoken word into that pause.
                if char.isalnum():
                    last = at
    finish(last + 0.08)
    return words
