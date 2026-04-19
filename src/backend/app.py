import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matplotlib
matplotlib.use("Agg")

from flask import Flask, send_from_directory
from flask_cors import CORS

from plot import plot_bp
from file_import import file_import_bp
from evaluate import evaluate_bp
from stats import stats_bp

app = Flask(__name__, static_folder='..', static_url_path='')
CORS(app)

app.register_blueprint(plot_bp)
app.register_blueprint(file_import_bp)
app.register_blueprint(evaluate_bp)
app.register_blueprint(stats_bp)


@app.route('/')
def index():
    return send_from_directory('..', 'index.html')


if __name__ == "__main__":
    print("PlotForge backend  →  http://localhost:5001")
    app.run(debug=True, port=5001)
