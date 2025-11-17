# Repository Guidelines

## Project Structure & Module Organization
Backend logic lives in `src/`, with `app.py` wiring Flask, `routes/` grouping blueprints, and helpers split across `converter.py`, `parser.py`, and `utils.py`. Templates reside in `templates/`, static assets (compiled JS, CSS, icons) in `static/`, and reference screenshots in `assets/`. `config.yaml` stores default character, costume, and layout metadata that the converter expects at runtime. Use `run.py` as the entry point; no code should go in the repository root beyond tooling or packaging files such as `BestdoriConverter.spec`.

## Build, Test, and Development Commands
Create a fresh environment before hacking:
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```
Run the app locally with `python run.py`, which boots the Flask server plus the SPA assets under `/`. For production-like checks, start the waitress server via `waitress-serve --call 'src.app:create_app'` to verify multi-threaded behavior. Keep dependencies synced by re-running `pip install -r requirements.txt` whenever you touch `requirements.txt`.

## Coding Style & Naming Conventions
Follow PEP 8: 4-space indentation, snake_case module and function names, and PascalCase classes in `models.py`. Keep Flask routes slim; push parsing rules into `converter.py` or dedicated helpers. JavaScript in `static/js` sticks to ES modules with kebab-case filenames and camelCase functions. Before opening a PR, format Python files with `python -m black src run.py` and lint with `flake8 src run.py`.

## Testing Guidelines
The project currently relies on targeted manual testing. After code changes, restart the dev server (`python run.py`) and verify the text-to-Bestdori flow: upload `.txt`, `.docx`, and `.md` samples, assign characters, export JSON, and re-import `config.yaml`. If you add parsing or model logic, write unit tests under `src/tests/` (create the directory if absent) using `pytest`, then run `pytest src/tests -q`. Aim to cover new branches, especially around quote normalization and Live2D layout generation.

## Commit & Pull Request Guidelines
History favors concise, imperative subjects (e.g., `新增在换行符前添加多个空格的功能`). Keep messages under 72 characters and include a short body when context is non-obvious. For pull requests, describe user-facing changes, link any Bestdori forum threads or GitHub issues, attach UI screenshots for SPA tweaks, and list manual verification steps (file types converted, browsers used). Request review before merging anything that alters `config.yaml` defaults or converter heuristics.
