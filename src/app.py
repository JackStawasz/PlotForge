import io, base64, json, os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

_here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_here, "templates.json"), encoding="utf-8") as _f:
    TEMPLATES = json.load(_f)

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
    elif tkey == "legendre":
        lo=max(-1.0, view.get("x_min") or xd[0]); hi=min(1.0, view.get("x_max") or xd[1])
        x=np.linspace(lo,hi,600)
        ell=max(0,int(round(p.get("ell",3)))); a=p.get("a",1)
        from numpy.polynomial.legendre import legval
        coeffs=[0]*ell+[1]
        y=a*legval(x,coeffs)
    elif tkey == "sinc":
        x=_xrange(view,xd,600); A=p.get("A",1); f=p.get("f",1)
        arg=np.pi*f*x
        # normalized sinc: sin(pi*f*x)/(pi*f*x), limit 1 at x=0
        y=A*np.where(np.abs(arg)<1e-10, 1.0, np.sin(arg)/arg)
    elif tkey == "bessel":
        from scipy.special import jv as _jv
        x=_xrange(view,xd,600); n=max(0,int(round(p.get("n",0)))); A=p.get("A",1)
        y=A*_jv(n, x)
    elif tkey == "fresnel_c":
        from scipy.special import fresnel as _fresnel
        x=_xrange(view,xd,600); A=p.get("A",1); f=p.get("f",1)
        S_val, C_val=_fresnel(f*x)
        y=A*C_val
    elif tkey == "fresnel_s":
        from scipy.special import fresnel as _fresnel
        x=_xrange(view,xd,600); A=p.get("A",1); f=p.get("f",1)
        S_val, C_val=_fresnel(f*x)
        y=A*S_val
    elif tkey == "erf":
        from scipy.special import erf as _erf
        x=_xrange(view,xd,600); A=p.get("A",1); f=p.get("f",1)
        y=A*_erf(f*x)
    elif tkey == "airy":
        from scipy.special import airy as _airy
        x=_xrange(view,xd,600); A=p.get("A",1); f=p.get("f",1)
        Ai, Aip, Bi, Bip=_airy(f*x)
        y=A*Ai
    else:
        raise ValueError(f"Unknown template '{tkey}'")
    return x, y


BG="#080810"; SURFACE="#12121c"; GRID_C="#1a1a2c"; TEXT_C="#c0c0e0"; SPINE_C="#222236"

def _apply_mask(x, y, ci):
    """Keep only points where x ∈ (xMin, xMax) and y ∈ (yMin, yMax)."""
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

