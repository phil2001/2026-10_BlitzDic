# Roadmap für Windows 11

- Physische Mikrofontests, weitere Office-/Browser-Versionen und ein frisches Windows 11 prüfen.
- Echte LAN- und Cloud-Anbieter zusätzlich zu lokalen Servern und Protokoll-Fixtures prüfen.
- Verbleibende Originalfunktionen portieren: Website-Regeln,
  Halten-zum-Diktieren, optionales Stummschalten und Live-Meeting-Notizen.
- Weitere Meeting-Funktionen des Originals prüfen: Sprecher umbenennen und Echo-Unterdrückung.
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
Der Installationsablauf 0.1.0 → 0.3.6 wurde auf dem Entwicklungs-PC geprüft.
Details, Grenzen und Nachweise: [WINDOWS_PORT.md](WINDOWS_PORT.md).
