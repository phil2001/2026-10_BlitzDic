"""Persistent field capture/insertion: one JSON request per line, answered in order.

Saves a worker start before every recording and before every insertion. Lines
are `{"id": n, "request": {...}}`; answers are `{"id": n, "result": {...}}` or
`{"id": n, "error": "..."}`. The parent ends the process to abandon a request.
"""
import json
import sys
from contextlib import redirect_stdout

ACTIONS = ('capture-target', 'insert-text')


def serve(handle, incoming=None, outgoing=None):
    # Read bytes: a frozen worker may ignore PYTHONIOENCODING; dictated text is UTF-8.
    incoming = incoming if incoming is not None else sys.stdin.buffer
    outgoing = outgoing if outgoing is not None else sys.stdout

    def emit(value):
        outgoing.write(json.dumps(value, ensure_ascii=True) + '\n')
        outgoing.flush()

    emit({'event': 'ready'})
    for line in incoming:
        message = None
        try:
            message = json.loads(line.decode('utf-8') if isinstance(line, bytes) else line)
            if (not isinstance(message, dict) or type(message.get('id')) is not int or
                    not isinstance(message.get('request'), dict) or message['request'].get('action') not in ACTIONS):
                raise ValueError('Ungültige Anfrage an die Eingabehilfe.')
            # Libraries may print; stdout carries only the answers.
            with redirect_stdout(sys.stderr):
                result = handle(message['request'])
            emit({'id': message['id'], 'result': result})
        except Exception as error:
            emit({'id': message.get('id') if isinstance(message, dict) else None, 'error': str(error)})
