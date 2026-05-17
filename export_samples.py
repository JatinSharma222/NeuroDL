"""
export_samples.py
─────────────────
Picks 15 representative sample images from your test dataset
and copies them into the Next.js public folder.

Selects images that are:
  - Clearly centred in the frame
  - Good contrast (not too dark/bright)
  - Representative of each class

Distribution: 4 glioma + 4 meningioma + 4 pituitary + 3 notumor = 15

RUN:
  python export_samples.py

OUTPUTS:
  frontend/public/sample_g1.jpg  ... sample_g4.jpg   (glioma)
  frontend/public/sample_m1.jpg  ... sample_m4.jpg   (meningioma)
  frontend/public/sample_p1.jpg  ... sample_p4.jpg   (pituitary)
  frontend/public/sample_n1.jpg  ... sample_n3.jpg   (no tumor)

  Also prints the updated SAMPLE_IMAGES array for ImageUploader.jsx
"""

import os
import shutil
import numpy as np
from PIL import Image

# ─── Config ───────────────────────────────────────────────────────────────────

TEST_DIR    = 'data/raw_dataset/Testing'
PUBLIC_DIR  = 'frontend/public'           # adjust if your frontend is elsewhere

PICKS = {
    'glioma':     4,
    'meningioma': 4,
    'pituitary':  4,
    'notumor':    3,
}

PREFIX = {
    'glioma':     'sample_g',
    'meningioma': 'sample_m',
    'pituitary':  'sample_p',
    'notumor':    'sample_n',
}

os.makedirs(PUBLIC_DIR, exist_ok=True)


# ─── Image quality scorer ─────────────────────────────────────────────────────

def score_image(path: str) -> float:
    """
    Score an image on how suitable it is as a sample.

    Higher = better sample. Criteria:
      - Mean brightness close to 0.35 (well-lit MRI, not overexposed)
      - High standard deviation (good contrast, visible structures)
      - Content in the centre (not just black borders)
    """
    try:
        img = Image.open(path).convert('L').resize((128, 128))
        arr = np.array(img, dtype=np.float32) / 255.0

        mean   = arr.mean()
        std    = arr.std()
        centre = arr[32:96, 32:96].mean()   # centre 50% of image

        # Penalise very dark or very bright images
        brightness_score = 1.0 - abs(mean - 0.35) * 2
        contrast_score   = std * 3
        centre_score     = centre * 1.5     # should have content in centre

        return brightness_score + contrast_score + centre_score
    except Exception:
        return -1.0


# ─── Main ─────────────────────────────────────────────────────────────────────

all_names = []   # collect for ImageUploader.jsx output

for class_name, n_picks in PICKS.items():
    class_dir = os.path.join(TEST_DIR, class_name)
    if not os.path.isdir(class_dir):
        # Try capitalised version
        for d in os.listdir(TEST_DIR):
            if d.lower() == class_name.lower():
                class_dir = os.path.join(TEST_DIR, d)
                break

    if not os.path.isdir(class_dir):
        print(f"⚠  Could not find class dir for '{class_name}', skipping")
        continue

    # Get all jpg/jpeg/png files
    files = [
        f for f in os.listdir(class_dir)
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
    ]

    if not files:
        print(f"⚠  No images found in {class_dir}")
        continue

    # Score all files, take top n_picks
    print(f"\n[{class_name}] Scoring {len(files)} images...")
    scored = []
    for f in files:
        path  = os.path.join(class_dir, f)
        score = score_image(path)
        scored.append((score, f))

    scored.sort(key=lambda x: x[0], reverse=True)
    chosen = scored[:n_picks]

    prefix = PREFIX[class_name]
    for idx, (score, fname) in enumerate(chosen, start=1):
        src  = os.path.join(class_dir, fname)
        dest_name = f"{prefix}{idx}.jpg"
        dest = os.path.join(PUBLIC_DIR, dest_name)

        # Open, convert to RGB JPEG (handles PNG, RGBA, etc.)
        img = Image.open(src).convert('RGB')
        img.save(dest, format='JPEG', quality=92)

        all_names.append(f"/{dest_name}")
        print(f"  ✓ {fname}  (score={score:.3f})  →  {dest_name}")

# ─── Print ImageUploader.jsx array ────────────────────────────────────────────

print("\n" + "=" * 60)
print("DONE — update SAMPLE_IMAGES in ImageUploader.jsx:")
print("=" * 60)
print("\nconst SAMPLE_IMAGES = [")
for i, name in enumerate(all_names):
    comma = "," if i < len(all_names) - 1 else ""
    print(f'  "{name}"{comma}')
print("];")
print()
print(f"Total: {len(all_names)} images copied to {PUBLIC_DIR}/")
print("=" * 60)
