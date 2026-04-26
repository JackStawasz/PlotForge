import re
from flask import Blueprint, jsonify, request
from sympy.parsing.latex import parse_latex
from sympy import Symbol, latex as sym_latex, N, E, pi as SPI, oo

evaluate_bp = Blueprint('evaluate', __name__)

CONST_SUBS = [(Symbol('pi'), SPI), (Symbol('e'), E)]

# Maps JavaScript-parsed variable names to their LaTeX command form.
# JS strips the backslash when extracting names, so 'alpha' → '\alpha' etc.
GREEK_TO_LATEX = {
    'alpha': '\\alpha', 'beta': '\\beta', 'gamma': '\\gamma',
    'delta': '\\delta', 'varepsilon': '\\varepsilon', 'zeta': '\\zeta',
    'eta': '\\eta', 'vartheta': '\\vartheta', 'iota': '\\iota',
    'kappa': '\\kappa', 'lambda': '\\lambda', 'mu': '\\mu',
    'nu': '\\nu', 'xi': '\\xi', 'varpi': '\\varpi',
    'varrho': '\\varrho', 'varsigma': '\\varsigma', 'tau': '\\tau',
    'upsilon': '\\upsilon', 'varphi': '\\varphi',
    'chi': '\\chi', 'psi': '\\psi', 'omega': '\\omega',
    'hbar': '\\hbar', 'ell': '\\ell',
}


def _fmt_number(expr):
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


def _substitute_vars(expr_latex, ctx_syms):
    """Replace variable names in a LaTeX expression with their numeric values.

    Variable name conventions match what JavaScript sends:
      - single char: 'x' → matches bare x in LaTeX
      - subscripted: 'b_0' → matches b_{0} or b_0 in LaTeX
      - text name: 'myVar' → matches \\text{myVar} in LaTeX
      - Greek: 'alpha' → matches \\alpha in LaTeX
    Longest names are substituted first to avoid partial matches.
    """
    processed = expr_latex
    for nm, val in sorted(ctx_syms.items(), key=lambda x: -len(x[0])):
        val_str = f'({val})'

        if nm in GREEK_TO_LATEX:
            lat_cmd = re.escape(GREEK_TO_LATEX[nm])
            processed = re.sub(lat_cmd + r'(?![a-zA-Z])', val_str, processed)

        processed = re.sub(r'\\text\{' + re.escape(nm) + r'\}', val_str, processed)

        if '_' in nm:
            base, sub = nm.split('_', 1)
            pat = (r'(?<![a-zA-Z\\])' + re.escape(base) +
                   r'_(?:\{' + re.escape(sub) + r'\}|' + re.escape(sub) + r')(?![a-zA-Z0-9_])')
            processed = re.sub(pat, val_str, processed)
        elif len(nm) == 1:
            processed = re.sub(
                r'(?<![a-zA-Z\\])' + re.escape(nm) + r'(?![a-zA-Z_])',
                val_str, processed)

    return processed


def _eval_one(expr_latex, ctx_syms):
    if not expr_latex or not expr_latex.strip():
        return {'value': None, 'latex': '', 'is_numeric': False, 'error': 'empty'}

    from sympy import expand, cancel, Poly

    processed = _substitute_vars(expr_latex, ctx_syms)

    try:
        expr = parse_latex(processed)
    except Exception as exc:
        return {'value': None, 'latex': expr_latex, 'is_numeric': False, 'error': str(exc)}

    expr = expr.subs(CONST_SUBS)

    try:
        expr = cancel(expr)
    except Exception:
        pass
    try:
        expr = expand(expr)
    except Exception:
        pass

    free = expr.free_symbols
    if not free:
        fmt = _fmt_number(expr)
        if fmt['value'] is not None:
            return {'value': fmt['value'], 'latex': fmt['latex'], 'is_numeric': True, 'error': None}
        return {'value': None, 'latex': fmt['latex'], 'is_numeric': False, 'error': None}

    result_latex = None
    try:
        free_list = list(free)
        if len(free_list) == 1:
            p_obj = Poly(expr, free_list[0])
            result_latex = sym_latex(p_obj.as_expr())
    except Exception:
        pass
    if result_latex is None:
        result_latex = sym_latex(expr)

    return {'value': None, 'latex': result_latex, 'is_numeric': False, 'error': None}


@evaluate_bp.route("/api/evaluate", methods=["POST"])
def evaluate_variables():
    body = request.get_json(silent=True) or {}
    var_defs = body.get("variables", [])

    ctx = {}
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
