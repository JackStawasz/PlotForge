import numpy as np
from flask import Blueprint, jsonify, request

stats_bp = Blueprint('stats', __name__)


@stats_bp.route("/api/stats/describe", methods=["POST"])
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


@stats_bp.route("/api/stats/histogram", methods=["POST"])
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


@stats_bp.route("/api/stats/fit", methods=["POST"])
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
    _fit_func = None
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


@stats_bp.route("/api/stats/correlation", methods=["POST"])
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


@stats_bp.route("/api/stats/test", methods=["POST"])
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


@stats_bp.route("/api/stats/preprocess", methods=["POST"])
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


@stats_bp.route("/api/stats/qqplot", methods=["POST"])
def stats_qqplot():
    from scipy import stats as spstats
    body = request.get_json(silent=True) or {}
    raw  = body.get("data", [])
    arr  = np.array([x for x in raw if x is not None], dtype=float)
    arr  = arr[np.isfinite(arr)]
    if len(arr) < 4:
        return jsonify({"error": "Need at least 4 finite values for a Q-Q plot."}), 400

    (theoretical, sample), (slope, intercept, _) = spstats.probplot(arr, dist="norm")
    theoretical = theoretical.tolist()
    sample      = sample.tolist()

    x0, x1 = float(theoretical[0]), float(theoretical[-1])
    line_y  = [slope * x0 + intercept, slope * x1 + intercept]

    sw_stat, sw_p = spstats.shapiro(arr[:5000])

    return jsonify({
        "theoretical": theoretical,
        "sample":      sample,
        "line_x":      [x0, x1],
        "line_y":      line_y,
        "sw_stat":     float(sw_stat),
        "sw_p":        float(sw_p),
        "n":           int(len(arr)),
    })


@stats_bp.route("/api/stats/boxplot", methods=["POST"])
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