def render_matplotlib_multi(curves_data, view, labels, text_annotations=None):
    """Render one or more curves to a PNG via Matplotlib and return a base64 string.
    Each entry in curves_data is a dict with x, y, style, and label fields.
    """
    bg_color      = view.get("bg_color", BG)
    surface_color = view.get("surface_color", SURFACE)
    fig,ax=plt.subplots(figsize=(view.get("fig_width",9),view.get("fig_height",4.2)),facecolor=bg_color)
    ax.set_facecolor(surface_color)
    show_legend=view.get("show_legend",True)

    for cd in curves_data:
        x=np.array(cd["x"]); y=np.array(cd["y"]); is_d=cd.get("is_discrete",False)
        lc=cd.get("line_color","#5affce")
        lw=cd.get("line_width",2.0)
        ls=cd.get("line_style","solid")
        lconn=cd.get("line_connection","linear")
        mk=cd.get("marker","none"); ms=cd.get("marker_size",4)
        fill=cd.get("fill_under",False); falp=cd.get("fill_alpha",.15)
        lbl=cd.get("label","")
        try: rgb=_hex_to_rgb01(lc)
        except: rgb=(0.35,1.0,0.81)
        mpl_mk=None if mk=="none" else mk
        mpl_ls = "None" if ls=="none" else ls
        stroke_only_markers = {'+', 'x', '1', '2', '3', '4', '|', '_'}
        if mpl_mk in stroke_only_markers:
            mpl_markerfacecolor = 'none'
            mpl_markeredgecolor = rgb
            mpl_markeredgewidth = max(1.0, lw * 0.6)
        else:
            mpl_markerfacecolor = rgb
            mpl_markeredgecolor = 'none'
            mpl_markeredgewidth = 0
        # Smooth curve for cubic/bezier connections
        px, py = x, y
        if lconn in ("cubic", "bezier") and not is_d and len(x) >= 4:
            from scipy.interpolate import make_interp_spline
            try:
                finite = np.isfinite(x) & np.isfinite(y)
                xf, yf = x[finite], y[finite]
                if len(xf) >= 4:
                    # Sort by x and remove duplicates for make_interp_spline
                    sort_idx = np.argsort(xf)
                    xf, yf = xf[sort_idx], yf[sort_idx]
                    _, unique_idx = np.unique(xf, return_index=True)
                    xf, yf = xf[unique_idx], yf[unique_idx]
                    if len(xf) >= 4:
                        order = 3 if lconn == "cubic" else min(3, len(xf) - 1)
                        spl = make_interp_spline(xf, yf, k=order)
                        px = np.linspace(xf[0], xf[-1], max(500, len(xf) * 4))
                        py = spl(px)
            except Exception:
                pass
        if is_d:
            ax.bar(x,y,color=rgb+(0.75,),width=0.6,zorder=3,label=lbl)
        elif lconn == "step":
            ax.step(px,py,where='pre',color=rgb,linewidth=lw,linestyle=mpl_ls,
                    marker=mpl_mk,markersize=ms,
                    markerfacecolor=mpl_markerfacecolor,
                    markeredgecolor=mpl_markeredgecolor,
                    markeredgewidth=mpl_markeredgewidth,
                    zorder=3,label=lbl)
            if fill: ax.fill_between(px,py,alpha=falp,color=rgb,step='pre',zorder=2)
        else:
            ax.plot(px,py,color=rgb,linewidth=lw,linestyle=mpl_ls,
                    marker=mpl_mk,markersize=ms,
                    markerfacecolor=mpl_markerfacecolor,
                    markeredgecolor=mpl_markeredgecolor,
                    markeredgewidth=mpl_markeredgewidth,
                    zorder=3,label=lbl)
            if fill: ax.fill_between(px,py,alpha=falp,color=rgb,zorder=2)

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

    # Log scale
    if view.get("x_log",False): ax.set_xscale('log')
    if view.get("y_log",False): ax.set_yscale('log')

    # Axis lines at x=0 and y=0
    if view.get("show_axis_lines",True):
        aa = view.get("axis_alpha",0.6)
        axis_color=(0.7,0.7,0.86,aa)
        ax.axhline(0,color=axis_color,linewidth=0.9,zorder=2)
        ax.axvline(0,color=axis_color,linewidth=0.9,zorder=2)
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
            fontsize=max(6, view.get("legend_size", 9)),
            prop={"family":"monospace","size":max(6, view.get("legend_size", 9))},
            framealpha=0.85,
            bbox_to_anchor=(lx, mpl_ly),
            bbox_transform=ax.transAxes,
            loc="upper right" if lx > 0.5 else "upper left",
        )
        leg.get_frame().set_linewidth(0.6)

    # Text annotations
    if text_annotations:
        for ann in text_annotations:
            x_frac = ann.get("x_frac", 0.5)
            y_frac = ann.get("y_frac", 0.5)
            text   = ann.get("text", "")
            color  = ann.get("color", "#eeeeff")
            size   = ann.get("size", 13)
            bold   = ann.get("bold", False)
            fw     = "bold" if bold else "normal"
            ax.text(x_frac, 1.0 - y_frac, text,
                    transform=ax.transAxes,
                    color=color, fontsize=size,
                    fontfamily="monospace", fontweight=fw,
                    ha="center", va="center", zorder=30)

    fig.tight_layout(pad=1.4)
    buf=io.BytesIO(); fig.savefig(buf,format="png",dpi=130,facecolor=bg_color,bbox_inches="tight")
    plt.close(fig); buf.seek(0)
    return base64.b64encode(buf.read()).decode()

@app.route("/api/templates")
def get_templates(): return jsonify(TEMPLATES)

@app.route("/api/unpickle", methods=["POST"])
def unpickle_file():
    """Accept a .pkl upload, unpickle it, and return its contents as JSON variables.
    The pickle must contain a dict; numeric scalars → 'constant', array-likes → 'list'.
    """
    import pickle, numbers
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    if not f.filename.lower().endswith(".pkl"):
        return jsonify({"error": "File must be a .pkl file"}), 400
    try:
        data = pickle.load(f.stream)
    except Exception as e:
        return jsonify({"error": f"Failed to unpickle: {e}"}), 400
    if not isinstance(data, dict):
        return jsonify({"error": f"Pickle must contain a dict, got {type(data).__name__}"}), 400

    result = {}
    for key, val in data.items():
        name = str(key)
        # Numeric scalar → constant
        if isinstance(val, (int, float, numbers.Number, np.integer, np.floating)):
            result[name] = {"kind": "constant", "value": float(val)}
        # NumPy array or list → list variable
        elif isinstance(val, np.ndarray):
            flat = val.flatten().tolist()
            result[name] = {"kind": "list", "items": [float(x) if not isinstance(x, str) else x for x in flat]}
        elif isinstance(val, (list, tuple)):
            try:
                items = [float(x) for x in val]
                result[name] = {"kind": "list", "items": items}
            except (TypeError, ValueError):
                # Skip non-numeric lists
                continue
        # Skip other types silently
    if not result:
        return jsonify({"error": "No supported values found in dict (need floats or arrays)"}), 400
    return jsonify({"variables": result})

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
    text_annotations=body.get("text_annotations",[])
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
    try:
        curves_data=[]
        for ci in curves_in:
            tkey=ci.get("template")
            # Raw x/y list curve (no template)
            if not tkey and "x" in ci and "y" in ci:
                x=np.array(ci["x"],dtype=float); y=np.array(ci["y"],dtype=float)
                curves_data.append({
                    "x":x,"y":y,"is_discrete":False,
                    "line_color":ci.get("line_color","#5affce"),
                    "line_width":ci.get("line_width",2.0),
                    "line_style":ci.get("line_style","solid"),
                    "line_connection":ci.get("line_connection","linear"),
                    "marker":ci.get("marker","none"),
                    "marker_size":ci.get("marker_size",4),
                    "fill_under":ci.get("fill_under",False),
                    "fill_alpha":ci.get("fill_alpha",.15),
                    "label":ci.get("label",""),
                })
                continue
            if not tkey or tkey not in TEMPLATES:
                continue
            x,y=generate_xy(tkey,ci.get("params",{}),view)
            x,y=_apply_mask(x,y,ci)
            is_d=tkey in ("binomial","poisson")
            y_clean=np.where(np.isnan(y),np.nan,y)
            curves_data.append({
                "x":x,"y":y_clean,"is_discrete":is_d,
                "line_color":ci.get("line_color","#5affce"),
                "line_width":ci.get("line_width",2.0),
                "line_style":ci.get("line_style","solid"),
                "line_connection":ci.get("line_connection","linear"),
                "marker":ci.get("marker","none"),
                "marker_size":ci.get("marker_size",4),
                "fill_under":ci.get("fill_under",False),
                "fill_alpha":ci.get("fill_alpha",.15),
                "label":ci.get("label",""),
            })
        img=render_matplotlib_multi(curves_data,view,labels,text_annotations)
        return jsonify({"image":img})
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error":str(e)}),500

