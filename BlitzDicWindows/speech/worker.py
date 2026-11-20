"""Local ASR worker. One JSON request on stdin, one JSON result on stdout.

Downloads are explicit. Transcription always uses already installed local files.
The desktop process owns cancellation by terminating this worker.

`--target-service` stays running and answers capture/insert requests line by
line (target_service.py), so no worker starts before a recording or insertion.

`--preload <engine> <directory>` loads that model before stdin is read, so a
worker started ahead of time answers the next request without loading delay.
The request still names its model; a different one is loaded as usual.
"""
import json
import os
import sys
import base64
import io
from pathlib import Path
from functools import lru_cache


@lru_cache(maxsize=2)
def load_whisper(directory):
    from faster_whisper import WhisperModel
    from cpu_threads import inference_threads
    # faster-whisper would use 4 threads; see cpu_threads.py.
    return WhisperModel(directory, device='cpu', compute_type='int8', local_files_only=True,
                        cpu_threads=inference_threads())


@lru_cache(maxsize=2)
def load_parakeet(directory):
    import onnx_asr
    from cpu_threads import override
    sess_options = None
    # ONNX Runtime already uses all physical cores; only a measurement override changes it.
    if override():
        import onnxruntime
        sess_options = onnxruntime.SessionOptions()
        sess_options.intra_op_num_threads = override()
    return onnx_asr.load_model('nemo-parakeet-tdt-0.6b-v3', directory, quantization='int8',
                              sess_options=sess_options, providers=['CPUExecutionProvider'])

PRESETS = {
    "whisper": {"repo": "Systran/faster-whisper-small", "engine": "whisper",
                "revision": "536b0662742c02347bc0e980a01041f333bce120"},
    "parakeet-ultra": {"repo": "Masterx/parakeet-tdt-0.6b-ultra-onnx", "engine": "parakeet",
                       "revision": "99b09f030a5a6efeaa13cf2cf54592100ce2c3f1"},
}


def preload(engine, directory):
    """Warm the cache key that run() uses for the same request directory."""
    os.environ["HF_HUB_OFFLINE"] = "1"
    root = str(Path(directory).resolve())
    if engine == 'whisper':
        load_whisper(root)
    elif engine == 'parakeet':
        load_parakeet(root)
    else:
        raise ValueError("Unbekannte Spracherkennungs-Engine.")


def target_action(request):
    """Capture the focused field or insert into it; single-use or via --target-service."""
    from windows_target import capture, insert, foreground_app
    if request['action'] == 'capture-target':
        executable = foreground_app()
        target = capture(website=request.get('website') is True, scope=request.get('scope'))
        same_app = foreground_app() == executable
        return {'target': target, 'reason': capture.reason if not target else '',
                'executable': executable if same_app else '',
                'websiteHost': capture.website_host if same_app else None}
    return insert(request.get('target'), request.get('text'))


