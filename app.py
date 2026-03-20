import io, base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

TEMPLATES = {

  # ── TRIG ────────────────────────────────────────────────────────────────
  "sin": {
    "category": "trig", "label": "Sine",
    "equation": "A·sin(f·x + φ)",
    "x_default": [0, 6.283],
    "params": {
      "A":   {"label":"Amplitude (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f":   {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "phi": {"label":"Phase (φ)",     "default":0.0, "min":-3.14,"max":3.14,"step":0.05},
    },
  },
  "cos": {
    "category": "trig", "label": "Cosine",
    "equation": "A·cos(f·x + φ)",
    "x_default": [0, 6.283],
    "params": {
      "A":   {"label":"Amplitude (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f":   {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "phi": {"label":"Phase (φ)",     "default":0.0, "min":-3.14,"max":3.14,"step":0.05},
    },
  },
  "tan": {
    "category": "trig", "label": "Tangent",
    "equation": "A·tan(f·x)",
    "x_default": [-1.5, 1.5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":3.0, "step":0.1},
    },
  },
  "sec": {
    "category": "trig", "label": "Secant",
    "equation": "A·sec(f·x)",
    "x_default": [-1.4, 1.4],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":3.0, "step":0.1},
    },
  },
  "arcsin": {
    "category": "trig", "label": "Arcsine",
    "equation": "A·arcsin(x)",
    "x_default": [-1, 1],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
    },
  },
  "arctan": {
    "category": "trig", "label": "Arctangent",
    "equation": "A·arctan(f·x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
    },
  },
  "sinh": {
    "category": "trig", "label": "Sinh",
    "equation": "A·sinh(f·x)",
    "x_default": [-3, 3],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":3.0, "step":0.1},
    },
  },
  "cosh": {
    "category": "trig", "label": "Cosh",
    "equation": "A·cosh(f·x)",
    "x_default": [-3, 3],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":3.0, "step":0.1},
    },
  },
  "damped_sin": {
    "category": "trig", "label": "Damped Sine",
    "equation": "e^(−d·x)·sin(f·x)",
    "x_default": [0, 10],
    "params": {
      "d": {"label":"Damping (d)", "default":0.3, "min":0.01,"max":2.0, "step":0.05},
      "f": {"label":"Frequency (f)","default":3.0,"min":0.5, "max":10.0,"step":0.5},
    },
  },

  # ── BELL CURVES ─────────────────────────────────────────────────────────
  "gaussian": {
    "category": "bell", "label": "Gaussian",
    "equation": "A·exp(−(x−μ)²/(2σ²))",
    "x_default": [-5, 5],
    "params": {
      "A":   {"label":"Amplitude (A)",  "default":1.0, "min":0.1,"max":5.0, "step":0.1},
      "mu":  {"label":"Mean (μ)",       "default":0.0, "min":-4.0,"max":4.0,"step":0.25},
      "sig": {"label":"Std dev (σ)",    "default":1.0, "min":0.1,"max":4.0, "step":0.1},
    },
  },
  "lorentzian": {
    "category": "bell", "label": "Lorentzian",
    "equation": "A·γ²/((x−x₀)²+γ²)",
    "x_default": [-5, 5],
    "params": {
      "A":    {"label":"Amplitude (A)",  "default":1.0, "min":0.1,"max":5.0,"step":0.1},
      "x0":   {"label":"Center (x₀)",   "default":0.0, "min":-4.0,"max":4.0,"step":0.25},
      "gamma":{"label":"Width (γ)",     "default":1.0, "min":0.1,"max":4.0,"step":0.1},
    },
  },
  "binomial": {
    "category": "bell", "label": "Binomial PMF",
    "equation": "C(n,k)·p^k·(1−p)^(n−k)",
    "x_default": [0, 30],
    "params": {
      "n": {"label":"Trials (n)",  "default":20, "min":5,   "max":50,  "step":1},
      "p": {"label":"Prob (p)",    "default":0.5,"min":0.05,"max":0.95,"step":0.05},
    },
  },
  "poisson": {
    "category": "bell", "label": "Poisson PMF",
    "equation": "λ^k·e^(−λ)/k!",
    "x_default": [0, 20],
    "params": {
      "lam": {"label":"λ (rate)", "default":4.0, "min":0.5,"max":15.0,"step":0.5},
    },
  },
  "laplace": {
    "category": "bell", "label": "Laplace",
    "equation": "A/(2b)·exp(−|x−μ|/b)",
    "x_default": [-6, 6],
    "params": {
      "A":  {"label":"Scale (A)", "default":1.0,"min":0.1,"max":5.0,"step":0.1},
      "mu": {"label":"Mean (μ)",  "default":0.0,"min":-4.0,"max":4.0,"step":0.25},
      "b":  {"label":"Width (b)", "default":1.0,"min":0.1,"max":4.0,"step":0.1},
    },
  },

  # ── SIMPLE FUNCTIONS ────────────────────────────────────────────────────
  "linear": {
    "category": "simple", "label": "Linear",
    "equation": "m·x + b",
    "x_default": [-10, 10],
    "params": {
      "m": {"label":"Slope (m)",    "default":1.0,"min":-10.0,"max":10.0,"step":0.5},
      "b": {"label":"Intercept (b)","default":0.0,"min":-10.0,"max":10.0,"step":0.5},
    },
  },
  "poly_custom": {
    "category": "simple", "label": "Polynomial",
    "equation": "Σ aₙ·xⁿ",
    "x_default": [-5, 5],
    "params": {
      "degree": {"label":"Degree","default":4,"min":1,"max":10,"step":1},
      "a0": {"label":"a₀ (const)","default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a1": {"label":"a₁",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a2": {"label":"a₂",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a3": {"label":"a₃",       "default":1.0, "min":-5.0,"max":5.0,"step":0.25},
      "a4": {"label":"a₄",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a5": {"label":"a₅",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a6": {"label":"a₆",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a7": {"label":"a₇",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a8": {"label":"a₈",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a9": {"label":"a₉",       "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "a10":{"label":"a₁₀",      "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
    },
  },
  "logarithmic": {
    "category": "simple", "label": "Logarithmic",
    "equation": "a·ln(x) + b",
    "x_default": [0.01, 10],
    "params": {
      "a": {"label":"Scale (a)","default":1.0,"min":0.1,"max":5.0,"step":0.1},
      "b": {"label":"Offset (b)","default":0.0,"min":-5.0,"max":5.0,"step":0.5},
    },
  },
  "exponential": {
    "category": "simple", "label": "Exponential",
    "equation": "a·e^(s·x)",
    "x_default": [-3, 3],
    "params": {
      "a": {"label":"Amplitude (a)","default":1.0,"min":0.1,"max":5.0,"step":0.1},
      "s": {"label":"Rate (s)",     "default":0.5,"min":-2.0,"max":2.0,"step":0.1},
    },
  },
}


# ── Data generators ─────────────────────────────────────────────────────────

from scipy.stats import binom as _binom, poisson as _poisson

def _xrange(view, defaults, n=500):
    lo = view.get("x_min") if view.get("x_min") is not None else defaults[0]
    hi = view.get("x_max") if view.get("x_max") is not None else defaults[1]
    return np.linspace(lo, hi, n)

def generate_xy(tkey, params, view):
    tpl = TEMPLATES[tkey]
    xd  = tpl["x_default"]
    p   = params

    if tkey == "sin":
        x = _xrange(view, xd)
        y = p.get("A",1)*np.sin(p.get("f",1)*x + p.get("phi",0))
    elif tkey == "cos":
        x = _xrange(view, xd)
        y = p.get("A",1)*np.cos(p.get("f",1)*x + p.get("phi",0))
    elif tkey == "tan":
        x = _xrange(view, xd, 800)
        raw = p.get("A",1)*np.tan(p.get("f",1)*x)
        y = np.where(np.abs(raw) > 50, np.nan, raw)
    elif tkey == "sec":
        x = _xrange(view, xd, 800)
        cos_v = np.cos(p.get("f",1)*x)
        raw = p.get("A",1)/np.where(np.abs(cos_v)<0.01, np.nan, cos_v)
        y = np.where(np.abs(raw) > 20, np.nan, raw)
    elif tkey == "arcsin":
        lo = max(-0.9999, view.get("x_min") or -1)
        hi = min(0.9999,  view.get("x_max") or 1)
        x = np.linspace(lo, hi, 400)
        y = p.get("A",1)*np.arcsin(x)
    elif tkey == "arctan":
        x = _xrange(view, xd)
        y = p.get("A",1)*np.arctan(p.get("f",1)*x)
    elif tkey == "sinh":
        x = _xrange(view, xd)
        y = p.get("A",1)*np.sinh(p.get("f",1)*x)
    elif tkey == "cosh":
        x = _xrange(view, xd)
        y = p.get("A",1)*np.cosh(p.get("f",1)*x)
    elif tkey == "damped_sin":
        x = _xrange(view, [max(0, xd[0]), xd[1]])
        y = np.exp(-p.get("d",0.3)*x)*np.sin(p.get("f",3)*x)
    elif tkey == "gaussian":
        x = _xrange(view, xd)
        y = p.get("A",1)*np.exp(-((x-p.get("mu",0))**2)/(2*p.get("sig",1)**2))
    elif tkey == "lorentzian":
        x = _xrange(view, xd)
        g = p.get("gamma",1)
        y = p.get("A",1)*g**2/((x-p.get("x0",0))**2 + g**2)
    elif tkey == "binomial":
        n = int(p.get("n",20)); pk = p.get("p",0.5)
        x = np.arange(0, n+1, dtype=float)
        y = _binom.pmf(x.astype(int), n, pk)
    elif tkey == "poisson":
        lam = p.get("lam",4)
        hi = int(view.get("x_max") or max(20, int(lam*3)))
        x = np.arange(0, hi+1, dtype=float)
        y = _poisson.pmf(x.astype(int), lam)
    elif tkey == "laplace":
        x = _xrange(view, xd)
        b = max(0.001, p.get("b",1))
        y = (p.get("A",1)/(2*b))*np.exp(-np.abs(x-p.get("mu",0))/b)
    elif tkey == "linear":
        x = _xrange(view, xd)
        y = p.get("m",1)*x + p.get("b",0)
    elif tkey == "poly_custom":
        x = _xrange(view, xd)
        deg = int(p.get("degree",4))
        coeffs = [p.get(f"a{i}",0) for i in range(deg+1)]
        y = sum(coeffs[i]*x**i for i in range(len(coeffs)))
    elif tkey == "logarithmic":
        lo = max(0.001, view.get("x_min") or xd[0])
        hi = view.get("x_max") or xd[1]
        x = np.linspace(lo, hi, 400)
        y = p.get("a",1)*np.log(x) + p.get("b",0)
    elif tkey == "exponential":
        x = _xrange(view, xd)
        y = p.get("a",1)*np.exp(p.get("s",0.5)*x)
    else:
        raise ValueError(f"Unknown template '{tkey}'")

    return x, y


# ── Matplotlib rendering ─────────────────────────────────────────────────────

BG      = "#080810"
SURFACE = "#12121c"
GRID_C  = "#1a1a2c"
TEXT_C  = "#c0c0e0"
SPINE_C = "#222236"

def render_matplotlib(x, y, view, labels, is_discrete=False):
    fig, ax = plt.subplots(figsize=(view.get("fig_width",9), view.get("fig_height",4.2)),
                           facecolor=BG)
    ax.set_facecolor(SURFACE)

    lc  = view.get("line_color","#5affce")
    lw  = view.get("line_width", 2.0)
    ls  = view.get("line_style","solid")
    mk  = view.get("marker","none")
    ms  = view.get("marker_size",4)
    fill= view.get("fill_under",False)
    falp= view.get("fill_alpha",.15)
    mpl_mk = None if mk=="none" else mk

    if is_discrete:
        ax.bar(x, y, color=lc, alpha=0.75, width=0.6, zorder=3)
    else:
        ax.plot(x, y, color=lc, linewidth=lw, linestyle=ls,
                marker=mpl_mk, markersize=ms,
                markerfacecolor=lc, markeredgecolor="none", zorder=3)
        if fill:
            ax.fill_between(x, y, alpha=falp, color=lc, zorder=2)

    if view.get("x_min") is not None or view.get("x_max") is not None:
        valid = x[~np.isnan(y)] if len(x) else x
        ax.set_xlim(view.get("x_min", float(valid.min()) if len(valid) else 0),
                    view.get("x_max", float(valid.max()) if len(valid) else 1))
    if view.get("y_min") is not None or view.get("y_max") is not None:
        valid_y = y[~np.isnan(y)] if len(y) else y
        ax.set_ylim(view.get("y_min", float(valid_y.min()) if len(valid_y) else 0),
                    view.get("y_max", float(valid_y.max()) if len(valid_y) else 1))

    ax.grid(view.get("show_grid",True), color=GRID_C, linewidth=0.7,
            alpha=view.get("grid_alpha",.5), zorder=1)
    for sp in ax.spines.values():
        sp.set_edgecolor(SPINE_C); sp.set_linewidth(0.8)
    ax.tick_params(colors=TEXT_C, labelsize=8, length=4, width=0.6)
    for t in ax.get_xticklabels()+ax.get_yticklabels():
        t.set_color(TEXT_C); t.set_fontfamily("monospace")

    ax.set_title(labels.get("title",""), color=TEXT_C,
                 fontsize=view.get("title_size",13), fontfamily="monospace",
                 pad=10, loc="left", fontweight="bold")
    ax.set_xlabel(labels.get("xlabel","x"), color=TEXT_C,
                  fontsize=view.get("label_size",10), fontfamily="monospace", labelpad=6)
    ax.set_ylabel(labels.get("ylabel","y"), color=TEXT_C,
                  fontsize=view.get("label_size",10), fontfamily="monospace", labelpad=6)

    fig.tight_layout(pad=1.4)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, facecolor=BG, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/api/templates")
def get_templates():
    return jsonify(TEMPLATES)

@app.route("/api/data", methods=["POST"])
def get_data():
    body = request.get_json(silent=True) or {}
    tkey = body.get("template")
    if tkey not in TEMPLATES:
        return jsonify({"error": f"Unknown template '{tkey}'"}), 400
    try:
        x, y = generate_xy(tkey, body.get("params",{}), body.get("view",{}))
        is_d = tkey in ("binomial","poisson")
        return jsonify({
            "x": x.tolist(),
            "y": [v if not np.isnan(v) else None for v in y.tolist()],
            "discrete": is_d,
            "equation": TEMPLATES[tkey]["equation"],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/plot", methods=["POST"])
def plot_matplotlib():
    body = request.get_json(silent=True) or {}
    tkey = body.get("template")
    if tkey not in TEMPLATES:
        return jsonify({"error": f"Unknown template '{tkey}'"}), 400
    try:
        x, y = generate_xy(tkey, body.get("params",{}), body.get("view",{}))
        is_d = tkey in ("binomial","poisson")
        img  = render_matplotlib(x, y, body.get("view",{}), body.get("labels",{}), is_discrete=is_d)
        yv   = y[~np.isnan(y)] if len(y) else y
        return jsonify({
            "image":  img,
            "x_min":  float(x.min())  if len(x)  else 0,
            "x_max":  float(x.max())  if len(x)  else 1,
            "y_min":  float(yv.min()) if len(yv) else 0,
            "y_max":  float(yv.max()) if len(yv) else 1,
            "n":      len(x),
            "equation": TEMPLATES[tkey]["equation"],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("PlotForge backend  →  http://localhost:5000")
    app.run(debug=True, port=5000)
