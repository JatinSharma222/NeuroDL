"""
Quick fix script — regenerates model_performance.json with Infinity values sanitized.
Run this if you don't want to re-run the full evaluate_models.py (which takes minutes).
"""
import json
import numpy as np

json_path = "training_outputs/evaluation/model_performance.json"

with open(json_path, "r") as f:
    content = f.read()

# Replace bare Infinity / -Infinity tokens with large finite numbers
# (Python's json module writes these as bare words, which breaks JS JSON.parse)
content = content.replace("Infinity", "1e308").replace("-1e308", "-1e308")
# Handle NaN too, just in case
content = content.replace("NaN", "0")

data = json.loads(content)  # verify it's now valid

with open(json_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"✓ Fixed and re-saved: {json_path}")