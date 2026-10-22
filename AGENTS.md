# Project guidance

- Read `README.md` before starting work to understand the app, setup, and prototype limitations.
- Update `README.md` when changes affect setup, behavior, usage, or documented limitations.
- This app is a prototype. Keep it as simple and lightweight as possible; prefer straightforward code and existing browser APIs, and avoid unnecessary dependencies, abstractions, or infrastructure.
- Do not perform Git actions like Commit, Push, Pull etc. Assume human actions

# Code style guideline

- Add descriptive comments for complex code. Explain non-obvious reasoning, assumptions, and constraints rather than restating the code.
- Keep classes short and single focused
- Keep files short, ideally under 300 lines, with clear a clear purpose and description at the top
- Keep methods short and single focus, ideally under 30 lines but exceptions are allowed
- Use descriptive variable and file names like `FloorPlan` rather than abbreviations like `FlrPln`
- Keep app-authored user-facing text (including errors and accessibility labels) in feature JSON files under `src/locales/en-CA/`; use BCP 47 locale tags and native `Intl` formatting, and keep persisted codes and export field names separate from display text.
