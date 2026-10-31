# Sicherheit

BlitzDic ist eine Windows-11-Anwendung unter MIT-Lizenz ohne Gewährleistung.
Sicherheitskorrekturen beziehen sich auf den aktuellen main-Zweig.

Melde Schwachstellen über private GitHub-Sicherheitsmeldungen im Zielrepository,
sofern verfügbar. Andernfalls zunächst nur eine Kontaktanfrage ohne technische
Details veröffentlichen. Keine Schlüssel oder vertraulichen Aufnahmen beifügen.

Die Electron-Oberfläche verwendet Kontextisolation und Renderer-Sandboxing.
Der Hauptprozess startet die lokale Sprachlaufzeit und verwaltet Windows-DPAPI-
Speicherung. Externe LLM-Anbieter erhalten nur bei entsprechender Konfiguration
Transkripte zur Bearbeitung. Weitere Angaben: [PRIVACY.md](PRIVACY.md).

Die Entwicklungsversion ist noch nicht abschließend sicherheitsgeprüft.
