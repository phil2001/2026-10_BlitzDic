# Roadmap für Windows 11

- Physische Mikrofontests, weitere Office-/Browser-Versionen und ein frisches Windows 11 prüfen.
- Echte LAN- und Cloud-Anbieter zusätzlich zu lokalen Servern und Protokoll-Fixtures prüfen.
- Website-Regeln: native Frame-Zuordnung und geschütztes Einfügen mit beiden
  Browsern und dem abschließenden Paket prüfen.
- Verbleibende Originalfunktionen portieren: optionales Stummschalten und Live-Meeting-Notizen.
- Weitere Meeting-Funktionen des Originals prüfen: Echo-Unterdrückung.
- Oberfläche visuell abschließen und Zugänglichkeit prüfen.
- Vollständige Drittanbieter-Lizenzen bündeln und Installer auf sauberem Windows testen.
- Aktuellen Windows-Build im Zielrepository veröffentlichen.

Bereits vorhanden und mit begrenzter Testabdeckung belegt: beide gebündelten
Sprachmodelle, lokale CPU-Erkennung, konfigurierbare globale Tastenkürzel,
LLM-Anbieter einschließlich lokaler und Netzwerkserver, Schreibmodi, Wörterbuch,
verschlüsselter Verlauf, Windows-Infobereich und Programmregeln. Meetings bieten
Audioaufnahme, experimentelle Sprecherzuordnung, verschlüsseltes Speichern und
Zusammenfassungen. Version 0.3.7 ergänzt die lokale Anpassung von Abständen und
Satzanfängen beim geschützten Einfügen in native Felder, Chromium und Word.
Version 0.3.8 ergänzt die abschaltbare Aufnahmeanzeige mit Pegel, Laufzeit und
Stopp-/Ausblendsteuerung. Native Ziehregion und Erhalt des Vordergrundfensters
sind geprüft; ein echter Maus-Drag und mehrere Monitore bleiben zu prüfen.
Version 0.3.9 ergänzt Sprechernamen je Aufnahmeabschnitt, Änderungen im bestehenden
Archiveintrag und die Kennzeichnung älterer Zusammenfassungen. Original-IDs bleiben
erhalten; die Zuordnung erkennt keine realen Identitäten.
Version 0.3.10-dev.0 ergänzt Halten-zum-Diktieren. Native Windows-Tastenereignisse,
Aufnahmeanzeige und Einfügen im externen Chromium-Editor sind für Halten und
Start/Stopp mit beiden gebündelten Modellen geprüft. Die Audioquelle war dabei
eine Testdatei; dies ersetzt keinen Test mit einem physischen Mikrofon.
Version 0.3.10-dev.1 ergänzt Escape: Aufnahme beenden und transkribieren,
Verarbeitung abbrechen, außerhalb eines Vorgangs an andere Programme weitergeben.
Native Diktat- und Meeting-Abläufe sowie Abbrüche von ASR, Überarbeitung und
Meeting-Zusammenfassung sind mit der gepackten App geprüft.
Der Installationsablauf 0.1.0 → 0.3.6 wurde auf dem Entwicklungs-PC geprüft.
Version 0.3.10-dev.2 ergänzt Website-Regeln mit Host-Normalisierung, Vorrang vor
Programmregeln und verschlüsselter Speicherung. Regel- und Oberflächentests sind
bestanden. Der abschließende native Browser-/Paketnachweis ist noch offen.
Details, Grenzen und Nachweise: [WINDOWS_PORT.md](WINDOWS_PORT.md).
