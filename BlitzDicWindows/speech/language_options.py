"""Fixed Whisper language choices; local context hints, not a medical ASR model."""

GENERAL_PROMPT = 'Medizinisches Diktat in deutscher Sprache.'
# Whisper reads the prompt as text said just before: terms it often mishears and the written form
# of doses ("5 mg 1-0-0", "RR 135/85"). Prompt and hotwords share half of the 448-token window, so
# a profile stays near 150 tokens and leaves the own terms 300 characters.
PROFILES = {
    'allgemeinmedizin': (
        'Allgemeinmedizin. Anamnese: Dysurie, Pollakisurie, Dyspnoe. Status: Cor rhythmisch, Pulmo vesikulär, '
        'Nierenlager frei. Diagnosen: Hypertonie, Vorhofflimmern, Hypercholesterinämie, Hypothyreose, Lumbalgie. '
        'Therapie: Ramipril 5 mg 1-0-0, Bisoprolol, Metformin, Atorvastatin, Pantoprazol, Euthyrox, Xarelto, '
        'Eliquis, Candesartan, Novalgin, Mexalen, Parkemed, Seractil. RR 135/85.'
    ),
}


def prepare_language(request):
    if request.get('language') == 'de-medical':
        return {**request, 'language': 'de', 'medicalGerman': True}
    return request


def whisper_language_options(request):
    request = prepare_language(request)
    language = request.get('language') or None
    options = {'language': language}
    if language == 'de' and request.get('medicalGerman') is True:
        profile = PROFILES.get(request.get('medicalProfile'))
        options['initial_prompt'] = profile or GENERAL_PROMPT
        terms = request.get('medicalTerms')
        if isinstance(terms, list):
            hints = [' '.join(term.split())[:60] for term in terms[:20] if isinstance(term, str) and term.strip()]
            if hints:
                options['hotwords'] = ', '.join(hints)[:300 if profile else 600]
    return options
