"""Fixed Whisper language choices; local context hints, not a medical ASR model."""


def prepare_language(request):
    if request.get('language') == 'de-medical':
        return {**request, 'language': 'de', 'medicalGerman': True}
    return request


def whisper_language_options(request):
    request = prepare_language(request)
    language = request.get('language') or None
    options = {'language': language}
    if language == 'de' and request.get('medicalGerman') is True:
        options['initial_prompt'] = 'Medizinisches Diktat in deutscher Sprache.'
        terms = request.get('medicalTerms')
        if isinstance(terms, list):
            hints = [' '.join(term.split())[:60] for term in terms[:20] if isinstance(term, str) and term.strip()]
            if hints:
                options['hotwords'] = ', '.join(hints)[:600]
    return options