def run(request):
    from language_options import prepare_language
    request = prepare_language(request)
    if request['action'] == 'transcribe-meeting':
        from dual_meeting import run as transcribe_meeting
        return transcribe_meeting(request, run)
    if request['action'] in ('wait-shortcut-release', 'validate-hold-shortcuts'):
        from keyboard_hold import run as hold_keys
        return hold_keys(request)
    if request['action'] == 'transcribe-speakers':
        from meeting_asr import run as transcribe_speakers
        return transcribe_speakers(request, run)
    if request['action'] == 'diarize':
        from diarization import run as diarize
        return diarize(request)
    if request['action'] in ('capture-target', 'insert-text'):
        return target_action(request)
    root = Path(request["modelDirectory"]).resolve()
    preset = PRESETS.get(request.get("preset"))
    engine = preset["engine"] if preset else request.get("engine")
    if engine not in ("whisper", "parakeet"):
        raise ValueError("Unbekannte Spracherkennungs-Engine.")
    if request["action"] == "download":
        from huggingface_hub import snapshot_download
        repo = preset["repo"] if preset else request.get("repository")
        if not repo:
            raise ValueError("Modell-Repository fehlt.")
        patterns = (["config.json", "model.bin", "tokenizer.json", "vocabulary.*", "preprocessor_config.json"]
                    if engine == "whisper" else
                    ["config.json", "vocab.txt", "encoder-model.int8.onnx", "decoder_joint-model.int8.onnx"])
        snapshot_download(repo, local_dir=str(root), allow_patterns=patterns,
                          revision=preset["revision"] if preset else request.get("revision"))
        return {"installed": True, "directory": str(root), "repository": repo}
    if request["action"] != "transcribe":
        raise ValueError("Unbekannte Aktion.")
    if not root.is_dir():
        raise ValueError("Bitte zuerst das Sprachmodell herunterladen.")
    audio = (io.BytesIO(base64.b64decode(request['audioBase64'], validate=True))
             if request.get('audioBase64') else str(Path(request['audioPath']).resolve(strict=True)))
    # Never download models or transmit audio during recognition.
    os.environ["HF_HUB_OFFLINE"] = "1"
    if engine == "whisper":
        model = load_whisper(str(root))
        timed = request.get('wordTimestamps') is True
        from language_options import whisper_language_options
        language_options = whisper_language_options(request)
        if language_options['language'] not in (None, 'en') and not model.model.is_multilingual:
            raise ValueError('Dieses Whisper-Modell unterstützt nur Englisch. Englisch wählen oder ein mehrsprachiges Modell verwenden.')
        segments, info = model.transcribe(audio, **language_options,
                                          vad_filter=True, condition_on_previous_text=False,
                                          word_timestamps=timed)
        items, words = [], []
        for segment in segments:
            items.append({'start': segment.start, 'end': segment.end, 'text': segment.text.strip()})
            if timed:
                words.extend({'text': word.word.strip(), 'start': float(word.start), 'end': float(word.end)}
                             for word in (segment.words or []) if word.word.strip())
        return {"text": " ".join(s["text"] for s in items), "segments": items, "language": info.language,
                **({'words': words} if timed else {})}
    import numpy as np
    from audio_decode import decode_audio
    waveform, rate = decode_audio(audio)
    model = load_parakeet(str(root))
    # Bound encoder memory. Prefer a quiet boundary near 20 seconds.
    items, words = [], []
    timed = request.get('wordTimestamps') is True
    if timed:
        model = model.with_timestamps()
    start = 0
    while start < len(waveform):
        end = min(start + 20 * rate, len(waveform))
        if end < len(waveform):
            candidates = range(start + 17 * rate, end, max(1, rate // 10))
            end = min(candidates, key=lambda i: float(np.mean(waveform[i:i + rate // 10] ** 2)))
        chunk = waveform[start:end]
        if len(chunk) and float(np.max(np.abs(chunk))) > 0.001:
            result = model.recognize(chunk, sample_rate=rate)
            if timed:
                from word_timing import token_words
                text = result.text
                words.extend(token_words(result.tokens, result.timestamps, len(chunk) / rate, start / rate))
            else:
                text = result
            items.append({"start": start / rate, "end": end / rate, "text": text.strip()})
        start = end
    return {"text": " ".join(s["text"] for s in items), "segments": items, "language": None,
            **({'words': words} if timed else {})}


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ['--escape-control']:
            from escape_control import serve
            serve()
            sys.exit(0)
        if sys.argv[1:] == ['--output-mute']:
            from output_mute import serve
            serve()
            sys.exit(0)
        if sys.argv[1:] == ['--target-service']:
            import windows_target, uia_target  # Load before the first request.
            from target_service import serve
            serve(target_action)
            sys.exit(0)
        if sys.argv[1:] == ['--output-mute-status']:
            from output_mute import Endpoint
            endpoint = Endpoint()
            try:
                print(json.dumps({'muted': endpoint.muted()}))
            finally:
                endpoint.close()
            sys.exit(0)
        # Libraries may log to stdout; reserve stdout for the IPC response.
        from contextlib import redirect_stdout
        if len(sys.argv) == 4 and sys.argv[1] == '--preload':
            try:
                with redirect_stdout(sys.stderr):
                    preload(sys.argv[2], sys.argv[3])
            except Exception as error:
                # Not fatal: the request below loads again and reports its own error.
                print(f'Vorladen fehlgeschlagen: {error}', file=sys.stderr)
        # PyInstaller can ignore PYTHONIOENCODING and inherit a Windows code
        # page. Electron always sends UTF-8 JSON, including paths and dictation.
        request = json.loads(sys.stdin.buffer.read().decode('utf-8'))
        with redirect_stdout(sys.stderr):
            result = run(request)
        print(json.dumps(result, ensure_ascii=True))
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=True))
        sys.exit(1)
