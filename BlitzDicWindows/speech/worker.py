"""Local ASR worker. One JSON request on stdin, one JSON result on stdout.

Downloads are explicit. Transcription always uses already installed local files.
The desktop process owns cancellation by terminating this worker.
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
    return WhisperModel(directory, device='cpu', compute_type='int8', local_files_only=True)


@lru_cache(maxsize=2)
def load_parakeet(directory):
    import onnx_asr
    return onnx_asr.load_model('nemo-parakeet-tdt-0.6b-v3', directory,
                              quantization='int8', providers=['CPUExecutionProvider'])

PRESETS = {
    "whisper": {"repo": "Systran/faster-whisper-small", "engine": "whisper",
                "revision": "536b0662742c02347bc0e980a01041f333bce120"},
    "parakeet-ultra": {"repo": "Masterx/parakeet-tdt-0.6b-ultra-onnx", "engine": "parakeet",
                       "revision": "99b09f030a5a6efeaa13cf2cf54592100ce2c3f1"},
}


def run(request):
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
        from windows_target import capture, insert, foreground_app
        if request['action'] == 'capture-target':
            executable = foreground_app()
            target = capture(website=request.get('website') is True, scope=request.get('scope'))
            same_app = foreground_app() == executable
            return {'target': target, 'reason': capture.reason if not target else '',
                    'executable': executable if same_app else '',
                    'websiteHost': capture.website_host if same_app else None}
        return insert(request.get('target'), request.get('text'))
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
        segments, info = model.transcribe(audio, language=request.get("language") or None,
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
        if sys.argv[1:] == ['--output-mute-status']:
            from output_mute import Endpoint
            endpoint = Endpoint()
            try:
                print(json.dumps({'muted': endpoint.muted()}))
            finally:
                endpoint.close()
            sys.exit(0)
        # PyInstaller can ignore PYTHONIOENCODING and inherit a Windows code
        # page. Electron always sends UTF-8 JSON, including paths and dictation.
        request = json.loads(sys.stdin.buffer.read().decode('utf-8'))
        # Libraries may log to stdout; reserve stdout for the IPC response.
        from contextlib import redirect_stdout
        with redirect_stdout(sys.stderr):
            result = run(request)
        print(json.dumps(result, ensure_ascii=True))
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=True))
        sys.exit(1)
