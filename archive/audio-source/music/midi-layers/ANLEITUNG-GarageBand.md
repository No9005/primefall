# Notstrom: MIDI-Dateien in GarageBand bekommen

Stand: 18.11.2026. Ich konnte GarageBand nicht selbst ausprobieren, die Schritte sind aus meinem Wissen über die Mac-Version. Wo ich unsicher bin, steht es dabei.

## Was du hast
- `00-notstrom-all-layers.mid`: alle 15 Ebenen in einer Datei (eine Spur je Ebene).
- `01-drone.mid` bis `15-glimmer.mid`: jede Ebene einzeln.
- Alle Dateien: 16 Takte, 72 BPM, 4/4, Tonart D-Moll.

Noten, Rhythmus und Lautstärke (Anschlag) stehen drin, **kein Klang**. Den wählst du in GarageBand.

## Schritt für Schritt (GarageBand auf dem Mac)
1. **Neues Projekt:** Datei ▸ Neu ▸ Leeres Projekt. Beim Spurtyp „Software-Instrument“ wählen. Das Projekt hat dann eine leere Spur.
2. **Tempo und Takt einstellen, bevor du etwas einfügst:** In der Anzeige unten in der Mitte auf die Zahl (voreingestellt 120) klicken und **72** eingeben. Taktart 4/4 lassen. Tonart wenn möglich auf D-Moll (Dm). Das ist wichtig, damit die Noten auf dem Raster liegen.
3. **MIDI-Datei hineinziehen:** `00-notstrom-all-layers.mid` aus dem Finder in den Spurenbereich von GarageBand ziehen (in den leeren Bereich unter den Spuren). GarageBand legt dann für jede Spur der Datei eine eigene Software-Instrument-Spur mit einer MIDI-Region an.
   - Wenn Tempo-Fragen kommen: Tempo der Datei übernehmen oder 72 BPM beibehalten, beides ist richtig.
   - Wenn etwas schiefgeht (alles auf einer Spur, falsche Anzahl): die Einzeldateien nacheinander hineinziehen, je Datei eine Spur.
4. **Leere erste Spur löschen,** falls sie übrig bleibt.
5. **Instrument je Spur wählen:** Spur anklicken, links die **Bibliothek** öffnen (Taste Y), eine Kategorie und ein Instrument auswählen. Vorschläge unten.
6. **Schleife setzen:** Zyklus-Taste (C) aktivieren und den Zyklusbereich über die Takte 1 bis 17 ziehen. Das Projekt endet nach 16 Takten (53,3 s).
7. **Noten ändern:** Doppelklick auf eine Region öffnet den Pianorollen-Editor (Tonhöhe, Länge, Anschlag).

## Instrumentvorschläge
| Spur | Datei | Vorschlag in GarageBand |
|---|---|---|
| Drone | 01 | Synth-Pad (Bibliothek ▸ Synthesizer ▸ Pads) oder ein tiefes Chor-Pad |
| Herzschlag | 02 | Sub-Bass oder 808-artige Kick (Synthesizer ▸ Bass) |
| Bass | 03 | Analog-Bass (Synthesizer ▸ Bass) oder E-Bass |
| Schlagzeug | 04 | Drum Kit Designer oder ein Drum-Kit aus „Schlagzeug“ (nicht „Drummer“) |
| Pad | 05 | Chor, Streicher oder Orgel |
| Stabs | 06 | Synth-Brass oder ein Synth-Stab |
| Melodie | 07 | Lead-Synth oder eine Solostimme |
| Arpeggio | 08 | Pluck oder Arpeggiator-artiger Synth |
| Kriegstrommeln | 09 | Pauken oder Taiko (Orchester-Schlagwerk) |
| Männerchor | 10 | Chor (Choir) |
| Streicher | 11 | Streicher-Ensemble mit Tremolo |
| Spannungslinie | 12 | Scharfer Lead oder Streicher hoch |
| Ticken | 13 | Holzblock, Uhr-ähnlicher Percussion-Sound |
| Braams | 14 | Tiefes Blech, Brass-Ensemble |
| Glimmer | 15 | Celesta, Glockenspiel, Harfe |

## Wo es erfahrungsgemäß hakt (ohne dass ich es testen konnte)
- **Schlagzeug (Datei 04, Kanal 10):** Die Noten sind nach der Standard-Schlagzeug-Belegung geschrieben (Kick C1, Snare D1, Hi-Hat F♯1). Je nach Kit kann ein Klang auf einer anderen Taste liegen. Dann im Pianorollen-Editor die Noten verschieben, oder das Kit wechseln.
- **Instrument stimmt nicht:** Die Dateien schlagen Standard-Instrumente vor (General MIDI), GarageBand übernimmt sie nicht in jedem Fall. Setz sie von Hand.
- **Zwei Taiko-/Drum-Spuren:** Wenn eine Tonhöhe falsch klingt (Pauken auf D2 und A1), kann die Spur im Editor eine Oktave verschoben werden.
- **iPad/iPhone:** Ich weiß nicht sicher, ob und wie GarageBand für iOS MIDI-Dateien importiert. Der Weg über den Mac ist der, den ich beschreiben kann.

## Wenn du Audio zurückgeben willst (damit ich sie für das Spiel ausrichten kann)
1. Jede Ebene **einzeln** ausgeben: alle anderen Spuren stumm schalten (M) und nur diese hören (oder Solo, S).
2. Zyklus auf die Takte 1 bis 17 lassen, damit genau 16 Takte kommen.
3. Teilen ▸ Titel auf Festplatte sichern ▸ Format **WAV** (verlustfrei) und die Datei so benennen wie die MIDI-Datei (`01-drone.wav`).
4. Wenn Hall-Fahnen am Ende wichtig sind, einen Takt zusätzlich laufen lassen (Zyklus bis Takt 18) und es mir sagen; ich blende dann Ende und Anfang ineinander, damit die Schleife nahtlos wird.
5. Gib mir die Dateien (in den Chat oder ins Repo). Ich messe Tempo und Pegel, strecke sie bei Bedarf auf exakt 72,000 BPM und mache Schleifen.

GarageBand kann nach meinem Wissen **nicht alle Spuren auf einmal als einzelne Dateien** exportieren (das kann zum Beispiel Logic Pro). Deshalb der Weg Spur für Spur.
