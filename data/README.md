# Albums database

Edit **`albums.json`** to add unreleased albums and LPs & MVs. There is only one artist; no artist switching.

## Schema

### albums (unreleased)

Each album has **multiple tracks**. List as many as you need in the `tracks` array.

```json
{
  "id": "donda2",
  "title": "Donda 2",
  "coverPath": "albumcvers/donda2.jpg",
  "tracks": [
    { "title": "Track 1", "audioPath": "audio/ye/donda2/01.mp3" },
    { "title": "Track 2", "audioPath": "audio/ye/donda2/02.mp3" },
    { "title": "Track 3", "audioPath": "audio/ye/donda2/03.mp3" }
  ]
}
```

- **id** – unique string
- **title** – album name
- **coverPath** – path to cover image (e.g. `albumcvers/cover.jpg`)
- **tracks** – array of `{ "title": "Track name", "audioPath": "path/to/file.mp3" }`. Playback goes in order; when one ends, the next plays.

### lpsMvs (LPs & Music Videos)

- **Music video:** `{ "id", "title", "coverPath", "videoUrl": "https://..." }` – play opens the link.
- **LP (audio):** same as albums – `tracks` array with multiple `{ "title", "audioPath" }`.

## Adding audio files

1. Put files in the project (e.g. `audio/ye/donda2/01.mp3`, `02.mp3`, …).
2. In `albums.json`, add each track to the album’s `tracks` array with the correct `audioPath`.

## Serving the site

Use HTTP (not `file://`), e.g. **Live Server** or `python -m http.server 8000`, then open `http://localhost:8000/mainpage.html`.
