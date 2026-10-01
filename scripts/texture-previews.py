"""Regenerate bundled shelf previews: python scripts/texture-previews.py (Pillow required).

These previews only affect the shelf. Original texture files are never changed.
The build checks source hashes and falls back to a resized decode for new assets.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / "assets" / "grunge"
items = {}
for source in sorted(root.glob("*.webp")):
    with Image.open(source) as image:
        image = image.convert("RGBA").resize((96, 96), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        image.save(output, "WEBP", quality=85, method=6)
    items[source.stem] = {
        "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "image": "data:image/webp;base64," + base64.b64encode(output.getvalue()).decode("ascii"),
    }
(root / "previews.json").write_text(json.dumps({"size": 96, "items": items}, indent=2) + "\n", encoding="utf-8")
print(f"Saved {len(items)} shelf previews.")
