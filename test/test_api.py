"""
test/test_api.py
=================
Backend API tests for PlotForge (Flask + NumPy + SymPy).

Routes under test:
  GET  /api/templates
  POST /api/data        (x/y data generation per template)
  POST /api/plot        (matplotlib PNG rendering)
  POST /api/evaluate    (SymPy variable evaluator)

Masking (_apply_mask) is exercised through /api/plot since /api/data
does not apply masks — it only generates raw x/y data.

Run from the project root:
    pytest test/test_api.py -v
"""
import base64
import pytest


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/templates
# ═══════════════════════════════════════════════════════════════════════════
class TestTemplates:

    def test_returns_200(self, client):
        r = client.get("/api/templates")
        assert r.status_code == 200

    def test_response_is_dict(self, client):
        data = client.get("/api/templates").get_json()
        assert isinstance(data, dict)

    def test_known_keys_present(self, client):
        data = client.get("/api/templates").get_json()
        expected = {"sin", "cos", "tan", "gaussian", "linear", "binomial", "poisson"}
        assert expected.issubset(data.keys()), f"Missing keys: {expected - data.keys()}"

    def test_each_entry_has_required_fields(self, client):
        data = client.get("/api/templates").get_json()
        for key, entry in data.items():
            assert "equation"  in entry, f"'{key}' missing 'equation'"
            assert "x_default" in entry, f"'{key}' missing 'x_default'"
            assert "params"    in entry, f"'{key}' missing 'params'"
            assert len(entry["x_default"]) == 2, f"'{key}' x_default wrong length"

    def test_not_empty(self, client):
        data = client.get("/api/templates").get_json()
        assert len(data) > 0


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/data  (x/y data generation)
# ═══════════════════════════════════════════════════════════════════════════
class TestData:

    def _data(self, client, template, params=None, view=None):
        body = {"template": template, "params": params or {}, "view": view or {}}
        r = client.post("/api/data", json=body)
        assert r.status_code == 200, f"/api/data failed for '{template}': {r.data}"
        return r.get_json()

    # ── Basic shape ────────────────────────────────────────────────────────
    def test_sin_returns_xy(self, client):
        data = self._data(client, "sin")
        assert "x" in data and "y" in data
        assert len(data["x"]) == len(data["y"])
        assert len(data["x"]) > 0

    def test_equation_field_present(self, client):
        data = self._data(client, "cos")
        assert "equation" in data
        assert len(data["equation"]) > 0

    def test_discrete_field_present(self, client):
        data = self._data(client, "sin")
        assert "discrete" in data

    # ── Discrete flag ──────────────────────────────────────────────────────
    @pytest.mark.parametrize("tkey", ["binomial", "poisson"])
    def test_discrete_templates(self, client, tkey):
        data = self._data(client, tkey)
        assert data.get("discrete") is True

    @pytest.mark.parametrize("tkey", ["sin", "cos", "gaussian", "linear"])
    def test_continuous_templates_not_discrete(self, client, tkey):
        data = self._data(client, tkey)
        assert data.get("discrete") is False

    # ── All templates: smoke tests ─────────────────────────────────────────
    CONTINUOUS_TEMPLATES = [
        "sin", "cos", "tan", "arcsin", "arccos", "arctan",
        "sinh", "cosh", "tanh", "arcsinh", "arccosh", "arctanh",
        "csc", "sec", "cot", "arccsc", "arcsec", "arccot",
        "csch", "sech", "coth", "arccsch", "arcsech", "arccoth",
        "gaussian", "lorentzian", "laplace", "linear",
        "hline", "vline", "logarithmic", "exponential", "nth_root",
        "reciprocal", "ceiling", "floor", "absolute", "legendre",
        "poly_custom", "factorial",
    ]

    @pytest.mark.parametrize("tkey", CONTINUOUS_TEMPLATES)
    def test_template_smoke(self, client, tkey):
        data = self._data(client, tkey)
        assert len(data["x"]) > 0
        assert len(data["x"]) == len(data["y"])

    # ── NaN / discontinuity handling ───────────────────────────────────────
    @pytest.mark.parametrize("tkey", ["tan", "csc", "sec", "cot"])
    def test_trig_discontinuous_functions_have_nulls(self, client, tkey):
        """Use a wide multi-period range to guarantee asymptotes are sampled."""
        data = self._data(client, tkey, view={"x_min": -10, "x_max": 10})
        assert None in data["y"], f"'{tkey}' should have null values near asymptotes"

    def test_reciprocal_has_nulls_near_zero(self, client):
        data = self._data(client, "reciprocal", view={"x_min": -5, "x_max": 5})
        assert None in data["y"], "reciprocal should have null values near x=0"

    # ── Domain clamping ────────────────────────────────────────────────────
    def test_arcsin_domain_clamped(self, client):
        data = self._data(client, "arcsin", view={"x_min": -5, "x_max": 5})
        assert all(-1 <= v <= 1 for v in data["x"]), "arcsin x values exceed [-1, 1]"

    def test_arctanh_domain_clamped(self, client):
        data = self._data(client, "arctanh", view={"x_min": -5, "x_max": 5})
        assert all(-1 < v < 1 for v in data["x"]), "arctanh x values outside (-1, 1)"

    def test_arcsech_domain_clamped(self, client):
        data = self._data(client, "arcsech", view={"x_min": -2, "x_max": 2})
        assert all(0 < v <= 1 for v in data["x"]), "arcsech x must be in (0, 1]"

    def test_arccosh_domain_clamped(self, client):
        data = self._data(client, "arccosh", view={"x_min": -5, "x_max": 5})
        assert all(v >= 1.0 for v in data["x"]), "arccosh x must be >= 1"

    # ── View override affects output range ─────────────────────────────────
    def test_view_xrange_respected(self, client):
        data = self._data(client, "linear", view={"x_min": 10, "x_max": 20})
        assert min(data["x"]) >= 9.9,  "x_min not respected"
        assert max(data["x"]) <= 20.1, "x_max not respected"

    # ── Params applied correctly ───────────────────────────────────────────
    def test_amplitude_param_applied(self, client):
        d1 = self._data(client, "sin", params={"A": 1})
        d2 = self._data(client, "sin", params={"A": 3})
        max1 = max(v for v in d1["y"] if v is not None)
        max2 = max(v for v in d2["y"] if v is not None)
        assert abs(max1 - 1) < 0.1, "A=1 should give max ~1"
        assert abs(max2 - 3) < 0.1, "A=3 should give max ~3"

    def test_linear_slope_param(self, client):
        data = self._data(client, "linear",
                          params={"m": 2, "b": 0},
                          view={"x_min": 0, "x_max": 10})
        for x, y in zip(data["x"][:10], data["y"][:10]):
            assert abs(y - 2 * x) < 0.01, f"linear(m=2, b=0) at x={x}: expected {2*x:.4f}, got {y:.4f}"

    def test_gaussian_peak_at_mu(self, client):
        mu = 3.0
        data = self._data(client, "gaussian",
                          params={"A": 1, "mu": mu, "sig": 1},
                          view={"x_min": -2, "x_max": 8})
        ys = data["y"]
        xs = data["x"]
        peak_idx = ys.index(max(v for v in ys if v is not None))
        assert abs(xs[peak_idx] - mu) < 0.2, f"Gaussian peak should be near mu={mu}, got x={xs[peak_idx]}"

    def test_vline_both_x_equal_c(self, client):
        data = self._data(client, "vline", params={"c": 5})
        assert data["x"][0] == data["x"][1] == 5, "vline x values should both equal c"

    def test_hline_y_is_constant(self, client):
        c = 7.0
        data = self._data(client, "hline", params={"c": c})
        for y in data["y"]:
            assert y == c, f"hline should have all y={c}, got {y}"

    def test_binomial_pmf_sums_to_one(self, client):
        data = self._data(client, "binomial", params={"n": 20, "p": 0.5})
        total = sum(v for v in data["y"] if v is not None)
        assert abs(total - 1.0) < 1e-6, f"Binomial PMF should sum to 1, got {total}"

    def test_poisson_pmf_sums_to_one(self, client):
        data = self._data(client, "poisson", params={"lam": 4})
        total = sum(v for v in data["y"] if v is not None)
        assert abs(total - 1.0) < 1e-4, f"Poisson PMF should sum to ~1, got {total}"

    # ── Error handling ─────────────────────────────────────────────────────
    def test_unknown_template_returns_400(self, client):
        r = client.post("/api/data",
                        json={"template": "totally_nonexistent", "params": {}, "view": {}})
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_missing_template_key_returns_400(self, client):
        r = client.post("/api/data", json={"params": {}, "view": {}})
        assert r.status_code == 400

    def test_none_template_returns_400(self, client):
        r = client.post("/api/data", json={"template": None, "params": {}, "view": {}})
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/plot  (matplotlib PNG rendering)
# ═══════════════════════════════════════════════════════════════════════════
class TestPlot:

    BASE_CURVE = {
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
    }

    def _plot(self, client, payload):
        r = client.post("/api/plot", json=payload)
        assert r.status_code == 200, f"/api/plot failed: {r.data}"
        return r.get_json()

    def _minimal_payload(self, curves=None):
        return {
            "curves": curves if curves is not None else [dict(self.BASE_CURVE)],
            "view": {},
            "labels": {"title": "", "xlabel": "", "ylabel": ""},
            "text_annotations": [],
        }

    # ── Core output ────────────────────────────────────────────────────────
    def test_returns_image_key(self, client):
        data = self._plot(client, self._minimal_payload())
        assert "image" in data

    def test_image_is_valid_base64_png(self, client):
        data = self._plot(client, self._minimal_payload())
        img_bytes = base64.b64decode(data["image"])
        assert img_bytes[:8] == b"\x89PNG\r\n\x1a\n", "image is not a valid PNG"

    def test_image_non_empty(self, client):
        data = self._plot(client, self._minimal_payload())
        assert len(data["image"]) > 1000, "PNG image suspiciously small"

    # ── Curve variants ─────────────────────────────────────────────────────
    def test_empty_curves_renders_axes_only(self, client):
        data = self._plot(client, self._minimal_payload(curves=[]))
        assert "image" in data

    def test_multi_curve_payload(self, client):
        cos_curve = dict(self.BASE_CURVE)
        cos_curve.update({"template": "cos", "line_color": "#ff6b6b", "label": "cos"})
        data = self._plot(client, self._minimal_payload(curves=[dict(self.BASE_CURVE), cos_curve]))
        assert "image" in data

    def test_raw_xy_curve(self, client):
        raw = {
            "x": [0, 1, 2, 3, 4],
            "y": [0, 1, 4, 9, 16],
            "line_color": "#aaffcc",
            "line_width": 2,
            "line_style": "solid",
            "line_connection": "linear",
            "marker": "none",
            "marker_size": 4,
            "fill_under": False,
            "fill_alpha": 0.15,
            "label": "x^2",
        }
        data = self._plot(client, self._minimal_payload(curves=[raw]))
        assert "image" in data

    # ── Labels ────────────────────────────────────────────────────────────
    def test_labels_applied(self, client):
        payload = self._minimal_payload()
        payload["labels"] = {"title": "Test Title", "xlabel": "X Axis", "ylabel": "Y Axis"}
        data = self._plot(client, payload)
        assert "image" in data

    # ── Text annotations ──────────────────────────────────────────────────
    def test_text_annotation_payload(self, client):
        payload = self._minimal_payload()
        payload["text_annotations"] = [{
            "text": "Peak", "x_frac": 0.5, "y_frac": 0.5,
            "font_size": 11, "color": "#ffffff",
        }]
        data = self._plot(client, payload)
        assert "image" in data

    # ── Masking (_apply_mask is called inside /api/plot per-curve) ─────────
    def test_mask_x_min_accepted(self, client):
        curve = dict(self.BASE_CURVE)
        curve["mask_x_min"] = 0.0
        data = self._plot(client, self._minimal_payload(curves=[curve]))
        assert "image" in data
        assert base64.b64decode(data["image"])[:8] == b"\x89PNG\r\n\x1a\n"

    def test_mask_x_max_accepted(self, client):
        curve = dict(self.BASE_CURVE)
        curve["mask_x_max"] = 0.0
        data = self._plot(client, self._minimal_payload(curves=[curve]))
        assert "image" in data

    def test_mask_y_bounds_accepted(self, client):
        curve = dict(self.BASE_CURVE)
        curve["mask_y_min"] = -0.5
        curve["mask_y_max"] = 0.5
        data = self._plot(client, self._minimal_payload(curves=[curve]))
        assert "image" in data

    # ── View options ──────────────────────────────────────────────────────
    def test_log_scale_x_view(self, client):
        payload = self._minimal_payload()
        payload["view"] = {"x_log": True, "x_min": 0.1, "x_max": 100}
        data = self._plot(client, payload)
        assert "image" in data

    def test_custom_bg_color(self, client):
        payload = self._minimal_payload()
        payload["view"] = {"bg_color": "#000000", "surface_color": "#111111"}
        data = self._plot(client, payload)
        assert "image" in data

    def test_fill_under_curve(self, client):
        curve = dict(self.BASE_CURVE)
        curve["fill_under"] = True
        curve["fill_alpha"] = 0.3
        data = self._plot(client, self._minimal_payload(curves=[curve]))
        assert "image" in data

    def test_dashed_line_style(self, client):
        curve = dict(self.BASE_CURVE)
        curve["line_style"] = "dashed"
        data = self._plot(client, self._minimal_payload(curves=[curve]))
        assert "image" in data

    def test_marker_dots(self, client):
        curve = dict(self.BASE_CURVE)
        curve["marker"] = "o"
        data = self._plot(client, self._minimal_payload(curves=[curve]))
        assert "image" in data


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/evaluate  (SymPy variable evaluator)
# ═══════════════════════════════════════════════════════════════════════════
class TestEvaluate:

    def _eval(self, client, *var_dicts):
        body = {"variables": list(var_dicts)}
        r = client.post("/api/evaluate", json=body)
        assert r.status_code == 200, f"/api/evaluate failed: {r.data}"
        return r.get_json()["results"]

    def _var(self, vid, name, expr, kind="variable"):
        return {"id": vid, "name": name, "expr_latex": expr, "kind": kind}

    # ── Math constants ─────────────────────────────────────────────────────
    def test_pi_evaluates(self, client):
        import math
        r = self._eval(client, self._var(1, "x", r"\pi"))[0]
        assert r["is_numeric"] is True
        assert abs(r["value"] - math.pi) < 1e-6

    def test_euler_e_evaluates(self, client):
        import math
        r = self._eval(client, self._var(1, "x", "e"))[0]
        assert r["is_numeric"] is True
        assert abs(r["value"] - math.e) < 1e-6

    # ── Arithmetic ─────────────────────────────────────────────────────────
    def test_integer_addition(self, client):
        assert self._eval(client, self._var(1, "x", "2+3"))[0]["value"] == 5

    def test_subtraction(self, client):
        assert self._eval(client, self._var(1, "x", "10-4"))[0]["value"] == 6

    def test_multiplication(self, client):
        assert self._eval(client, self._var(1, "x", "3*4"))[0]["value"] == 12

    def test_fraction(self, client):
        r = self._eval(client, self._var(1, "x", r"\frac{1}{4}"))[0]
        assert abs(r["value"] - 0.25) < 1e-9

    def test_fraction_three_quarters(self, client):
        r = self._eval(client, self._var(1, "x", r"\frac{3}{4}"))[0]
        assert abs(r["value"] - 0.75) < 1e-9

    def test_exponentiation(self, client):
        assert self._eval(client, self._var(1, "x", "2^{3}"))[0]["value"] == 8

    def test_square_root(self, client):
        r = self._eval(client, self._var(1, "x", r"\sqrt{9}"))[0]
        assert abs(r["value"] - 3.0) < 1e-9

    # ── Trig / transcendental ──────────────────────────────────────────────
    def test_sin_zero(self, client):
        r = self._eval(client, self._var(1, "x", r"\sin(0)"))[0]
        assert abs(r["value"]) < 1e-9

    def test_cos_zero_is_one(self, client):
        r = self._eval(client, self._var(1, "x", r"\cos(0)"))[0]
        assert abs(r["value"] - 1.0) < 1e-9

    def test_ln_one_is_zero(self, client):
        r = self._eval(client, self._var(1, "x", r"\ln(1)"))[0]
        assert abs(r["value"]) < 1e-9

    def test_sin_pi_is_zero(self, client):
        r = self._eval(client, self._var(1, "x", r"\sin(\pi)"))[0]
        assert r["is_numeric"] is True
        assert abs(r["value"]) < 1e-9

    # ── Parameter kind ─────────────────────────────────────────────────────
    def test_parameter_numeric(self, client):
        r = self._eval(client, self._var(1, "k", "3.5", kind="parameter"))[0]
        assert r["is_numeric"] is True
        assert abs(r["value"] - 3.5) < 1e-9

    def test_parameter_negative(self, client):
        r = self._eval(client, self._var(1, "k", "-2", kind="parameter"))[0]
        assert r["is_numeric"] is True
        assert r["value"] == -2

    def test_parameter_non_numeric_returns_error(self, client):
        r = self._eval(client, self._var(1, "k", "abc", kind="parameter"))[0]
        assert r["is_numeric"] is False
        assert r["error"] is not None

    # ── Chained variable resolution ────────────────────────────────────────
    def test_two_chained_variables(self, client):
        results = self._eval(client,
            self._var(1, "a", "4"),
            self._var(2, "b", "a + 6"),
        )
        assert results[0]["value"] == 4
        assert results[1]["value"] == 10

    def test_three_level_chain(self, client):
        results = self._eval(client,
            self._var(1, "a", "2"),
            self._var(2, "b", "a * 3"),
            self._var(3, "c", "b + 1"),
        )
        assert results[2]["value"] == 7

    def test_parameter_feeds_variable(self, client):
        results = self._eval(client,
            self._var(1, "n", "5", kind="parameter"),
            self._var(2, "y", "n^{2}"),
        )
        assert results[1]["value"] == 25

    def test_chain_with_pi(self, client):
        import math
        results = self._eval(client,
            self._var(1, "r", "2"),
            self._var(2, "area", r"\pi r^{2}"),
        )
        assert results[1]["is_numeric"] is True
        assert abs(results[1]["value"] - math.pi * 4) < 1e-4

    # ── Unknown symbols ────────────────────────────────────────────────────
    def test_unknown_symbol_not_numeric(self, client):
        r = self._eval(client, self._var(1, "", "a + b"))[0]
        assert r["is_numeric"] is False
        assert r["error"] is None

    def test_single_unknown_var(self, client):
        r = self._eval(client, self._var(1, "", "z"))[0]
        assert r["is_numeric"] is False

    # ── Malformed LaTeX ────────────────────────────────────────────────────
    def test_malformed_latex_has_error(self, client):
        r = self._eval(client, self._var(1, "x", r"\frac{{{"))[0]
        assert r["error"] is not None

    def test_empty_expression(self, client):
        r = self._eval(client, self._var(1, "x", ""))[0]
        assert r["is_numeric"] is False

    def test_whitespace_only_expression(self, client):
        r = self._eval(client, self._var(1, "x", "   "))[0]
        assert r["is_numeric"] is False

    # ── id echoing ─────────────────────────────────────────────────────────
    def test_id_echoed_in_results(self, client):
        results = self._eval(client,
            self._var(42, "x", "1"),
            self._var(99, "y", "2"),
        )
        assert results[0]["id"] == 42
        assert results[1]["id"] == 99

    # ── Edge cases ─────────────────────────────────────────────────────────
    def test_empty_variables_list(self, client):
        r = client.post("/api/evaluate", json={"variables": []})
        assert r.status_code == 200
        assert r.get_json()["results"] == []

    def test_large_integer_value(self, client):
        r = self._eval(client, self._var(1, "x", "1000000"))[0]
        assert r["value"] == 1_000_000

    def test_negative_value(self, client):
        r = self._eval(client, self._var(1, "x", "-7"))[0]
        assert r["value"] == -7

    def test_decimal_value(self, client):
        r = self._eval(client, self._var(1, "x", "3.14"))[0]
        assert abs(r["value"] - 3.14) < 1e-6

    def test_result_has_latex_field(self, client):
        r = self._eval(client, self._var(1, "x", "4"))[0]
        assert "latex" in r