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

def render_matplotlib(x, y, view, labels, is_discrete=False):
    fig,ax=plt.subplots(figsize=(view.get("fig_width",9),view.get("fig_height",4.2)),facecolor=BG)
    ax.set_facecolor(SURFACE)
    lc=view.get("line_color","#5affce"); lw=view.get("line_width",2.0)
    ls=view.get("line_style","solid"); mk=view.get("marker","none")
    ms=view.get("marker_size",4); fill=view.get("fill_under",False); falp=view.get("fill_alpha",.15)
    mpl_mk=None if mk=="none" else mk
    if is_discrete:
        ax.bar(x,y,color=lc,alpha=0.75,width=0.6,zorder=3)
    else:
        ax.plot(x,y,color=lc,linewidth=lw,linestyle=ls,marker=mpl_mk,markersize=ms,
                markerfacecolor=lc,markeredgecolor="none",zorder=3)
        if fill: ax.fill_between(x,y,alpha=falp,color=lc,zorder=2)
    if view.get("x_min") is not None or view.get("x_max") is not None:
        valid=x[~np.isnan(y)] if len(x) else x
        ax.set_xlim(view.get("x_min",float(valid.min()) if len(valid) else 0),
                    view.get("x_max",float(valid.max()) if len(valid) else 1))
    if view.get("y_min") is not None or view.get("y_max") is not None:
        valid_y=y[~np.isnan(y)] if len(y) else y
        ax.set_ylim(view.get("y_min",float(valid_y.min()) if len(valid_y) else 0),
                    view.get("y_max",float(valid_y.max()) if len(valid_y) else 1))
    ax.grid(view.get("show_grid",True),color=GRID_C,linewidth=0.7,alpha=view.get("grid_alpha",.5),zorder=1)
    for sp in ax.spines.values(): sp.set_edgecolor(SPINE_C); sp.set_linewidth(0.8)
    ax.tick_params(colors=TEXT_C,labelsize=8,length=4,width=0.6)
    for t in ax.get_xticklabels()+ax.get_yticklabels(): t.set_color(TEXT_C); t.set_fontfamily("monospace")
    ax.set_title(labels.get("title",""),color=TEXT_C,fontsize=view.get("title_size",13),
                 fontfamily="monospace",pad=10,loc="left",fontweight="bold")
    ax.set_xlabel(labels.get("xlabel",""),color=TEXT_C,fontsize=view.get("label_size",10),
                  fontfamily="monospace",labelpad=6)
    ax.set_ylabel(labels.get("ylabel",""),color=TEXT_C,fontsize=view.get("label_size",10),
                  fontfamily="monospace",labelpad=6)
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
    body=request.get_json(silent=True) or {}; tkey=body.get("template")
    if tkey not in TEMPLATES: return jsonify({"error":f"Unknown template '{tkey}'"}),400
    try:
        x,y=generate_xy(tkey,body.get("params",{}),body.get("view",{}))
        is_d=tkey in ("binomial","poisson")
        img=render_matplotlib(x,y,body.get("view",{}),body.get("labels",{}),is_discrete=is_d)
        yv=y[~np.isnan(y)] if len(y) else y
        return jsonify({"image":img,"x_min":float(x.min()) if len(x) else 0,
                        "x_max":float(x.max()) if len(x) else 1,
                        "y_min":float(yv.min()) if len(yv) else 0,
                        "y_max":float(yv.max()) if len(yv) else 1,
                        "n":len(x),"equation":TEMPLATES[tkey]["equation"]})
    except Exception as e: return jsonify({"error":str(e)}),500

if __name__ == "__main__":
    print("PlotForge backend  →  http://localhost:5000")
    app.run(debug=True, port=5000)