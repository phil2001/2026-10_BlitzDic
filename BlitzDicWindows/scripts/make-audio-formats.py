"""Create synthetic AAC/M4A and Opus/WebM fixtures using the bundled codec stack."""
from pathlib import Path
import av

root = Path(__file__).resolve().parents[1]
output = root / '.runtime/audio-format-fixtures'
output.mkdir(parents=True, exist_ok=True)
for extension, container_type, codec in [('m4a', 'ipod', 'aac'), ('webm', 'webm', 'libopus')]:
    target = output / f'speech.{extension}'
    if target.exists():
        print(f'Existing fixture retained: {target}')
        continue
    with av.open(str(root / '.runtime/test-speech.wav')) as source, av.open(str(target), 'w', format=container_type) as destination:
        stream = destination.add_stream(codec, rate=48000)
        stream.layout = 'mono'
        format_name = av.codec.Codec(codec, 'w').audio_formats[0].name
        resampler = av.AudioResampler(format=format_name, layout='mono', rate=48000)
        for frame in source.decode(audio=0):
            for converted in resampler.resample(frame):
                for packet in stream.encode(converted): destination.mux(packet)
        for converted in resampler.resample(None):
            for packet in stream.encode(converted): destination.mux(packet)
        for packet in stream.encode(None): destination.mux(packet)
    print(f'Generated {target}')
