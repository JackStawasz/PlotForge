import numpy as np
from flask import Blueprint, jsonify, request

file_import_bp = Blueprint('file_import', __name__)


@file_import_bp.route("/api/unpickle", methods=["POST"])
def unpickle_file():
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
        if isinstance(val, (int, float, numbers.Number, np.integer, np.floating)):
            result[name] = {"kind": "constant", "value": float(val)}
        elif isinstance(val, np.ndarray):
            flat = val.flatten().tolist()
            result[name] = {"kind": "list", "items": [float(x) if not isinstance(x, str) else x for x in flat]}
        elif isinstance(val, (list, tuple)):
            try:
                items = [float(x) for x in val]
                result[name] = {"kind": "list", "items": items}
            except (TypeError, ValueError):
                continue
    if not result:
        return jsonify({"error": "No supported values found in dict (need floats or arrays)"}), 400
    return jsonify({"variables": result})