@app.route("/api/evaluate", methods=["POST"])
def evaluate_variables():
    """Evaluate a batch of variable definitions using SymPy.
    Processes in order so each resolved value is available to later ones.
    Request:  { "variables": [{ "id", "name", "expr_latex", "kind" }, ...] }
    Response: { "results":   [{ "id", "value", "latex", "is_numeric", "error" }, ...] }
    """
    import re
    from sympy.parsing.latex import parse_latex
    from sympy import (Symbol, latex as sym_latex, N, simplify,
                       E, pi as SPI, oo, Integer, Rational)

    body = request.get_json(silent=True) or {}
    var_defs = body.get("variables", [])

    # parse_latex treats 'pi' and 'e' as Symbol names — substitute the real constants
    CONST_SUBS = [(Symbol('pi'), SPI), (Symbol('e'), E)]

    # Greek placeholder atoms used when encoding \text{long_name} → single parse_latex tokens
    # (parse_latex would treat multi-char tokens as implicit products of single letters)
    GREEK_POOL = [
        ('\\alpha','alpha'), ('\\beta','beta'), ('\\gamma','gamma'),
        ('\\delta','delta'), ('\\varepsilon','varepsilon'), ('\\zeta','zeta'),
        ('\\eta','eta'), ('\\vartheta','vartheta'), ('\\iota','iota'),
        ('\\kappa','kappa'), ('\\lambda','lambda'), ('\\mu','mu'),
        ('\\nu','nu'), ('\\xi','xi'), ('\\varpi','varpi'),
        ('\\varrho','varrho'), ('\\varsigma','varsigma'), ('\\tau','tau'),
        ('\\upsilon','upsilon'), ('\\varphi','varphi'),
        ('\\chi','chi'), ('\\psi','psi'), ('\\omega','omega'),
    ]

    def _replace_text_vars(s):
        """Replace \\text{name} → Greek placeholder; return (processed, {sympy_name: orig})."""
        text_map = {}; ctr = [0]
        def sub(m):
            name = m.group(1)
            if ctr[0] >= len(GREEK_POOL):
                return re.sub(r'[^a-zA-Z0-9_]', '_', name)
            _, sympy_name = GREEK_POOL[ctr[0]]
            latex_g = GREEK_POOL[ctr[0]][0]
            text_map[sympy_name] = name; ctr[0] += 1
            return latex_g
        return re.sub(r'\\text\{([^}]+)\}', sub, s), text_map

    def _fmt_number(expr):
        """Format a fully-numeric SymPy expr → {value, latex}."""
        if expr == oo:  return {'value': float('inf'),  'latex': '\\infty'}
        if expr == -oo: return {'value': float('-inf'), 'latex': '-\\infty'}
        if expr.is_Integer:
            v = int(expr); return {'value': v, 'latex': str(v)}
        if expr.is_Rational:
            return {'value': float(expr), 'latex': sym_latex(expr)}
        try:
            v = float(N(expr, 15))
        except Exception:
            return {'value': None, 'latex': sym_latex(expr)}
        if abs(v - round(v)) < 1e-9 * max(1.0, abs(v)):
            v = int(round(v)); return {'value': v, 'latex': str(v)}
        return {'value': v, 'latex': f'{v:.10g}'}

    def _eval_one(expr_latex, ctx_syms):
        if not expr_latex or not expr_latex.strip():
            return {'value': None, 'latex': '', 'is_numeric': False, 'error': 'empty'}

        from sympy import (expand, factor, cancel, Poly, degree,
                           Symbol as Sym, latex as sym_latex)
        from sympy.abc import x as _x

        # ── Step 1: build a safe encoding for ALL variable names ──────────
        # Names can be: plain "b", subscripted "b_0", or text "\text{abc}".
        # parse_latex cannot handle multi-char or subscripted atoms reliably,
        # so we replace every user-defined name with an unused Greek placeholder.
        all_names = list(ctx_syms.keys())  # names that already have numeric values
        # Also scan expr for any remaining \text{} patterns
        text_names_in_expr = re.findall(r'\\text\{([^}]+)\}', expr_latex)
        for tn in text_names_in_expr:
            if tn not in all_names:
                all_names.append(tn)

        # Greek pool — enough for virtually any expression
        POOL = [
            ('\\alpha','_pA'), ('\\beta','_pB'), ('\\gamma','_pC'),
            ('\\delta','_pD'), ('\\varepsilon','_pE'), ('\\zeta','_pF'),
            ('\\eta','_pG'), ('\\vartheta','_pH'), ('\\iota','_pI'),
            ('\\kappa','_pJ'), ('\\lambda','_pK'), ('\\mu','_pL'),
            ('\\nu','_pM'), ('\\xi','_pN'), ('\\varpi','_pO'),
            ('\\varrho','_pP'), ('\\varsigma','_pQ'), ('\\tau','_pR'),
            ('\\upsilon','_pS'), ('\\varphi','_pT'),
            ('\\chi','_pU'), ('\\psi','_pV'), ('\\omega','_pW'),
        ]
        # Map: original_name → (latex_placeholder, sympy_placeholder_name)
        name_enc = {}
        pool_idx = 0
        for nm in sorted(all_names, key=len, reverse=True):  # longest first
            if pool_idx >= len(POOL):
                break
            name_enc[nm] = POOL[pool_idx]
            pool_idx += 1

        # ── Step 2: rewrite expr_latex replacing all known names ──────────
        processed = expr_latex
        # Replace \text{name} patterns first
        def _sub_text(m):
            nm = m.group(1)
            if nm in name_enc:
                return name_enc[nm][0]  # latex placeholder
            return re.sub(r'[^a-zA-Z0-9]', '', nm) or 'z'
        processed = re.sub(r'\\text\{([^}]+)\}', _sub_text, processed)

        # Replace subscripted names: b_0, b_{0}, etc.
        for nm, (lat_ph, _) in sorted(name_enc.items(), key=lambda x: -len(x[0])):
            if '_' in nm:
                base, sub = nm.split('_', 1)
                pat = r'(?<![a-zA-Z\\])' + re.escape(base) + r'_(?:\{' + re.escape(sub) + r'\}|' + re.escape(sub) + r')(?![a-zA-Z0-9_])'
                _repl = lat_ph
                processed = re.sub(pat, lambda m, r=_repl: r, processed)

        # Replace plain single-letter names that are in our encoding
        for nm, (lat_ph, _) in sorted(name_enc.items(), key=lambda x: -len(x[0])):
            if '_' not in nm and len(nm) == 1:
                _repl = lat_ph
                processed = re.sub(r'(?<![a-zA-Z\\])' + re.escape(nm) + r'(?![a-zA-Z_])', lambda m, r=_repl: r, processed)

        # ── Step 3: parse with SymPy ──────────────────────────────────────
        try:
            expr = parse_latex(processed)
        except Exception as exc:
            return {'value': None, 'latex': expr_latex, 'is_numeric': False, 'error': str(exc)}

        # ── Step 4: substitute math constants ────────────────────────────
        expr = expr.subs(CONST_SUBS)

        # ── Step 5: substitute numeric ctx values via placeholder symbols ─
        for nm, val in ctx_syms.items():
            if nm in name_enc:
                ph_sym = Sym(name_enc[nm][1])
                expr = expr.subs(ph_sym, val)

        # ── Step 6: cancel, expand, flatten parse_latex grouping artefact ──
        from sympy import sympify as sp_sympify
        try:
            expr = cancel(expr)
        except Exception:
            pass
        try:
            expr = sp_sympify(str(expand(expr)))
        except Exception:
            try:
                expr = expand(expr)
            except Exception:
                pass

        # ── Step 7: check if fully numeric ───────────────────────────────
        free = expr.free_symbols
        if not free:
            fmt = _fmt_number(expr)
            if fmt['value'] is not None:
                return {'value': fmt['value'], 'latex': fmt['latex'], 'is_numeric': True, 'error': None}
            return {'value': None, 'latex': fmt['latex'], 'is_numeric': False, 'error': None}

        # ── Step 8: render symbolic result back to latex ──────────────────
        # Try polynomial ordering (highest degree first) if expr is a polynomial
        result_latex = None
        try:
            free_list = list(free)
            if len(free_list) == 1:
                p_obj = Poly(expr, free_list[0])
                # sym_latex(Poly) includes "Poly(...)" wrapper — use its expression form
                result_latex = sym_latex(p_obj.as_expr())
        except Exception:
            pass
        if result_latex is None:
            result_latex = sym_latex(expr)

        # ── Step 9: decode placeholders back to original latex names ─────
        # sym_latex uses the sympy symbol name directly, e.g. \alpha, \beta
        for nm, (lat_ph, sym_ph) in name_enc.items():
            # Determine the latex representation of this name for display
            if '_' in nm:
                base, sub = nm.split('_', 1)
                display_latex = f'{base}_{{{sub}}}'
            elif len(nm) > 1:
                display_latex = f'\\text{{{nm}}}'
            else:
                display_latex = nm
            # Replace the placeholder's latex representation in result_latex
            # sym_latex renders \alpha as \alpha etc.
            ph_in_output = lat_ph  # e.g. \alpha
            # Build a safe regex that matches the placeholder as a whole token
            ph_escaped = re.escape(ph_in_output)
            result_latex = re.sub(ph_escaped + r'(?![a-zA-Z])', display_latex, result_latex)

        return {'value': None, 'latex': result_latex, 'is_numeric': False, 'error': None}

    ctx = {}   # name → float, grows as variables resolve
    results = []
    for vdef in var_defs:
        vid        = vdef.get('id')
        name       = vdef.get('name', '')
        expr_latex = vdef.get('expr_latex', '')
        kind       = vdef.get('kind', 'constant')

        if kind == 'parameter':
            try:
                v = float(expr_latex)
                if name: ctx[name] = v
                results.append({'id': vid, 'value': v, 'latex': expr_latex,
                                 'is_numeric': True, 'error': None})
            except Exception:
                results.append({'id': vid, 'value': None, 'latex': expr_latex,
                                 'is_numeric': False, 'error': 'not a number'})
            continue

        local_ctx = {k: v for k, v in ctx.items() if k != name}
        res = _eval_one(expr_latex, local_ctx)
        res['id'] = vid
        if res['is_numeric'] and res['value'] is not None and name:
            ctx[name] = res['value']
        results.append(res)

    return jsonify({'results': results})