@stats_bp.route("/api/stats/ml", methods=["POST"])
def stats_ml():
    try:
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
        from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
        from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
        from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
        from sklearn.svm import SVC, SVR
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA as skPCA
        from sklearn.model_selection import cross_val_score, StratifiedKFold, KFold
        from sklearn.metrics import (roc_curve, auc, precision_recall_curve,
                                     r2_score, mean_squared_error, accuracy_score,
                                     confusion_matrix, silhouette_score)
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        return jsonify({"error": "scikit-learn is required. Run: pip install scikit-learn"}), 400

    body         = request.get_json(silent=True) or {}
    model_type   = body.get("model", "random_forest")
    task         = body.get("task", "classification")
    X_raw        = body.get("X", [])
    y_raw        = body.get("y", [])
    n_estimators = int(body.get("n_estimators", 100))
    max_depth    = body.get("max_depth")
    if max_depth is not None: max_depth = int(max_depth)
    n_neighbors  = int(body.get("n_neighbors", 5))
    n_clusters   = int(body.get("n_clusters", 3))
    n_components = int(body.get("n_components", 2))
    cv_folds     = int(body.get("cv_folds", 5))

    if not X_raw:
        return jsonify({"error": "No feature data provided."}), 400

    try:
        X = np.column_stack([np.array(col, dtype=float) for col in X_raw])
        if X.ndim == 1: X = X.reshape(-1, 1)
    except Exception as e:
        return jsonify({"error": f"X data error: {e}"}), 400

    n, p = X.shape

    if model_type == "kmeans":
        k = min(n_clusters, n - 1)
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X)
        inertia = float(km.inertia_)
        sil = float(silhouette_score(X, labels)) if k > 1 and n > k + 1 else None
        max_k = min(10, n - 1)
        elbow = [float(KMeans(n_clusters=ki, random_state=42, n_init=10).fit(X).inertia_)
                 for ki in range(2, max_k + 1)]
        scaler2d = StandardScaler()
        Xs = scaler2d.fit_transform(X)
        pca2 = skPCA(n_components=min(2, p))
        X2 = pca2.fit_transform(Xs).tolist()
        return jsonify({
            "model": "kmeans", "n_clusters": k, "n": n, "p": p,
            "labels": labels.tolist(), "inertia": inertia, "silhouette": sil,
            "elbow_ks": list(range(2, max_k + 1)), "elbow_inertias": elbow,
            "scatter_2d": X2, "used_pca_for_viz": p > 2,
            "var_explained": pca2.explained_variance_ratio_.tolist() if p > 2 else None,
        })

    if model_type == "pca":
        scaler = StandardScaler()
        Xs = scaler.fit_transform(X)
        max_comp = min(p, n, 15)
        pca_full = skPCA(n_components=max_comp).fit(Xs)
        ev  = pca_full.explained_variance_ratio_.tolist()
        cumev = np.cumsum(pca_full.explained_variance_ratio_).tolist()
        nc  = min(n_components, max_comp)
        pca = skPCA(n_components=nc)
        scores   = pca.fit_transform(Xs).tolist()
        loadings = pca.components_.tolist()
        return jsonify({
            "model": "pca", "n": n, "p": p, "n_components": nc,
            "explained_variance_ratio": ev, "cumulative_variance": cumev,
            "scores": scores, "loadings": loadings,
        })

    if not y_raw:
        return jsonify({"error": "Target variable y required for supervised models."}), 400
    try:
        y = np.array(y_raw, dtype=float)
    except Exception as e:
        return jsonify({"error": f"y data error: {e}"}), 400
    if len(y) != n:
        return jsonify({"error": "X and y must have the same length."}), 400
    if n < 8:
        return jsonify({"error": "Need at least 8 observations."}), 400

    is_clf = (task == "classification")
    if is_clf:
        y_int = y.astype(int)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    use_scaled = model_type in ("svm", "knn")
    Xfit = X_scaled if use_scaled else X

    MODEL_MAP = {
        "decision_tree": (DecisionTreeClassifier(max_depth=max_depth, random_state=42),
                          DecisionTreeRegressor(max_depth=max_depth, random_state=42)),
        "random_forest": (RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth, random_state=42, n_jobs=-1),
                          RandomForestRegressor(n_estimators=n_estimators, max_depth=max_depth, random_state=42, n_jobs=-1)),
        "gradient_boosting": (GradientBoostingClassifier(n_estimators=n_estimators, max_depth=max_depth or 3, random_state=42),
                              GradientBoostingRegressor(n_estimators=n_estimators, max_depth=max_depth or 3, random_state=42)),
        "knn": (KNeighborsClassifier(n_neighbors=min(n_neighbors, n-1)),
                KNeighborsRegressor(n_neighbors=min(n_neighbors, n-1))),
        "svm": (SVC(probability=True, random_state=42), SVR()),
    }
    if model_type not in MODEL_MAP:
        return jsonify({"error": f"Unknown model: {model_type}"}), 400

    clf = MODEL_MAP[model_type][0 if is_clf else 1]

    if is_clf:
        clf.fit(Xfit, y_int)
        y_pred = clf.predict(Xfit)
        unique_y = np.unique(y_int)
        acc = float(accuracy_score(y_int, y_pred))
        cm  = confusion_matrix(y_int, y_pred).tolist()

        safe_k  = min(cv_folds, min(np.bincount(y_int.astype(int))))
        safe_k  = max(2, safe_k)
        cv      = StratifiedKFold(n_splits=safe_k, shuffle=True, random_state=42)
        cv_sc   = cross_val_score(clf, Xfit, y_int, cv=cv, scoring="accuracy").tolist()

        roc_data = None
        if len(unique_y) == 2 and hasattr(clf, "predict_proba"):
            proba = clf.predict_proba(Xfit)[:, 1]
            fpr, tpr, _ = roc_curve(y_int, proba)
            roc_auc = float(auc(fpr, tpr))
            pr_v, rec_v, _ = precision_recall_curve(y_int, proba)
            pr_auc = float(auc(rec_v, pr_v))
            roc_data = {
                "fpr": fpr.tolist(), "tpr": tpr.tolist(), "auc": roc_auc,
                "precision": pr_v.tolist(), "recall": rec_v.tolist(), "pr_auc": pr_auc,
            }

        feat_imp = (clf.feature_importances_.tolist()
                    if hasattr(clf, "feature_importances_") else None)
        return jsonify({
            "model": model_type, "task": "classification", "n": n, "p": p,
            "accuracy": acc, "confusion_matrix": cm, "classes": unique_y.tolist(),
            "cv_scores": cv_sc, "cv_mean": float(np.mean(cv_sc)), "cv_std": float(np.std(cv_sc)),
            "roc": roc_data, "feature_importance": feat_imp,
        })

    else:
        clf.fit(Xfit, y)
        y_pred = clf.predict(Xfit)
        r2   = float(r2_score(y, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
        cv   = KFold(n_splits=min(cv_folds, n // 4), shuffle=True, random_state=42)
        cv_sc = cross_val_score(clf, Xfit, y, cv=cv, scoring="r2").tolist()
        feat_imp = (clf.feature_importances_.tolist()
                    if hasattr(clf, "feature_importances_") else None)
        return jsonify({
            "model": model_type, "task": "regression", "n": n, "p": p,
            "r2": r2, "rmse": rmse,
            "residuals": (y - y_pred).tolist(),
            "y_pred": y_pred.tolist(), "y_orig": y.tolist(),
            "cv_scores": cv_sc, "cv_mean": float(np.mean(cv_sc)), "cv_std": float(np.std(cv_sc)),
            "feature_importance": feat_imp,
        })


@stats_bp.route("/api/stats/regression", methods=["POST"])
def stats_regression():
    from scipy.special import expit
    from scipy.optimize import minimize
    from scipy.stats import t as t_dist

    body  = request.get_json(silent=True) or {}
    rtype = body.get("type", "linear")
    X_raw = body.get("X", [])
    y_raw = body.get("y", [])

    if not X_raw or not y_raw:
        return jsonify({"error": "X (list of columns) and y are required."}), 400

    try:
        X = np.column_stack([np.array(col, dtype=float) for col in X_raw])
        y = np.array(y_raw, dtype=float)
    except Exception as e:
        return jsonify({"error": f"Data conversion failed: {e}"}), 400

    if X.ndim == 1:
        X = X.reshape(-1, 1)

    n, p = X.shape
    if n != len(y):
        return jsonify({"error": "X columns and y must have the same length."}), 400
    if n < 4:
        return jsonify({"error": "Need at least 4 observations."}), 400

    Xb = np.column_stack([np.ones(n), X])

    if rtype == "linear":
        coef, _, rank, _ = np.linalg.lstsq(Xb, y, rcond=None)
        y_pred    = Xb @ coef
        intercept = float(coef[0])
        betas     = coef[1:].tolist()
        ss_res    = float(np.sum((y - y_pred) ** 2))
        ss_tot    = float(np.sum((y - y.mean()) ** 2))
        r2        = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
        rmse      = float(np.sqrt(ss_res / n))

        coef_se = [None] * p; t_stats = [None] * p; p_values = [None] * p
        if n > p + 1 and rank == p + 1:
            try:
                sigma2 = ss_res / (n - p - 1)
                cov    = sigma2 * np.linalg.inv(Xb.T @ Xb)
                se_all = np.sqrt(np.diag(cov))
                coef_se  = se_all[1:].tolist()
                t_stats  = [float(b / s) if s > 0 else None for b, s in zip(betas, coef_se)]
                p_values = [float(2 * t_dist.sf(abs(t), df=n-p-1)) if t is not None else None for t in t_stats]
            except Exception:
                pass

        return jsonify({
            "type": "linear",
            "coef": betas, "intercept": intercept,
            "r2": r2, "rmse": rmse,
            "residuals": (y - y_pred).tolist(),
            "y_pred": y_pred.tolist(), "y_orig": y.tolist(),
            "coef_se": coef_se, "t_stats": t_stats, "p_values": p_values,
            "n": n, "p": p,
        })

    elif rtype == "logistic":
        threshold = float(body.get("threshold", 0.5))
        unique_y  = np.unique(y)
        if len(unique_y) != 2:
            return jsonify({"error": f"Logistic regression requires exactly 2 unique target values (found {len(unique_y)})."}), 400

        y_bin = (y == unique_y[1]).astype(float)

        def _nll(w):
            proba = np.clip(expit(Xb @ w), 1e-10, 1 - 1e-10)
            return -float(np.sum(y_bin * np.log(proba) + (1 - y_bin) * np.log(1 - proba)))

        def _grad(w):
            return Xb.T @ (expit(Xb @ w) - y_bin)

        result = minimize(_nll, np.zeros(p + 1), jac=_grad, method="L-BFGS-B",
                          options={"maxiter": 1000, "ftol": 1e-9})
        w         = result.x
        intercept = float(w[0])
        betas     = w[1:].tolist()
        proba     = expit(Xb @ w).tolist()
        y_pred_b  = (np.array(proba) >= threshold).astype(int)
        acc       = float(np.mean(y_pred_b == y_bin.astype(int)))

        tp = int(np.sum((y_pred_b == 1) & (y_bin == 1)))
        fp = int(np.sum((y_pred_b == 1) & (y_bin == 0)))
        fn = int(np.sum((y_pred_b == 0) & (y_bin == 1)))
        tn = int(np.sum((y_pred_b == 0) & (y_bin == 0)))
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        return jsonify({
            "type": "logistic",
            "coef": betas, "intercept": intercept,
            "accuracy": acc, "precision": precision, "recall": recall, "f1": f1,
            "y_proba": proba, "y_orig": y_bin.tolist(),
            "confusion_matrix": [[tn, fp], [fn, tp]],
            "classes": unique_y.tolist(), "threshold": threshold,
            "n": n, "p": p,
        })

    else:
        return jsonify({"error": f"Unknown regression type: {rtype}"}), 400
