"""
PlotForge – pytest configuration and shared fixtures.

Run from the project root:
    bash tests/run_tests.sh          ← recommended
    pytest tests/test_api.py -v      ← manual (venv must be active)
"""
import sys, os

# Support both layouts: app.py at root OR src/app.py
_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.join(_here, '..')
_src  = os.path.join(_root, 'src')

if os.path.exists(os.path.join(_src, 'app.py')):
    sys.path.insert(0, _src)   # src/app.py layout (current project)
else:
    sys.path.insert(0, _root)  # app.py at root layout (fallback)

import pytest
from app import app as flask_app


@pytest.fixture(scope="session")
def app():
    flask_app.config.update({"TESTING": True})
    yield flask_app


@pytest.fixture(scope="session")
def client(app):
    return app.test_client()


@pytest.fixture
def minimal_render_payload():
    return {"template": "sin", "params": {}, "view": {}}


@pytest.fixture
def minimal_plot_payload():
    return {
        "curves": [{
            "template": "sin",
            "params": {"A": 1, "f": 1, "phi": 0},
            "line_color": "#5affce",
            "line_width": 2,
            "line_style": "solid",
            "line_connection": "linear",
            "marker": "none",
            "marker_size": 4,
            "fill_under": False,
            "fill_alpha": 0.15,
            "label": "sin(x)",
        }],
        "view": {},
        "labels": {"title": "", "xlabel": "", "ylabel": ""},
        "text_annotations": [],
    }


@pytest.fixture
def evaluate_payload_factory():
    def _make(*var_dicts):
        return {"variables": list(var_dicts)}
    return _make