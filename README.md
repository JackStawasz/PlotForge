# PlotForge
Final project for GenAI class. PlotForge is a plotting interface for streamlining data analysis workflows.


## Local Server Hosting Instructions

### Startup

1. Open a Linux terminal and cd into the project folder
2. Run the ```./start.sh``` command to host the python server
3. Open ```src/index.html```

### Notes

First Startup: python dependencies from ```requirements.txt``` will be installed into a new virtual environment folder ```venv```.

Updating ```app.py``` does not require a server reboot: the server package ```flask``` handles this automatically.

If ```requirements.txt``` is updated (to match ```app.py``` imports) then the new dependencies will be installed upon restarting the server. If there is still a missing import due to a failed installation, delete ```venv/.req_hash``` to try again.

<<<<<<< Updated upstream
Updating ```app.py``` does not require a server reboot: the server package ```flask``` handles this automatically.
=======
## Test Suite

### Execution

In the project's root directory, run ```bash run_tests.sh```. Execution should take ~1min.

### File Structure

```
test/
├── conftest.py              pytest fixtures (Flask test client, shared payloads)
├── test_api.py              Backend API tests (pytest)
├── test_ui.spec.js          End-to-end UI tests (Playwright)
├── playwright.config.js     Playwright configuration
├── test_math.js             Client-side math unit tests (Vitest)
├── vitest_config.js         Vitest configuration
└── datasets/
    ├── sample_curves.json     Reusable /api/render and /api/plot payloads
    └── sample_variables.json  Reusable /api/evaluate payloads
```
>>>>>>> Stashed changes