# ── Statistical Analysis Endpoints ───────────────────────────────────────────

@app.route("/api/stats/describe", methods=["POST"])
def stats_describe():
    from scipy import stats as sp_stats
    body = request.get_json(silent=True) or {}
    raw  = body.get("data", [])
    arr  = np.array([x for x in raw if x is not None], dtype=float)
    arr  = arr[np.isfinite(arr)]
    if len(arr) < 2:
        return jsonify({"error": "Need at least 2 finite data points"}), 400
    desc = sp_stats.describe(arr)
    q1, q3 = np.percentile(arr, [25, 75])
    return jsonify({
        "n":        int(desc.nobs),
        "min":      float(np.min(arr)),
        "max":      float(np.max(arr)),
        "mean":     float(desc.mean),
        "median":   float(np.median(arr)),
        "std":      float(np.std(arr, ddof=1)),
        "variance": float(desc.variance),
        "skewness": float(desc.skewness),
        "kurtosis": float(desc.kurtosis),
        "q1":       float(q1),
        "q3":       float(q3),
        "iqr":      float(q3 - q1),
        "sem":      float(sp_stats.sem(arr)),
    })


@app.route("/api/stats/histogram", methods=["POST"])
def stats_histogram():
    from scipy.stats import gaussian_kde
    body = request.get_json(silent=True) or {}
    raw  = body.get("data", [])
    arr  = np.array([x for x in raw if x is not None], dtype=float)
    arr  = arr[np.isfinite(arr)]
    if len(arr) < 2:
        return jsonify({"error": "Need at least 2 finite data points"}), 400
    bins = body.get("bins", "auto")
    kde  = body.get("kde", True)
    if isinstance(bins, str):
        edges = np.histogram_bin_edges(arr, bins=bins)
    else:
        edges = np.histogram_bin_edges(arr, bins=max(1, int(bins)))
    counts, edges = np.histogram(arr, bins=edges)
    centers  = ((edges[:-1] + edges[1:]) / 2).tolist()
    bin_width = float(edges[1] - edges[0]) if len(edges) > 1 else 1.0
    result = {
        "counts":    counts.tolist(),
        "edges":     edges.tolist(),
        "centers":   centers,
        "bin_width": bin_width,
    }
    if kde and len(arr) >= 3:
        try:
            kde_fn = gaussian_kde(arr)
            x_kde  = np.linspace(arr.min(), arr.max(), 300)
            y_kde  = kde_fn(x_kde) * len(arr) * bin_width
            result["kde_x"] = x_kde.tolist()
            result["kde_y"] = y_kde.tolist()
        except Exception as e:
            result["kde_error"] = str(e)
    return jsonify(result)


