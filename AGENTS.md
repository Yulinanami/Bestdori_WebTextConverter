# Repository Guidelines

## Project Structure & Module Organization
- `run.py` boots the Waitress-backed Flask app and opens the SPA on port 5000.
- `src/` holds backend code: `app.py` (factory), `routes/` (API blueprints for conversion, upload/download), `converter.py` and `parser.py` (text → Bestdori JSON pipeline), `config.py` (config manager), `utils.py` (file format conversion), `models.py` (data structures).
- Frontend lives in `templates/index.html` (SPA shell) and `static/` (ES module JS under `js/`, styles in `css/`, fonts/images). `assets/` stores screenshots used in docs.
- `config.yaml` contains default role, costume, and layout presets; `example/邦——多利.txt` is a sample script for manual checks.

## Build, Test, and Development Commands
- Create venv and install:  
  ```bash
  python -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  ```
- Run locally (opens http://127.0.0.1:5000):  
  ```bash
  python run.py
  ```
- No build step is required; JS loads via the import map defined in `templates/index.html`.

## Coding Style & Naming Conventions
- Python: 4-space indent, keep functions and modules in `snake_case`, classes in `PascalCase`, favor explicit logging (see `src/app.py` and `src/routes/conversion.py`).
- JavaScript: ES modules with import-map aliases (`@utils/`, `@managers/`, etc.), 2-space indent, prefer small pure helpers in `static/js/utils/` and stateful managers in `static/js/managers/`.
- Keep templates lean; push logic to JS or Python helpers rather than inline script blocks. Reuse existing CSS tokens in `static/css/main.css`.

## Testing Guidelines
- There is no automated test suite yet; use manual QA: start the server, import `example/邦——多利.txt`, walk through conversion, and verify JSON download/open works.
- When adding features, include a minimal reproducible check in PR notes (inputs used, expected output). If you add tests, place pytest files under `tests/` and run with `pytest`.

## Commit & Pull Request Guidelines
- Git history favors short, present-tense summaries (e.g., “修复上传错误处理”, “css模块化”). Follow that style and scope commits narrowly.
- PRs should describe intent, key changes, and impact. Include: linked issue (if any), before/after screenshots for UI tweaks, manual test notes, and any config/data migrations (e.g., updates to `config.yaml`).
- Keep imports and module paths consistent with the import map; flag any breaking API changes in `src/routes/` clearly in the PR description.

## Configuration Tips
- Preserve the import map when adding JS modules; new shared utilities go under `static/js/utils/` and should be referenced via `@utils/`.
- Avoid committing large generated JSON exports; add them to `.gitignore` if needed. Keep `config.yaml` changes additive to avoid disrupting existing presets.
