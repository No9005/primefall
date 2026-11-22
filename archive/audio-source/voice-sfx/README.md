# Voice lines and effects: the raw material (not built)

Everything the sessions of issue #422 made with ElevenLabs that is **not** already a final file in `apps/web/public/assets/audio/`: the history of all takes, the raw and trimmed originals, the rejected takes and the scripts that made them. It is not part of the build. It exists so that nothing is lost: a generation cannot be fetched again and costs credits.

Files that are byte-identical to a final file in the app (22 of them) are not repeated here.

| Path | What |
|---|---|
| `CHARACTERS.md` | **per Hero: who they are, voice and settings, the tags used (counted) and what to avoid, a checklist for new lines**, so that new lines sound like the old ones |
| `PROMPTS.md` | **every voice and sound-effect request in order, with the exact text** (the lines with their audio tags, the effect prompts, the model, the voice id), read back from the record of the sessions, plus what we learned |
| `history.json` | the ElevenLabs history of the speech takes (text, voice, settings, time) for 169 items: which take had which text |
| `hist_audio/` | the audio of those takes, named by `history_item_id` (every take of every line, picked or not) |
| `extra/` | more speech takes downloaded later, same naming, plus their raw and cut files |
| `api/` | the raw API answers per Hero: `kit/`, `max/`, `tilly/` batches, the response headers (`*.hdr`), the batch and id JSON (`kit_batch.json`, `max_ids.json`, `tilly_batch.json`, `redo1.json`) |
| `trim/` | Kit's lines before they were cut to the final length (WAV) |
| `max/` | Max: `raw/` as generated (with the spoken `[barks]`), `final/` and `out/` the cut and levelled versions, `sfx/` his effect takes |
| `tilly/` | Tilly: `raw/` and `out/` and the cut script `seg.py` |
| `map/` | the map and card sounds: `loops/` the loop takes, `final/` the chosen ones before encoding |
| `sfx/` | the effect takes of all Heroes and the map (`enh/` enhanced versions, `kit/`, `max/`, `map/`, `tilly/`), the batch JSON and the response header |
| `*.py` | the scripts: `gen_*.py` generate effects, `export_*.py` cut and encode the final files, `build_*_lines.py` and `build_*review*.py` build the review pages, `build_music_*.py` the early music previews |

The folder descriptions above go by the names and the scripts; the layout is the one the session grew, not a designed one.

What is **not** here because it can be rebuilt: the review pages (HTML), screenshots and the mixes made for them.

The final, cut and normalised files that the game uses are in `apps/web/public/assets/audio/` with their manifests. The README there lists the rules (lengths, loudness, cues).
The music has its own archive next to this folder: `archive/audio-source/music/`.