@app.route("/api/stats/fit", methods=["POST"])
def stats_fit():
    from scipy.optimize import curve_fit
    body     = request.get_json(silent=True) or {}
    x_raw    = body.get("x", [])
    y_raw    = body.get("y", [])
    fit_type = body.get("type", "gaussian")
    degree   = max(1, min(int(body.get("degree", 2)), 10))
    want_ci  = bool(body.get("ci", False))

    n = min(len(x_raw), len(y_raw))
    x = np.array(x_raw[:n], dtype=float)
    y = np.array(y_raw[:n], dtype=float)
    mask = np.isfinite(x) & np.isfinite(y)
    x, y = x[mask], y[mask]
    if len(x) < 3:
        return jsonify({"error": "Need at least 3 finite paired points"}), 400

    pcov_fit  = None
    _fit_func = None  # callable(x_dense, *popt) for CI Monte Carlo
    popt      = None

    try:
        if fit_type == "gaussian":
            A0  = float(y.max() - y.min()) or 1.0
            w   = np.clip(y - y.min(), 0, None)
            mu0 = float(np.average(x, weights=w)) if w.sum() > 0 else float(np.mean(x))
            s0  = float(np.sqrt(np.average((x - mu0)**2, weights=w))) if w.sum() > 0 else float(np.std(x))
            s0  = max(s0, 1e-8)
            c0  = float(y.min())

            def _gauss(xd, A, mu, sigma, c):
                return A * np.exp(-((xd - mu)**2) / (2 * sigma**2)) + c

            popt, pcov_fit = curve_fit(_gauss, x, y, p0=[A0, mu0, s0, c0], maxfev=20000)
            y_fit   = _gauss(x, *popt)
            x_dense = np.linspace(x.min(), x.max(), 400)
            y_dense = _gauss(x_dense, *popt)
            params  = {"A": popt[0], "μ": popt[1], "σ": popt[2], "c": popt[3]}
            _fit_func = _gauss

        elif fit_type == "polynomial":
            try:
                coeffs, pcov_fit = np.polyfit(x, y, degree, cov=True)
            except Exception:
                coeffs = np.polyfit(x, y, degree)
                pcov_fit = None
            popt    = coeffs
            y_fit   = np.polyval(coeffs, x)
            x_dense = np.linspace(x.min(), x.max(), 400)
            y_dense = np.polyval(coeffs, x_dense)
            params  = {f"a{i}": float(coeffs[degree - i]) for i in range(degree + 1)}

        elif fit_type == "exponential":
            c0 = float(y.min()) - 1e-6 * abs(float(y.min()) or 1)
            ys = np.clip(y - c0, 1e-10, None)
            try:
                b0, la0 = np.polyfit(x, np.log(ys), 1)
                a0 = float(np.exp(la0))
            except Exception:
                a0, b0 = 1.0, 0.1

            def _exp(xd, a, b, c):
                return a * np.exp(b * xd) + c

            popt, pcov_fit = curve_fit(_exp, x, y, p0=[a0, b0, c0], maxfev=20000)
            y_fit   = _exp(x, *popt)
            x_dense = np.linspace(x.min(), x.max(), 400)
            y_dense = _exp(x_dense, *popt)
            params  = {"a": popt[0], "b": popt[1], "c": popt[2]}
            _fit_func = _exp

        elif fit_type == "power":
            xp = x[x > 0]; yp = y[x > 0]
            if len(xp) < 3:
                return jsonify({"error": "Power law requires positive x values"}), 400

            def _power(xd, a, b, c):
                return a * np.abs(xd) ** b + c

            try:
                b0, la0 = np.polyfit(np.log(xp), np.log(np.abs(yp) + 1e-10), 1)
                a0 = float(np.exp(la0))
            except Exception:
                a0, b0 = 1.0, 1.0
            popt, pcov_fit = curve_fit(_power, x, y, p0=[a0, b0, 0.0], maxfev=20000)
            y_fit   = _power(x, *popt)
            x_dense = np.linspace(max(x.min(), 1e-6), x.max(), 400)
            y_dense = _power(x_dense, *popt)
            params  = {"a": popt[0], "b": popt[1], "c": popt[2]}
            _fit_func = _power

        elif fit_type == "custom":
            from sympy import symbols, sympify, lambdify
            formula = body.get("formula", "").strip()
            if not formula:
                return jsonify({"error": "Provide a formula, e.g. a*x**2 + b*x + c"}), 400
            for bad in ["import", "exec", "eval", "open", "__"]:
                if bad in formula:
                    return jsonify({"error": f"Unsafe token in formula: '{bad}'"}), 400
            x_sym = symbols('x')
            expr = sympify(formula)
            free = expr.free_symbols
            param_syms = sorted([s for s in free if str(s) != 'x'], key=str)
            if not param_syms:
                return jsonify({"error": "Formula must have free parameters besides x"}), 400
            func_sym = lambdify([x_sym] + param_syms, expr, modules=['numpy'])

            def _custom(xd, *p): return np.asarray(func_sym(xd, *p), dtype=float)

            p0 = [1.0] * len(param_syms)
            popt, pcov_fit = curve_fit(_custom, x, y, p0=p0, maxfev=50000)
            y_fit   = _custom(x, *popt)
            x_dense = np.linspace(x.min(), x.max(), 400)
            y_dense = _custom(x_dense, *popt)
            params  = {str(s): float(v) for s, v in zip(param_syms, popt)}
            _fit_func = _custom

        else:
            return jsonify({"error": f"Unknown fit type '{fit_type}'"}), 400

        ss_res = float(np.sum((y - y_fit) ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2     = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
        rmse   = float(np.sqrt(np.mean((y - y_fit) ** 2)))

        # 95% CI band via Monte Carlo parameter sampling
        ci_band = None
        if want_ci and popt is not None and pcov_fit is not None:
            try:
                rng_ci  = np.random.default_rng(0)
                samples = rng_ci.multivariate_normal(np.asarray(popt, dtype=float),
                                                     np.asarray(pcov_fit, dtype=float), 500)
                if fit_type == "polynomial":
                    y_bands = np.array([np.polyval(s, x_dense) for s in samples])
                else:
                    y_bands = np.array([_fit_func(x_dense, *s) for s in samples])
                ci_band = {
                    "lo": np.percentile(y_bands, 2.5,  axis=0).tolist(),
                    "hi": np.percentile(y_bands, 97.5, axis=0).tolist(),
                }
            except Exception:
                pass

        return jsonify({
            "params":    {k: float(v) for k, v in params.items()},
            "r2":        r2,
            "rmse":      rmse,
            "residuals": (y - y_fit).tolist(),
            "x_fit":     x_dense.tolist(),
            "y_fit":     y_dense.tolist(),
            "x_orig":    x.tolist(),
            "y_orig":    y.tolist(),
            "ci_band":   ci_band,
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats/correlation", methods=["POST"])
def stats_correlation():
    body  = request.get_json(silent=True) or {}
    data  = body.get("data", {})
    names = list(data.keys())
    if len(names) < 2:
        return jsonify({"error": "Need at least 2 variables"}), 400
    min_len = min(len(v) for v in data.values())
    if min_len < 2:
        return jsonify({"error": "Need at least 2 data points per variable"}), 400
    matrix = []
    for n1 in names:
        row = []
        for n2 in names:
            a1 = np.array(data[n1][:min_len], dtype=float)
            a2 = np.array(data[n2][:min_len], dtype=float)
            ok = np.isfinite(a1) & np.isfinite(a2)
            if ok.sum() < 2:
                row.append(None)
            else:
                row.append(float(np.corrcoef(a1[ok], a2[ok])[0, 1]))
        matrix.append(row)
    return jsonify({"names": names, "matrix": matrix})


@app.route("/api/stats/test", methods=["POST"])
def stats_test():
    from scipy import stats as sp_stats
    body = request.get_json(silent=True) or {}
    test_type = body.get("type", "ttest_1samp")
    try:
        def _arr(key):
            return np.array([x for x in body.get(key, []) if x is not None], dtype=float)

        if test_type == "ttest_1samp":
            arr = _arr("data"); arr = arr[np.isfinite(arr)]
            if len(arr) < 2: return jsonify({"error": "Need ≥2 data points"}), 400
            mu0 = float(body.get("mu0", 0))
            stat, pval = sp_stats.ttest_1samp(arr, mu0)
            ci = sp_stats.t.interval(0.95, df=len(arr)-1, loc=float(np.mean(arr)), scale=sp_stats.sem(arr))
            return jsonify({"test": "One-Sample t-Test", "statistic": float(stat), "p_value": float(pval),
                "df": int(len(arr)-1), "mean": float(np.mean(arr)), "mu0": mu0,
                "ci_95": [float(ci[0]), float(ci[1])], "n": int(len(arr)),
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        elif test_type == "ttest_2samp":
            a = _arr("data1"); a = a[np.isfinite(a)]
            b = _arr("data2"); b = b[np.isfinite(b)]
            if len(a) < 2 or len(b) < 2: return jsonify({"error": "Need ≥2 points per group"}), 400
            ev = bool(body.get("equal_var", False))
            stat, pval = sp_stats.ttest_ind(a, b, equal_var=ev)
            return jsonify({"test": "Two-Sample t-Test" + ("" if ev else " (Welch)"),
                "statistic": float(stat), "p_value": float(pval),
                "mean1": float(np.mean(a)), "mean2": float(np.mean(b)),
                "n1": int(len(a)), "n2": int(len(b)),
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        elif test_type == "ttest_paired":
            a = _arr("data1"); b = _arr("data2")
            n = min(len(a), len(b)); a, b = a[:n], b[:n]
            mask = np.isfinite(a) & np.isfinite(b); a, b = a[mask], b[mask]
            if len(a) < 2: return jsonify({"error": "Need ≥2 paired points"}), 400
            stat, pval = sp_stats.ttest_rel(a, b)
            return jsonify({"test": "Paired t-Test", "statistic": float(stat), "p_value": float(pval),
                "n_pairs": int(len(a)), "mean_diff": float(np.mean(a - b)),
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        elif test_type == "chi2":
            obs = np.array(body.get("observed", []), dtype=float)
            if len(obs) < 2: return jsonify({"error": "Need ≥2 observed frequencies"}), 400
            exp_raw = body.get("expected")
            if exp_raw:
                stat, pval = sp_stats.chisquare(obs, f_exp=np.array(exp_raw, dtype=float))
            else:
                stat, pval = sp_stats.chisquare(obs)
            return jsonify({"test": "Chi-Squared Goodness of Fit", "statistic": float(stat),
                "p_value": float(pval), "df": int(len(obs) - 1),
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        elif test_type == "anova":
            groups_raw = body.get("groups", [])
            groups = []
            for g_raw in groups_raw:
                g = np.array([x for x in g_raw if x is not None], dtype=float)
                g = g[np.isfinite(g)]
                if len(g) >= 2: groups.append(g)
            if len(groups) < 2: return jsonify({"error": "Need ≥2 groups with ≥2 points each"}), 400
            stat, pval = sp_stats.f_oneway(*groups)
            return jsonify({"test": "One-Way ANOVA", "statistic": float(stat), "p_value": float(pval),
                "n_groups": int(len(groups)),
                "group_means": [float(np.mean(g)) for g in groups],
                "group_ns": [int(len(g)) for g in groups],
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        elif test_type == "ks":
            a = _arr("data1"); a = a[np.isfinite(a)]
            b = _arr("data2"); b = b[np.isfinite(b)]
            if len(a) < 2 or len(b) < 2: return jsonify({"error": "Need ≥2 points per group"}), 400
            stat, pval = sp_stats.ks_2samp(a, b)
            return jsonify({"test": "Kolmogorov-Smirnov Test", "statistic": float(stat),
                "p_value": float(pval), "n1": int(len(a)), "n2": int(len(b)),
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        elif test_type == "mannwhitney":
            a = _arr("data1"); a = a[np.isfinite(a)]
            b = _arr("data2"); b = b[np.isfinite(b)]
            if len(a) < 2 or len(b) < 2: return jsonify({"error": "Need ≥2 points per group"}), 400
            stat, pval = sp_stats.mannwhitneyu(a, b, alternative='two-sided')
            return jsonify({"test": "Mann-Whitney U Test", "statistic": float(stat),
                "p_value": float(pval), "n1": int(len(a)), "n2": int(len(b)),
                "reject_05": bool(pval < 0.05), "reject_01": bool(pval < 0.01)})

        else:
            return jsonify({"error": f"Unknown test '{test_type}'"}), 400
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats/preprocess", methods=["POST"])
def stats_preprocess():
    body = request.get_json(silent=True) or {}
    op   = body.get("op", "normalize")
    raw  = body.get("data", [])
    try:
        if op in ("normalize", "standardize", "remove_outliers", "train_test_split"):
            arr = np.array([x for x in raw if x is not None], dtype=float)
            arr = arr[np.isfinite(arr)]
        else:
            arr = np.array([x if x is not None else np.nan for x in raw], dtype=float)

        if op == "normalize":
            mn, mx = float(arr.min()), float(arr.max()); rng = mx - mn
            out = ((arr - mn) / rng).tolist() if rng > 0 else [0.0] * len(arr)
            return jsonify({"result": out, "info": {"min": mn, "max": mx, "range": rng, "n": int(len(arr))}})

        elif op == "standardize":
            mu, sig = float(np.mean(arr)), float(np.std(arr, ddof=1))
            out = ((arr - mu) / sig).tolist() if sig > 0 else [0.0] * len(arr)
            return jsonify({"result": out, "info": {"mean": mu, "std": sig, "n": int(len(arr))}})

        elif op == "remove_outliers":
            method = body.get("method", "iqr")
            if method == "iqr":
                q1, q3 = np.percentile(arr, [25, 75]); iqr = q3 - q1
                lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            else:
                mu, sig = float(np.mean(arr)), float(np.std(arr, ddof=1))
                thr = float(body.get("z_threshold", 3.0))
                lo, hi = mu - thr * sig, mu + thr * sig
            mask = (arr >= lo) & (arr <= hi)
            return jsonify({"result": arr[mask].tolist(),
                "info": {"removed": int((~mask).sum()), "kept": int(mask.sum()),
                         "lo": float(lo), "hi": float(hi), "method": method}})

        elif op == "fill_missing":
            n_nan = int(np.isnan(arr).sum())
            finite = arr[np.isfinite(arr)]
            if not len(finite): return jsonify({"error": "No finite values"}), 400
            strategy = body.get("strategy", "mean")
            fv = {"mean": float(np.mean(finite)), "median": float(np.median(finite)),
                  "zero": 0.0, "min": float(finite.min()), "max": float(finite.max())}.get(strategy, float(np.mean(finite)))
            out = np.where(np.isnan(arr), fv, arr).tolist()
            return jsonify({"result": out,
                "info": {"fill_value": fv, "n_filled": n_nan, "strategy": strategy, "n_total": int(len(arr))}})

        elif op == "train_test_split":
            test_size = float(body.get("test_size", 0.2))
            seed = int(body.get("seed", 42))
            rng2 = np.random.default_rng(seed)
            n = len(arr); n_test = max(1, int(n * test_size))
            idx = rng2.permutation(n)
            return jsonify({"train": arr[idx[n_test:]].tolist(), "test": arr[idx[:n_test]].tolist(),
                "train_idx": idx[n_test:].tolist(), "test_idx": idx[:n_test].tolist(),
                "n_train": int(n - n_test), "n_test": int(n_test)})

        else:
            return jsonify({"error": f"Unknown op '{op}'"}), 400
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/stats/boxplot", methods=["POST"])
def stats_boxplot():
    body = request.get_json(silent=True) or {}
    datasets = body.get("datasets", {})
    result = {}
    for name, raw in datasets.items():
        arr = np.array([x for x in raw if x is not None], dtype=float)
        arr = arr[np.isfinite(arr)]
        if len(arr) < 2: continue
        q1, q3 = np.percentile(arr, [25, 75]); iqr = q3 - q1
        lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        wlo = float(arr[arr >= lo].min()) if (arr >= lo).any() else float(q1)
        whi = float(arr[arr <= hi].max()) if (arr <= hi).any() else float(q3)
        result[name] = {
            "min": float(arr.min()), "max": float(arr.max()),
            "q1": float(q1), "median": float(np.median(arr)), "q3": float(q3),
            "mean": float(np.mean(arr)), "whisker_lo": wlo, "whisker_hi": whi,
            "outliers": arr[(arr < lo) | (arr > hi)].tolist(), "n": int(len(arr)),
        }
    return jsonify({"boxplots": result})


if __name__ == "__main__":
    print("PlotForge backend  →  http://localhost:5001")
    app.run(debug=True, port=5001)