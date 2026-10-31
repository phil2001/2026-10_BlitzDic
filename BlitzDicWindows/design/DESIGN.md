# BlitzDic interface specification

Reference: dictation-concept.png, generated with built-in Image Gen. Prompt:
German Windows 11 dictation app with sidebar Diktat/Modelle/Verbindungen/Verlauf/
Einstellungen, recording controls, mode and microphone selects, last transcript;
white background, cool gray sidebar, indigo accents, Segoe UI, no marketing.

Tokens: #ffffff canvas; #f1f3f6 sidebar; #111827 text; #606b7e secondary;
#424cf2 primary; 6–8 px control corners; 15 px body, 34 px heading.
Compact vanilla ES modules preserve the existing JavaScript architecture.

Functional extensions: model requirements, editable provider form, encrypted
history, user instructions. Initial controls are connected to Electron IPC.
Visual comparison and interactive verification remain outstanding. Navigation
icons from the concept have not yet been implemented. Recordings currently
remain in the app data directory; retention and cleanup need completion.
