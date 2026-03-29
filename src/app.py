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

def render_matplotlib_multi(curves_data, view, labels, text_annotations=None):
    """
    curves_data: list of dicts with keys:
      x, y, is_discrete, line_color, line_width, line_style,
      marker, marker_size, fill_under, fill_alpha, label
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
        mpl_mk=None if mk=="none" else mk
        mpl_ls = "None" if ls=="none" else ls
        # Stroke-only markers (+, x, 1, 2, 3, 4) need edge color, not face color
        stroke_only_markers = {'+', 'x', '1', '2', '3', '4', '|', '_'}
        if mpl_mk in stroke_only_markers:
            mpl_markerfacecolor = 'none'
            mpl_markeredgecolor = rgb
            mpl_markeredgewidth = max(1.0, lw * 0.6)
        else:
            mpl_markerfacecolor = rgb
            mpl_markeredgecolor = 'none'
            mpl_markeredgewidth = 0
        try: rgb=_hex_to_rgb01(lc)
        except: rgb=(0.35,1.0,0.81)
        if is_d:
            ax.bar(x,y,color=rgb+(0.75,),width=0.6,zorder=3,label=lbl)
        elif lconn == "step":
            ax.step(x,y,where='pre',color=rgb,linewidth=lw,linestyle=mpl_ls,
                    marker=mpl_mk,markersize=ms,
                    markerfacecolor=mpl_markerfacecolor,
                    markeredgecolor=mpl_markeredgecolor,
                    markeredgewidth=mpl_markeredgewidth,
                    zorder=3,label=lbl)
            if fill: ax.fill_between(x,y,alpha=falp,color=rgb,step='pre',zorder=2)
        else:
            ax.plot(x,y,color=rgb,linewidth=lw,linestyle=mpl_ls,
                    marker=mpl_mk,markersize=ms,
                    markerfacecolor=mpl_markerfacecolor,
                    markeredgecolor=mpl_markeredgecolor,
                    markeredgewidth=mpl_markeredgewidth,
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
    """Accept a .pkl file upload, unpickle it, and return its contents as JSON.
    The pickle object must be a dict. Values that are numeric scalars become
    'constant' variables; array-like values become 'list' variables.
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
    if not curves_in and not body.get("template"):
        # Allow empty plot — render axes only
        curves_in = []
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

if __name__ == "__main__":
    print("PlotForge backend  →  http://localhost:5000")
    app.run(debug=True, port=5000)