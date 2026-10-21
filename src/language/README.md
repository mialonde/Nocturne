# Language

English is the source and default UI language.

- `en.ts` is the source catalogue. Add every user-facing string there.
- `useTranslation.ts` exposes `t(key, values)` and reads the active locale from the persisted store.
- `types.ts` owns the supported language list.

## Adding a language

1. Create `xx.ts` with the same keys as `en.ts` and type it as `Messages`.
2. Import it into `index.ts` and add it to `LOCALES`.
3. Add the language code to `LANGUAGES` in `types.ts`.
4. Add the language to the UI selector once the catalogue is considered complete.

Keys are flat and stable. Use `{placeholders}` for values that change at runtime.
