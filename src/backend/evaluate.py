import re
import numpy as np
from flask import Blueprint, jsonify, request
from sympy.parsing.latex import parse_latex
from sympy import (Symbol, latex as sym_latex, N, simplify,
                   E, pi as SPI, oo, Integer, Rational)

evaluate_bp = Blueprint('evaluate', __name__)

CONST_SUBS = [(Symbol('pi'), SPI), (Symbol('e'), E)]

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


def _eval_one(expr_latex, ctx_syms):
    if not expr_latex or not expr_latex.strip():
        return {'value': None, 'latex': '', 'is_numeric': False, 'error': 'empty'}

    from sympy import (expand, factor, cancel, Poly, degree,
                       Symbol as Sym, latex as sym_latex)
    from sympy.abc import x as _x

    all_names = list(ctx_syms.keys())
    text_names_in_expr = re.findall(r'\\text\{([^}]+)\}', expr_latex)
    for tn in text_names_in_expr:
        if tn not in all_names:
            all_names.append(tn)

    name_enc = {}
    pool_idx = 0
    for nm in sorted(all_names, key=len, reverse=True):
        if pool_idx >= len(POOL):
            break
        name_enc[nm] = POOL[pool_idx]
        pool_idx += 1

    processed = expr_latex

    def _sub_text(m):
        nm = m.group(1)
        if nm in name_enc:
            return name_enc[nm][0]
        return re.sub(r'[^a-zA-Z0-9]', '', nm) or 'z'
    processed = re.sub(r'\\text\{([^}]+)\}', _sub_text, processed)

    for nm, (lat_ph, _) in sorted(name_enc.items(), key=lambda x: -len(x[0])):
        if '_' in nm:
            base, sub = nm.split('_', 1)
            pat = r'(?<![a-zA-Z\\])' + re.escape(base) + r'_(?:\{' + re.escape(sub) + r'\}|' + re.escape(sub) + r')(?![a-zA-Z0-9_])'
            _repl = lat_ph
            processed = re.sub(pat, lambda m, r=_repl: r, processed)

    for nm, (lat_ph, _) in sorted(name_enc.items(), key=lambda x: -len(x[0])):
        if '_' not in nm and len(nm) == 1:
            _repl = lat_ph
            processed = re.sub(r'(?<![a-zA-Z\\])' + re.escape(nm) + r'(?![a-zA-Z_])', lambda m, r=_repl: r, processed)

    try:
        expr = parse_latex(processed)
    except Exception as exc:
        return {'value': None, 'latex': expr_latex, 'is_numeric': False, 'error': str(exc)}

    expr = expr.subs(CONST_SUBS)

    for nm, val in ctx_syms.items():
        if nm in name_enc:
            ph_sym = Sym(name_enc[nm][1])
            expr = expr.subs(ph_sym, val)

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

    for nm, (lat_ph, sym_ph) in name_enc.items():
        if '_' in nm:
            base, sub = nm.split('_', 1)
            display_latex = f'{base}_{{{sub}}}'
        elif len(nm) > 1:
            display_latex = f'\\text{{{nm}}}'
        else:
            display_latex = nm
        ph_escaped = re.escape(lat_ph)
        result_latex = re.sub(ph_escaped + r'(?![a-zA-Z])', display_latex, result_latex)

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
