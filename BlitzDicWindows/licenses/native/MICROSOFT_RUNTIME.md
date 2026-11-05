# Microsoft-Laufzeitdateien: Lizenzweg für BlitzDic

Geprüft am 5. November 2026 anhand der unten verlinkten Microsoft-Bedingungen.
Dies dokumentiert die Bedingungen und die im Benutzerauftrag ausgeführte
Community-Installation. Die Prüfung der Weitergabe im BlitzDic-Installer ist
damit noch nicht vollständig abgeschlossen.

## Kostenlose Community-Lizenz

BlitzDic wird gemäß der LICENSE im Repository unter MIT veröffentlicht.
MIT ist eine [OSI-anerkannte Lizenz](https://opensource.org/license/mit).
Abschnitt 2 der Visual-Studio-Community-2026-Bedingungen erlaubt Einzelpersonen
die Entwicklung eigener kostenloser oder kostenpflichtiger Anwendungen.
Organisationen dürfen unabhängig von ihrer Größe Anwendungen entwickeln und
testen, die unter einer OSI-anerkannten Open-Source-Lizenz veröffentlicht werden.
Damit ist Community für die Entwicklung des unter MIT veröffentlichten BlitzDic
ein geeigneter kostenloser Lizenzweg. Eine spätere geschlossene Variante oder
andere Unternehmensprojekte müssen gesondert bewertet werden.

Abschnitt 5 der Community-Bedingungen erlaubt die Weitergabe des auf der
Distributable List aufgeführten Codes mit eigenen Anwendungen. Die Liste
schließt freigegebene C++-Laufzeitdateien ein. Eine kostenpflichtige Professional-
oder Enterprise-Lizenz ist dafür bei erfüllten Community-Bedingungen nicht nötig.

## So wird die Community-Ausgabe erworben

Der offizielle Community-Installer installiert die kostenlose Ausgabe; eine
kostenpflichtige Bestellung oder ein separat gekaufter Produktschlüssel ist
dafür nicht erforderlich. Bei der Installation werden die geltenden Bedingungen
angenommen. Für BlitzDic eignet sich die C++-Desktopentwicklung als Workload.
Microsoft zufolge verlangt Community grundsätzlich keine Anmeldung. Falls die
installierte Ausgabe später dennoch dazu auffordert, ist die Anmeldung durch
den Benutzer vorzunehmen; Zugangsdaten gehören nicht in das Repository.

Die Weitergabe bleibt zusätzlich an die unten genannten Bedingungen gebunden.
Die Installation der Entwicklungsumgebung allein ersetzt diese Prüfung nicht.

Quelle: [Microsoft: Lizenzierung und Anmeldung in Visual Studio](https://learn.microsoft.com/en-us/visualstudio/ide/how-to-unlock-visual-studio).

## Ausgeführte Installation

Am 5. November 2026 wurde auf ausdrücklichen Benutzerauftrag Visual Studio
Community 2026 Stable 18.11.3 (18.11.12328.437) auf dem Entwicklungs-PC installiert.
Die Lizenzannahme erfolgte im Rahmen dieser automatisierten Installation.
Der offizielle Bootstrapper hatte eine gültige Microsoft-Authenticode-Signatur
und SHA-256 `610E78F66EFC960B3CEE586C1014F18865D6C51C96B9BE358A06FE63E32EED97`.
`vswhere` meldete anschließend `isComplete: true`, `isLaunchable: true` und
`isPrerelease: false` für `Microsoft.VisualStudio.Product.Community`.

Installiert wurde der Basisumfang des Workloads
`Microsoft.VisualStudio.Workload.NativeDesktop` mit deutscher Oberfläche;
empfohlene und optionale Zusatzkomponenten wurden nicht pauschal ausgewählt.
Die Installation wurde mit `--norestart` ausgeführt. Die lokalen Nachweise und
die drei offiziellen Lizenzdokumente samt Prüfsummen liegen im ignorierten
Projektordner `.runtime/visual-studio-community`.

## Vor einer öffentlichen Installer-Weitergabe

1. Der tatsächliche Herausgeber muss eine gültig lizenzierte Community-Ausgabe
   erwerben und ihre Bedingungen annehmen. Diese Recherche, ein öffentlicher
   Download und vorhandene DLLs ersetzen das nicht. Für den hier beauftragenden
   Entwickler wurde die oben dokumentierte Community-Installation ausgeführt.
   Ein anderer Herausgeber muss seine eigene Berechtigung sicherstellen.
2. Für jede ausgelieferte Microsoft-DLL muss die freigegebene Herkunft und die
   Abdeckung durch die maßgebliche Lizenz dokumentiert sein. Die bisherigen
   Herkunfts- und Hashprüfungen stehen in der [nativen Bestandsaufnahme](README.md).
   Sie allein belegen keine Weitergabeberechtigung des Herausgebers.
3. Die freigegebenen Dateien müssen unverändert bleiben; Debug-, Preview- und
   andere nicht freigegebene Komponenten dürfen nicht ausgeliefert werden.
4. Die Anwendung muss wesentliche eigene Funktionalität ergänzen. Außerdem
   verlangt Abschnitt 5 schützende Vereinbarungen mit Endnutzern und
   Weiterverteilern sowie eine Freistellung Microsofts im dort beschriebenen
   Umfang. Eine bloße MIT-Lizenz für den eigenen Code erledigt diese separaten
   Pflichten nicht. Die Umsetzung im Installer ist noch zu prüfen.

BlitzDic-Nutzer benötigen dafür keine eigene Visual-Studio-Installation. Die
Weitergabeberechtigung betrifft den Herausgeber des Installers.

## Build Tools und Redistributable sind getrennt zu betrachten

Die Build-Tools-Bedingungen erlauben auch ohne Visual-Studio-Produktlizenz das
Bauen bestimmter benötigter C++-Open-Source-Abhängigkeiten von Dritten, einschließlich
eng begrenzter notwendiger Anpassungen. Daraus wird hier kein eigenständiges
Recht zur Weitergabe sämtlicher Microsoft-Laufzeitdateien abgeleitet.
Ebenso ist die Endnutzerlizenz des heruntergeladenen Redistributable-Pakets kein
Ersatz für die von Microsoft geforderte Herausgeberberechtigung.

## Offizielle Quellen

- [Visual Studio Community: kostenlose Ausgabe und Nutzungsszenarien](https://visualstudio.microsoft.com/vs/community/)
- [Community 2026: Lizenzseite mit Originaldokument](https://visualstudio.microsoft.com/license-terms/vs2026-ga-community/), insbesondere Abschnitte 2 und 5
- [Community 2026: Originalbedingungen als DOCX](https://visualstudio.microsoft.com/wp-content/uploads/2025/10/Visual_Studio_2026-License-Community_ENU.docx)
- [Visual Studio 2026: Distributable List, insbesondere Visual C++ Runtime Files](https://learn.microsoft.com/en-us/visualstudio/releases/2026/redistribution)
- [Microsoft: Redistributing Visual C++ Files](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files)
- [Diagnostic and Build Tools 2026: Lizenzbedingungen](https://visualstudio.microsoft.com/license-terms/vs2026-ga-diagnostic-buildtools/)
- [Visual C++ V14 Redistributable and Runtime: Lizenzbedingungen](https://visualstudio.microsoft.com/license-terms/vs2026-ga-visualcpp-v14-redist-runtime/)
