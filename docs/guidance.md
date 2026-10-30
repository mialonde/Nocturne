# Recorded Turkish guidance

Future production is tracked in [`../TODO.md`](../TODO.md). The narration script,
cue offsets and estimated speech durations are in
[`guidance-recording-script-tr.md`](guidance-recording-script-tr.md). No speech
generation is scheduled automatically.

The app uses bundled recordings, not operating-system speech synthesis. There
are three independent profiles: sleep, focus and meditation. Each profile has
three cues at the one-shot offsets in `scripts/sources/guidance-scripts.json`.
The clips are spread across the session and never overlap: if a clip runs longer
than expected, the next due cue waits for it to finish. Pausing playback stops
the current clip and freezes the cue clock; resuming continues from that point.
Disabling the guide or changing profile starts a fresh schedule next time. While
a clip plays, the ambience and binaural bed lower smoothly to keep speech clear,
then return to their prior level when speech ends.

The narration texts and voice directions are maintained in
`scripts/sources/guidance-scripts.json`. The chosen narrator is Gönül Filiz
(`xsGHrtxT5AdDzYXTQT0d`) on ElevenLabs `eleven_v4`. A `sleep/settle` sample is
available in the ElevenLabs speech view, but generated files have not yet been
imported. Missing profiles are explicitly unavailable in the UI; there is no
silent system-voice fallback.

Generate each text as a separate recording with the selected narrator. Do not
include music; the app supplies the soundscape. Keep delivery natural and clear,
without whispers, added breathing or dramatic emphasis. Place recordings in a
local input directory using the following relative names:

| Profile | Clip names |
| --- | --- |
| sleep | settle, release, let-go |
| focus | begin, one-task, return |
| meditation | arrive, observe, return |

For example, `<input>/sleep/settle.wav`. WAV, MP3, Ogg, M4A and FLAC inputs are
accepted. Then run `npm run guidance:prepare -- <input>`. It uses ffmpeg-static,
system ffmpeg or `FFMPEG_BIN`, normalizes speech, exports MP3s and checks decoding
before updating `public/audio/guidance/manifest.json`. Keep each clip under two
minutes. Rebuild the app after importing the recordings.

Narration enters the main audio bus before the session fade, transport, master
volume and limiter. It is included in video and WAV recordings. Production
builds precache the narration along with the app for offline playback.
