# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run / Test commands

- **Start dev server:** `./start.sh` (creates `venv/` on first run, installs from `src/backend/requirements.txt` when its hash changes, then `python3 src/backend/app.py`). Server listens on **port 5001**. Open `src/index.html` (or `http://localhost:5001/`) in a browser.
- **Full test suite:** `bash run_tests.sh` — sets up venv + Node deps, starts the server if needed, then runs pytest, Vitest, and Playwright sequentially.
- **Backend tests only:** `pytest test/test_api.py` (server must be running).
- **JS math tests only:** `npx --prefix test vitest run --config test/vitest.config.js test/test_math.js`.
- **UI tests only:** `test/node_modules/.bin/playwright test --config test/playwright_config.js` (server must be running).
- **Single pytest:** `pytest test/test_api.py::test_name`.
- **Single Vitest:** add `-t "<test name pattern>"` to the vitest command.

**Port mismatch warning:** `app.py` runs on 5001 and the frontend in `src/API.js` hits `http://localhost:5001/api`, but `run_tests.sh` health-checks `localhost:5000`. The "external server" branch in `run_tests.sh` will therefore not detect a running 5001 server — the script will spawn its own and may fail if 5001 is occupied. Stale `localhost:5000` references in `run_tests.sh` should be treated as bugs, not as truth.

**Server reload:** Flask `debug=True` auto-reloads on Python changes — no restart needed for backend edits. Static frontend files are served directly; just refresh the browser.

## Architecture

### Backend (Flask, `src/backend/`)

`app.py` mounts four blueprints, each owning a route family:

- `plot.py` → `/api/templates`, `/api/data`, `/api/plot`, `/api/plot/pdf` — curve template registry + Matplotlib (Agg) PNG/PDF rendering.
- `evaluate.py` → `/api/evaluate` — SymPy LaTeX expression evaluator. Variables come in as `{name, expr_latex, kind}`; `_substitute_vars` does a regex-based LaTeX substitution before `parse_latex`. Greek variable names are mapped via `GREEK_TO_LATEX`; multi-char text names use `\text{name}`. Constants are evaluated in order, accumulating into a context dict.
- `file_import.py` → `/api/unpickle` — Python pickle/CSV/JSON ingestion.
- `stats.py` → `/api/stats/*` — statistical analysis (describe, histogram, fit, correlation, etc.).

The Flask app statically serves the entire `src/` directory as the web root (`static_folder='..'`).

### Frontend (plain JS, no bundler)

All scripts are loaded in a fixed order from `src/index.html` and **share global scope** — there are no ES modules. Load order matters because functions defined later are referenced by callbacks attached earlier (e.g. `variables-math.js`'s `wrapMathFieldWithAC` calls `addVariable` defined in `variables-ui.js`):

1. `math.js` — pure numeric helpers (Lanczos gamma, Bessel, Fresnel, masking, etc.).
2. `theme.js` — plot theme definitions.
3. `API.js` — backend fetch wrappers, template registry, workspace save/load (uses File System Access API with `<a download>` fallback).
4. `sidebars.js` — left sidebar (Files/Variables tabs) + global `data-tip` tooltip system.
5. `variables-math.js` — MathQuill init, LaTeX autocomplete dropdown (`LATEX_COMMANDS` array), client-side `evalLatexExpr` (LaTeX → JS string → `eval`, gated by a symbol-character allowlist), `\text{}` function registry (`TEXT_FN_REGISTRY`).
6. `variables-ui.js` — variable state (`variables[]`), per-kind UI builders (`buildConstantBody`, `buildEquationBody`, `buildParameterBody`, `buildListBody`, `buildDatasetBody`), folder/scope/drag-reorder logic.
7. `plot-render.js` — Chart.js rendering, template modal.
8. `plot-ui.js` — plot card HTML, action buttons, fullscreen, duplicate.
9. `stats.js` — statistics view UI.

`<script>boot();</script>` at the bottom kicks off initialization.

### Variable system (key concepts)

- **Kinds:** `constant`, `equation`, `parameter`, `list`, `dataset`. Each has its own `build*Body` function.
- **Scope:** `'global'` or a tab id (string). Determined from `sbActiveTab` + `activeTabId` at creation time. Stored on `v.scope`.
- **Folders:** Variables can live in named folders within a scope. `_folderRenderOrder` (Map<scopeKey, string[]>), `_folderCollapsed` (Set), `_persistedFolders` (Set) track per-scope folder state. `collapseKey` is `${scopeId}::${folderName}`.
- **Adding a variable:** `addVariable(kind, {scope, folder, ...})`. The function pushes to `variables[]`, calls `renderVariables()`, then auto-focuses the new field via a kind-aware selector (`#vmq_${id}`, `#vnamemq_${id}`, or `#vdataname_${id}`).
- **`wrapMathFieldWithAC(mqEl, mf, varCtx)`:** attaches autocomplete keyboard nav to a MathQuill field. The optional `varCtx` (the `v` object) enables Enter-with-closed-dropdown to spawn a sibling constant in the same scope/folder.

### Math evaluation paths

There are **two evaluators** that must stay roughly consistent:

1. **Backend SymPy** (`src/backend/evaluate.py`) — exact, symbolic, used for variable values shown in the UI.
2. **Client-side `evalLatexExpr`** in `variables-math.js` — fast, used during plot rendering at thousands of x-values per curve. Built by string substitution into JS and `eval`'d. A symbol-check regex (`/[a-df-wyzA-DF-WYZ_$]/`) rejects expressions containing unknown letter symbols, so any code injected via this path must produce bare numeric strings (no function/var keywords). `\binom` and `n!` are pre-resolved into numeric literals via regex callbacks before the JS conversion.

When adding a new operator, update both paths (or document why not).

### Test layout

```
test/
├── conftest.py            # pytest Flask-client fixture
├── test_api.py            # pytest — backend routes
├── test_math.js           # Vitest — pure math helpers (loads src/math.js)
├── test_ui.js             # Playwright — full-page UI flows
├── playwright_config.js
├── vitest.config.js
└── datasets/              # shared JSON payload fixtures
```

## Project conventions

- **Branching:** Work directly on `main`. Worktrees break the Flask dev server because the static-file path (`static_folder='..'` in `app.py`) is resolved relative to the server's cwd and gets confused outside the canonical checkout.
- **No `--no-verify`, no force-push to main.** Standard git hygiene.
