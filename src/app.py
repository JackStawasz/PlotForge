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

  # ── TRIG / SINE FAMILY ──────────────────────────────────────────────────
  "sin": {
    "category": "trig", "subfolder": "Sine Family",
    "label": "Sine", "equation": "A·sin(f·x + φ)",
    "x_default": [0, 6.283],
    "params": {
      "A":   {"label":"Amplitude (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f":   {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "phi": {"label":"Phase (φ)",     "default":0.0, "min":-5.0, "max":5.0, "step":0.05},
    },
  },
  "arcsin": {
    "category": "trig", "subfolder": "Sine Family",
    "label": "Arcsine", "equation": "A·arcsin(x)",
    "x_default": [-1, 1],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "sinh": {
    "category": "trig", "subfolder": "Sine Family",
    "label": "Sinh", "equation": "A·sinh(f·x)",
    "x_default": [-3, 3],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arcsinh": {
    "category": "trig", "subfolder": "Sine Family",
    "label": "Arcsinh", "equation": "A·arcsinh(f·x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "cos": {
    "category": "trig", "subfolder": "Cosine Family",
    "label": "Cosine", "equation": "A·cos(f·x + φ)",
    "x_default": [0, 6.283],
    "params": {
      "A":   {"label":"Amplitude (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f":   {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "phi": {"label":"Phase (φ)",     "default":0.0, "min":-5.0, "max":5.0, "step":0.05},
    },
  },
  "arccos": {
    "category": "trig", "subfolder": "Cosine Family",
    "label": "Arccosine", "equation": "A·arccos(x)",
    "x_default": [-1, 1],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "cosh": {
    "category": "trig", "subfolder": "Cosine Family",
    "label": "Cosh", "equation": "A·cosh(f·x)",
    "x_default": [-3, 3],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arccosh": {
    "category": "trig", "subfolder": "Cosine Family",
    "label": "Arccosh", "equation": "A·arccosh(f·x)",
    "x_default": [1.001, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
    },
  },
  "tan": {
    "category": "trig", "subfolder": "Tangent Family",
    "label": "Tangent", "equation": "A·tan(f·x)",
    "x_default": [-1.5, 1.5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arctan": {
    "category": "trig", "subfolder": "Tangent Family",
    "label": "Arctangent", "equation": "A·arctan(f·x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "tanh": {
    "category": "trig", "subfolder": "Tangent Family",
    "label": "Tanh", "equation": "A·tanh(f·x)",
    "x_default": [-4, 4],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arctanh": {
    "category": "trig", "subfolder": "Tangent Family",
    "label": "Arctanh", "equation": "A·arctanh(f·x)",
    "x_default": [-0.99, 0.99],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":0.1, "max":5.0, "step":0.1},
    },
  },
  "csc": {
    "category": "trig", "subfolder": "Cosecant Family",
    "label": "Cosecant", "equation": "A·csc(f·x)",
    "x_default": [0.1, 3.04],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arccsc": {
    "category": "trig", "subfolder": "Cosecant Family",
    "label": "Arccosecant", "equation": "A·arccsc(x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "csch": {
    "category": "trig", "subfolder": "Cosecant Family",
    "label": "Csch", "equation": "A·csch(f·x)",
    "x_default": [-4, 4],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arccsch": {
    "category": "trig", "subfolder": "Cosecant Family",
    "label": "Arccsch", "equation": "A·arccsch(x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "sec": {
    "category": "trig", "subfolder": "Secant Family",
    "label": "Secant", "equation": "A·sec(f·x)",
    "x_default": [-1.4, 1.4],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arcsec": {
    "category": "trig", "subfolder": "Secant Family",
    "label": "Arcsecant", "equation": "A·arcsec(x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "sech": {
    "category": "trig", "subfolder": "Secant Family",
    "label": "Sech", "equation": "A·sech(f·x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arcsech": {
    "category": "trig", "subfolder": "Secant Family",
    "label": "Arcsech", "equation": "A·arcsech(x)",
    "x_default": [0.001, 0.999],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "cot": {
    "category": "trig", "subfolder": "Cotangent Family",
    "label": "Cotangent", "equation": "A·cot(f·x)",
    "x_default": [0.1, 3.04],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arccot": {
    "category": "trig", "subfolder": "Cotangent Family",
    "label": "Arccotangent", "equation": "A·arccot(f·x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "coth": {
    "category": "trig", "subfolder": "Cotangent Family",
    "label": "Coth", "equation": "A·coth(f·x)",
    "x_default": [-4, 4],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "f": {"label":"Frequency (f)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "arccoth": {
    "category": "trig", "subfolder": "Cotangent Family",
    "label": "Arccoth", "equation": "A·arccoth(x)",
    "x_default": [-5, 5],
    "params": {
      "A": {"label":"Scale (A)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },

  # ── BELL CURVES ─────────────────────────────────────────────────────────
  "gaussian": {
    "category": "bell", "label": "Gaussian",
    "equation": "A·exp(−(x−μ)²/(2σ²))",
    "x_default": [-5, 5],
    "params": {
      "A":   {"label":"Amplitude (A)", "default":1.0, "min":-5.0,"max":5.0,"step":0.1},
      "mu":  {"label":"Mean (μ)",      "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "sig": {"label":"Std dev (σ)",   "default":1.0, "min":-5.0,"max":5.0,"step":0.1},
    },
  },
  "lorentzian": {
    "category": "bell", "label": "Lorentzian",
    "equation": "A·γ²/((x−x₀)²+γ²)",
    "x_default": [-5, 5],
    "params": {
      "A":    {"label":"Amplitude (A)", "default":1.0, "min":-5.0,"max":5.0,"step":0.1},
      "x0":   {"label":"Center (x₀)",  "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "gamma":{"label":"Width (γ)",    "default":1.0, "min":-5.0,"max":5.0,"step":0.1},
    },
  },
  "binomial": {
    "category": "bell", "label": "Binomial PMF",
    "equation": "C(n,k)·p^k·(1−p)^(n−k)",
    "x_default": [0, 30],
    "params": {
      "n": {"label":"Trials (n)", "default":20,  "min":5,    "max":50,   "step":1},
      "p": {"label":"Prob (p)",   "default":0.5, "min":0.05, "max":0.95, "step":0.05},
    },
  },
  "poisson": {
    "category": "bell", "label": "Poisson PMF",
    "equation": "λ^k·e^(−λ)/k!",
    "x_default": [0, 20],
    "params": {
      "lam": {"label":"λ (rate)", "default":4.0, "min":0.5, "max":15.0, "step":0.5},
    },
  },
  "laplace": {
    "category": "bell", "label": "Laplace",
    "equation": "A/(2b)·exp(−|x−μ|/b)",
    "x_default": [-6, 6],
    "params": {
      "A":  {"label":"Scale (A)", "default":1.0, "min":-5.0,"max":5.0,"step":0.1},
      "mu": {"label":"Mean (μ)",  "default":0.0, "min":-5.0,"max":5.0,"step":0.25},
      "b":  {"label":"Width (b)", "default":1.0, "min":-5.0,"max":5.0,"step":0.1},
    },
  },

  # ── LINES ────────────────────────────────────────────────────────────────
  "linear": {
    "category": "lines", "label": "Linear",
    "equation": "m·x + b",
    "x_default": [-10, 10],
    "params": {
      "m": {"label":"Slope (m)",     "default":1.0, "min":-5.0, "max":5.0, "step":0.5},
      "b": {"label":"Intercept (b)", "default":0.0, "min":-5.0, "max":5.0, "step":0.5},
    },
  },
  "vline": {
    "category": "lines", "label": "Vertical Line",
    "equation": "x = c",
    "x_default": [-10, 10],
    "params": {
      "c": {"label":"x position (c)", "default":0.0, "min":-5.0, "max":5.0, "step":0.5},
    },
  },
  "hline": {
    "category": "lines", "label": "Horizontal Line",
    "equation": "y = c",
    "x_default": [-10, 10],
    "params": {
      "c": {"label":"y value (c)", "default":0.0, "min":-5.0, "max":5.0, "step":0.5},
    },
  },

  # ── GENERAL ──────────────────────────────────────────────────────────────
  "poly_custom": {
    "category": "general", "label": "Polynomial",
    "equation": "Σ aₙ·xⁿ",
    "x_default": [-5, 5],
    "params": {
      "degree": {"label":"Degree","default":4,"min":1,"max":10,"step":1},
      "a0":  {"label":"a₀","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a1":  {"label":"a₁","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a2":  {"label":"a₂","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a3":  {"label":"a₃","default":1.0,"min":-5.0,"max":5.0,"step":0.25},
      "a4":  {"label":"a₄","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a5":  {"label":"a₅","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a6":  {"label":"a₆","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a7":  {"label":"a₇","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a8":  {"label":"a₈","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a9":  {"label":"a₉","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
      "a10": {"label":"a₁₀","default":0.0,"min":-5.0,"max":5.0,"step":0.25},
    },
  },
  "logarithmic": {
    "category": "general", "label": "Logarithmic",
    "equation": "a·log_b(x) + c",
    "x_default": [0.01, 10],
    "params": {
      "a": {"label":"Scale (a)",  "default":1.0,   "min":-5.0,  "max":5.0,  "step":0.1},
      "b": {"label":"Base (b)",   "default":2.718, "min":1.01,  "max":10.0, "step":0.1},
      "c": {"label":"Offset (c)", "default":0.0,   "min":-5.0,  "max":5.0,  "step":0.5},
    },
  },
  "exponential": {
    "category": "general", "label": "Exponential",
    "equation": "a·b^(s·x)",
    "x_default": [-3, 3],
    "params": {
      "a": {"label":"Amplitude (a)", "default":1.0,   "min":-5.0, "max":5.0,  "step":0.1},
      "b": {"label":"Base (b)",      "default":2.718, "min":1.01, "max":10.0, "step":0.1},
      "s": {"label":"Rate (s)",      "default":0.5,   "min":-5.0, "max":5.0,  "step":0.1},
    },
  },
  "nth_root": {
    "category": "general", "label": "Nth Root",
    "equation": "a · x^(1/n)",
    "x_default": [0, 5],
    "params": {
      "a": {"label":"Scale (a)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "n": {"label":"Root (n)",  "default":2.0, "min":1.0,  "max":10.0, "step":0.5},
    },
  },

  # ── OTHER ────────────────────────────────────────────────────────────────
  "reciprocal": {
    "category": "other", "label": "Reciprocal",
    "equation": "a / (x + h)",
    "x_default": [-5, 5],
    "params": {
      "a": {"label":"Scale (a)",  "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "h": {"label":"Shift (h)",  "default":0.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "factorial": {
    "category": "other", "label": "Factorial",
    "equation": "a · Γ(x+1)",
    "x_default": [0, 6],
    "params": {
      "a": {"label":"Scale (a)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "ceiling": {
    "category": "other", "label": "Ceiling",
    "equation": "a · ⌈x⌉",
    "x_default": [-5, 5],
    "params": {
      "a": {"label":"Scale (a)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "floor": {
    "category": "other", "label": "Floor",
    "equation": "a · ⌊x⌋",
    "x_default": [-5, 5],
    "params": {
      "a": {"label":"Scale (a)", "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
  "absolute": {
    "category": "other", "label": "Absolute Value",
    "equation": "a · |x + h|",
    "x_default": [-5, 5],
    "params": {
      "a": {"label":"Scale (a)",  "default":1.0, "min":-5.0, "max":5.0, "step":0.1},
      "h": {"label":"Shift (h)",  "default":0.0, "min":-5.0, "max":5.0, "step":0.1},
    },
  },
}


# ── Data generators ──────────────────────────────────────────────────────────
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
        x = _xrange(view, xd); y = p.get("A",1)*np.sin(p.get("f",1)*x + p.get("phi",0))
    elif tkey == "arcsin":
        lo=max(-0.9999,view.get("x_min") or -1); hi=min(0.9999,view.get("x_max") or 1)
        x=np.linspace(lo,hi,400); y=p.get("A",1)*np.arcsin(x)
    elif tkey == "sinh":
        x=_xrange(view,xd); y=p.get("A",1)*np.sinh(p.get("f",1)*x)
    elif tkey == "arcsinh":
        x=_xrange(view,xd); y=p.get("A",1)*np.arcsinh(p.get("f",1)*x)
    elif tkey == "cos":
        x=_xrange(view,xd); y=p.get("A",1)*np.cos(p.get("f",1)*x+p.get("phi",0))
    elif tkey == "arccos":
        lo=max(-0.9999,view.get("x_min") or -1); hi=min(0.9999,view.get("x_max") or 1)
        x=np.linspace(lo,hi,400); y=p.get("A",1)*np.arccos(x)
    elif tkey == "cosh":
        x=_xrange(view,xd); y=p.get("A",1)*np.cosh(p.get("f",1)*x)
    elif tkey == "arccosh":
        lo=max(1.001,view.get("x_min") or xd[0]); hi=view.get("x_max") or xd[1]
        x=np.linspace(lo,hi,400); y=p.get("A",1)*np.arccosh(p.get("f",1)*x)
    elif tkey == "tan":
        x=_xrange(view,xd,800); raw=p.get("A",1)*np.tan(p.get("f",1)*x)
        y=np.where(np.abs(raw)>50,np.nan,raw)
    elif tkey == "arctan":
        x=_xrange(view,xd); y=p.get("A",1)*np.arctan(p.get("f",1)*x)
    elif tkey == "tanh":
        x=_xrange(view,xd); y=p.get("A",1)*np.tanh(p.get("f",1)*x)
    elif tkey == "arctanh":
        f=p.get("f",1); bound=0.9999/max(0.0001,abs(f)) if f!=0 else 0.9999
        lo=max(-bound,view.get("x_min") or xd[0]); hi=min(bound,view.get("x_max") or xd[1])
        x=np.linspace(lo,hi,400); y=p.get("A",1)*np.arctanh(f*x)
    elif tkey == "csc":
        x=_xrange(view,xd,800); sv=np.sin(p.get("f",1)*x)
        raw=p.get("A",1)/np.where(np.abs(sv)<0.01,np.nan,sv)
        y=np.where(np.abs(raw)>20,np.nan,raw)
    elif tkey == "arccsc":
        x=_xrange(view,xd); xc=np.where(np.abs(x)<1.0,np.nan,x)
        y=p.get("A",1)*np.arcsin(1.0/np.where(xc==0,np.nan,xc))
    elif tkey == "csch":
        x=_xrange(view,xd); sv=np.sinh(p.get("f",1)*x)
        raw=p.get("A",1)/np.where(np.abs(sv)<0.001,np.nan,sv)
        y=np.where(np.abs(raw)>50,np.nan,raw)
    elif tkey == "arccsch":
        x=_xrange(view,xd); xc=np.where(x==0,np.nan,x)
        y=p.get("A",1)*np.arcsinh(1.0/xc)
    elif tkey == "sec":
        x=_xrange(view,xd,800); cv=np.cos(p.get("f",1)*x)
        raw=p.get("A",1)/np.where(np.abs(cv)<0.01,np.nan,cv)
        y=np.where(np.abs(raw)>20,np.nan,raw)
    elif tkey == "arcsec":
        x=_xrange(view,xd); xc=np.where(np.abs(x)<1.0,np.nan,x)
        y=p.get("A",1)*np.arccos(1.0/np.where(xc==0,np.nan,xc))
    elif tkey == "sech":
        x=_xrange(view,xd); y=p.get("A",1)/np.cosh(p.get("f",1)*x)
    elif tkey == "arcsech":
        lo=max(0.001,view.get("x_min") or xd[0]); hi=min(0.9999,view.get("x_max") or xd[1])
        x=np.linspace(lo,hi,400); y=p.get("A",1)*np.arccosh(1.0/x)
    elif tkey == "cot":
        x=_xrange(view,xd,800); sv=np.sin(p.get("f",1)*x); cv=np.cos(p.get("f",1)*x)
        raw=p.get("A",1)*cv/np.where(np.abs(sv)<0.01,np.nan,sv)
        y=np.where(np.abs(raw)>50,np.nan,raw)
    elif tkey == "arccot":
        x=_xrange(view,xd); y=p.get("A",1)*(np.pi/2-np.arctan(p.get("f",1)*x))
    elif tkey == "coth":
        x=_xrange(view,xd); tv=np.tanh(p.get("f",1)*x)
        raw=p.get("A",1)/np.where(np.abs(tv)<0.001,np.nan,tv)
        y=np.where(np.abs(raw)>50,np.nan,raw)
    elif tkey == "arccoth":
        x=_xrange(view,xd); xc=np.where(np.abs(x)<=1.0,np.nan,x)
        y=p.get("A",1)*np.arctanh(1.0/xc)
    elif tkey == "gaussian":
        x=_xrange(view,xd)
        y=p.get("A",1)*np.exp(-((x-p.get("mu",0))**2)/(2*max(0.001,p.get("sig",1))**2))
    elif tkey == "lorentzian":
        x=_xrange(view,xd); g=max(0.001,p.get("gamma",1))
        y=p.get("A",1)*g**2/((x-p.get("x0",0))**2+g**2)
    elif tkey == "binomial":
        n=int(p.get("n",20)); pk=p.get("p",0.5)
        x=np.arange(0,n+1,dtype=float); y=_binom.pmf(x.astype(int),n,pk)
    elif tkey == "poisson":
        lam=p.get("lam",4); hi=int(view.get("x_max") or max(20,int(lam*3)))
        x=np.arange(0,hi+1,dtype=float); y=_poisson.pmf(x.astype(int),lam)
    elif tkey == "laplace":
        x=_xrange(view,xd); b=max(0.001,p.get("b",1))
        y=(p.get("A",1)/(2*b))*np.exp(-np.abs(x-p.get("mu",0))/b)
    elif tkey == "linear":
        x=_xrange(view,xd); y=p.get("m",1)*x+p.get("b",0)
    elif tkey == "vline":
        c=p.get("c",0); x=np.array([c,c]); y=np.array([-1e6,1e6])
    elif tkey == "hline":
        x=_xrange(view,xd); y=np.full_like(x,p.get("c",0))
    elif tkey == "poly_custom":
        x=_xrange(view,xd); deg=int(p.get("degree",4))
        coeffs=[p.get(f"a{i}",0) for i in range(deg+1)]
        y=sum(coeffs[i]*x**i for i in range(len(coeffs)))
    elif tkey == "logarithmic":
        lo=max(0.001,view.get("x_min") or xd[0]); hi=view.get("x_max") or xd[1]
        x=np.linspace(lo,hi,400); base=max(1.0001,p.get("b",2.718))
        y=p.get("a",1)*(np.log(x)/np.log(base))+p.get("c",0)
    elif tkey == "exponential":
        x=_xrange(view,xd); base=max(1.0001,p.get("b",2.718))
        y=p.get("a",1)*np.power(base,p.get("s",0.5)*x)
    elif tkey == "nth_root":
        lo=max(0.0, view.get("x_min") or xd[0]); hi=view.get("x_max") or xd[1]
        x=np.linspace(lo,hi,400)
        n=max(0.001, p.get("n",2.0))
        y=p.get("a",1)*np.sign(x)*np.abs(x)**(1.0/n)
    elif tkey == "reciprocal":
        x=_xrange(view,xd,800); h=p.get("h",0.0)
        denom=x+h; raw=p.get("a",1)/np.where(np.abs(denom)<0.01,np.nan,denom)
        y=np.where(np.abs(raw)>50,np.nan,raw)
    elif tkey == "factorial":
        from scipy.special import gamma as _gamma
        x=_xrange(view,xd,400)
        # Use gamma function: x! = Gamma(x+1), mask negative integers
        xp1=x+1
        y=p.get("a",1)*np.where(xp1>0, _gamma(xp1), np.nan)
        y=np.where(np.abs(y)>1e8, np.nan, y)
    elif tkey == "ceiling":
        x=_xrange(view,xd,800); y=p.get("a",1)*np.ceil(x)
    elif tkey == "floor":
        x=_xrange(view,xd,800); y=p.get("a",1)*np.floor(x)
    elif tkey == "absolute":
        x=_xrange(view,xd); y=p.get("a",1)*np.abs(x+p.get("h",0.0))
    else:
        raise ValueError(f"Unknown template '{tkey}'")
    return x, y


BG="#080810"; SURFACE="#12121c"; GRID_C="#1a1a2c"; TEXT_C="#c0c0e0"; SPINE_C="#222236"

def _apply_mask(x, y, ci):
    """Apply x/y mask: keep points where x in (xMin,xMax) and y in (yMin,yMax)."""
    xn=ci.get("mask_x_min"); xx=ci.get("mask_x_max")
    yn=ci.get("mask_y_min"); yx=ci.get("mask_y_max")
    if xn is None and xx is None and yn is None and yx is None:
        return x, y
    mask=np.ones(len(x),dtype=bool)
    if xn is not None: mask&=(x>xn)
    if xx is not None: mask&=(x<xx)
    if yn is not None: mask&=(y>yn)
    if yx is not None: mask&=(y<yx)
    return x[mask], y[mask]



def _hex_to_rgb01(h):
    h=h.lstrip('#')
    return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))

def render_matplotlib_multi(curves_data, view, labels):
    """
    curves_data: list of dicts with keys:
      x, y, is_discrete, line_color, line_width, line_style,
      marker, marker_size, fill_under, fill_alpha, label
    """
    fig,ax=plt.subplots(figsize=(view.get("fig_width",9),view.get("fig_height",4.2)),facecolor=BG)
    ax.set_facecolor(SURFACE)
    show_legend=view.get("show_legend",True)

    for cd in curves_data:
        x=cd["x"]; y=cd["y"]; is_d=cd.get("is_discrete",False)
        lc=cd.get("line_color","#5affce")
        lw=cd.get("line_width",2.0)
        ls=cd.get("line_style","solid")
        mk=cd.get("marker","none"); ms=cd.get("marker_size",4)
        fill=cd.get("fill_under",False); falp=cd.get("fill_alpha",.15)
        lbl=cd.get("label","")
        mpl_mk=None if mk=="none" else mk
        try: rgb=_hex_to_rgb01(lc)
        except: rgb=(0.35,1.0,0.81)
        if is_d:
            ax.bar(x,y,color=rgb+(0.75,),width=0.6,zorder=3,label=lbl)
        else:
            ax.plot(x,y,color=rgb,linewidth=lw,linestyle=ls,
                    marker=mpl_mk,markersize=ms,
                    markerfacecolor=rgb,markeredgecolor="none",
                    zorder=3,label=lbl)
            if fill: ax.fill_between(x,y,alpha=falp,color=rgb,zorder=2)

    if view.get("x_min") is not None or view.get("x_max") is not None:
        all_x=np.concatenate([cd["x"] for cd in curves_data]) if curves_data else np.array([0,1])
        ax.set_xlim(view.get("x_min",float(all_x.min())),
                    view.get("x_max",float(all_x.max())))
    if view.get("y_min") is not None or view.get("y_max") is not None:
        all_y=np.concatenate([cd["y"] for cd in curves_data]) if curves_data else np.array([0,1])
        valid_y=all_y[~np.isnan(all_y)] if len(all_y) else all_y
        ax.set_ylim(view.get("y_min",float(valid_y.min()) if len(valid_y) else 0),
                    view.get("y_max",float(valid_y.max()) if len(valid_y) else 1))

    ax.grid(view.get("show_grid",True),color=GRID_C,linewidth=0.7,
            alpha=view.get("grid_alpha",.5),zorder=1)
    for sp in ax.spines.values(): sp.set_edgecolor(SPINE_C); sp.set_linewidth(0.8)
    ax.tick_params(colors=TEXT_C,labelsize=8,length=4,width=0.6)
    for t in ax.get_xticklabels()+ax.get_yticklabels():
        t.set_color(TEXT_C); t.set_fontfamily("monospace")
    ax.set_title(labels.get("title",""),color=TEXT_C,fontsize=view.get("title_size",13),
                 fontfamily="monospace",pad=10,loc="left",fontweight="bold")
    ax.set_xlabel(labels.get("xlabel",""),color=TEXT_C,fontsize=view.get("label_size",10),
                  fontfamily="monospace",labelpad=6)
    ax.set_ylabel(labels.get("ylabel",""),color=TEXT_C,fontsize=view.get("label_size",10),
                  fontfamily="monospace",labelpad=6)

    # Legend — only if enabled and any curve has a non-empty label
    if show_legend and any(cd.get("label","") for cd in curves_data):
        lx = view.get("legend_x_frac", 0.98)
        ly = view.get("legend_y_frac", 0.02)
        # Convert from top-origin (JS) to bottom-origin (matplotlib axes fraction)
        mpl_ly = 1.0 - ly
        leg=ax.legend(
            facecolor="#0c0c1a", edgecolor=SPINE_C,
            labelcolor=TEXT_C,
            fontsize=max(7,view.get("label_size",10)-1),
            prop={"family":"monospace","size":max(7,view.get("label_size",10)-1)},
            framealpha=0.85,
            bbox_to_anchor=(lx, mpl_ly),
            bbox_transform=ax.transAxes,
            loc="upper right" if lx > 0.5 else "upper left",
        )
        leg.get_frame().set_linewidth(0.6)

    fig.tight_layout(pad=1.4)
    buf=io.BytesIO(); fig.savefig(buf,format="png",dpi=130,facecolor=BG,bbox_inches="tight")
    plt.close(fig); buf.seek(0)
    return base64.b64encode(buf.read()).decode()

@app.route("/api/templates")
def get_templates(): return jsonify(TEMPLATES)

@app.route("/api/data", methods=["POST"])
def get_data():
    body=request.get_json(silent=True) or {}; tkey=body.get("template")
    if tkey not in TEMPLATES: return jsonify({"error":f"Unknown template '{tkey}'"}),400
    try:
        x,y=generate_xy(tkey,body.get("params",{}),body.get("view",{}))
        is_d=tkey in ("binomial","poisson")
        return jsonify({"x":x.tolist(),"y":[v if not np.isnan(v) else None for v in y.tolist()],
                        "discrete":is_d,"equation":TEMPLATES[tkey]["equation"]})
    except Exception as e: return jsonify({"error":str(e)}),500

@app.route("/api/plot", methods=["POST"])
def plot_matplotlib():
    body=request.get_json(silent=True) or {}
    view=body.get("view",{}); labels=body.get("labels",{})
    curves_in=body.get("curves",[])
    # Backwards-compat: single-curve payload
    if not curves_in and body.get("template"):
        curves_in=[{
            "template":body["template"],
            "params":body.get("params",{}),
            "line_color":view.get("line_color","#5affce"),
            "line_width":view.get("line_width",2.0),
            "line_style":view.get("line_style","solid"),
            "marker":view.get("marker","none"),
            "marker_size":view.get("marker_size",4),
            "fill_under":view.get("fill_under",False),
            "fill_alpha":view.get("fill_alpha",.15),
            "label":body.get("label",""),
        }]
    if not curves_in:
        return jsonify({"error":"No curves provided"}),400
    try:
        curves_data=[]
        for ci in curves_in:
            tkey=ci.get("template")
            if not tkey or tkey not in TEMPLATES:
                continue
            x,y=generate_xy(tkey,ci.get("params",{}),view)
            x,y=_apply_mask(x,y,ci)  # apply data mask
            is_d=tkey in ("binomial","poisson")
            y_clean=np.where(np.isnan(y),np.nan,y)
            curves_data.append({
                "x":x,"y":y_clean,"is_discrete":is_d,
                "line_color":ci.get("line_color","#5affce"),
                "line_width":ci.get("line_width",2.0),
                "line_style":ci.get("line_style","solid"),
                "marker":ci.get("marker","none"),
                "marker_size":ci.get("marker_size",4),
                "fill_under":ci.get("fill_under",False),
                "fill_alpha":ci.get("fill_alpha",.15),
                "label":ci.get("label",""),
            })
        if not curves_data:
            return jsonify({"error":"No valid curves"}),400
        img=render_matplotlib_multi(curves_data,view,labels)
        return jsonify({"image":img})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error":str(e)}),500

if __name__ == "__main__":
    print("PlotForge backend  →  http://localhost:5000")
    app.run(debug=True, port=5000)