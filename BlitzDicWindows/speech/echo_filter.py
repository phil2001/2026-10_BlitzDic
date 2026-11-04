"""Transcript echo filter ported from BlitztextShared/Meeting/EchoFilter.swift (MIT).

Removes microphone words also heard in the system track. This is a transcript
heuristic, not acoustic echo cancellation. Original system words stay intact.
"""
from bisect import bisect_left


def key(text):
    value = ''.join(char for char in text.lower() if char.isalnum())
    return value if len(value) > 1 else ''


def has_time(times, at, tolerance):
    index = bisect_left(times, at - tolerance)
    return index < len(times) and times[index] <= at + tolerance


def remove_echo(microphone, system):
    if not microphone or not system:
        return list(microphone)
    times = {}
    for word in system:
        value = key(word['text'])
        if value:
            times.setdefault(value, []).append(word['start'])
    for values in times.values():
        values.sort()
    keys = [key(word['text']) for word in microphone]
    best_offset, best_count = 0, 0
    for step in range(-20, 21):
        offset = step / 10
        count = sum(has_time(times.get(value, []), word['start'] - offset, 0.3)
                    for word, value in zip(microphone, keys))
        if count > best_count:
            best_offset, best_count = offset, count
    offset = best_offset if best_count >= 3 else 0
    matches = [bool(value) and has_time(times.get(value, []), word['start'] - offset, 0.6)
               for word, value in zip(microphone, keys)]
    echo = [False] * len(microphone)
    significant = [i for i, value in enumerate(keys) if value]
    for position, index in enumerate(significant):
        if matches[index]:
            echo[index] = (position > 0 and matches[significant[position - 1]]) or (
                position + 1 < len(significant) and matches[significant[position + 1]])
    marked = echo[:]
    for index in range(len(microphone)):
        if not marked[index]:
            echo[index] = any(marked[max(0, index - 2):index]) and any(marked[index + 1:index + 3])
    system_starts = sorted(word['start'] for word in system)
    echo_starts = sorted(word['start'] for i, word in enumerate(microphone) if echo[i])
    segments = []
    for index, word in enumerate(microphone):
        if echo[index]:
            continue
        if segments and word['start'] - microphone[segments[-1][-1]]['end'] <= 1:
            segments[-1].append(index)
        else:
            segments.append([index])
    for segment in segments:
        first, last = microphone[segment[0]], microphone[segment[-1]]
        start, end = first['start'] - offset, last['end'] - offset
        if not has_time(system_starts, (start + end) / 2, (end - start) / 2 + 0.5):
            continue
        significant = [i for i in segment if keys[i]]
        matched = sum(matches[i] for i in significant)
        middle = (first['start'] + last['end']) / 2
        span = (last['end'] - first['start']) / 2
        audible = matched >= 2 or has_time(echo_starts, middle, span + 20)
        mostly_echo = bool(significant) and matched / len(significant) >= 0.4
        if audible and (len(segment) <= 4 or mostly_echo):
            for index in segment:
                echo[index] = True
    return [word for index, word in enumerate(microphone) if not echo[index]]
