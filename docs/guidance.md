# Recorded Turkish guidance

The app uses bundled recordings, not operating-system speech synthesis. There
are three independent profiles: sleep, focus and meditation. Each has one arrival
and two subsequent reminders. Reminders repeat at the user's chosen interval;
the arrival plays only once per start. Pausing playback or disabling the guide
stops the current clip and pending downloads.

The narration texts and voice directions are maintained in
`scripts/sources/guidance-scripts.json`. The nine final speech recordings have
not been generated yet. Missing profiles are explicitly unavailable in the UI;
there is no silent system-voice fallback.

Generate each text as a separate recording using a voice licensed for distribution
with the application. Do not include music; the app supplies the soundscape.
Place recordings in a local input directory using the following relative names:

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
