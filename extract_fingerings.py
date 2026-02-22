# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "opencv-python",
#     "numpy",
# ]
# ///
"""
Extract sopilka fingerings from image.

Left tube (8 front holes) at y-offsets: 38, 54, 68, 82, 104, 118, 132, 146
Right tube (2 back holes) at y-offsets: 54, 118
(y-offset 6 in right tube is structural, not a hole)

Only 1 (closed) or 0 (open). No half-holes.
Upper row = C4-B4 (MIDI 60-71), Lower row = C5-B5 (MIDI 72-83)
"""
import cv2
import numpy as np
import json

IMG_PATH = "photo_2026-02-22 15.24.06.jpeg"

img = cv2.imread(IMG_PATH)
h, w = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

qr_y = int(h * 0.15)
qr_x = int(w * 0.75)
gray[0:qr_y, qr_x:w] = 255

_, binary = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY_INV)
contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

rects = []
for cnt in contours:
    x, y, bw, bh = cv2.boundingRect(cnt)
    aspect = bh / max(bw, 1)
    area = bw * bh
    if aspect > 2.5 and area > 1000 and bh > h * 0.1:
        rects.append((x, y, bw, bh))

rects.sort(key=lambda r: (r[1], r[0]))
row1 = sorted([r for r in rects if r[1] < h // 2], key=lambda r: r[0])
row2 = sorted([r for r in rects if r[1] >= h // 2], key=lambda r: r[0])

def group_pairs(tubes):
    pairs = []
    i = 0
    while i < len(tubes) - 1:
        t1 = tubes[i]
        t2 = tubes[i+1]
        gap = t2[0] - (t1[0] + t1[2])
        if gap < 30:
            pairs.append((t1, t2))
            i += 2
        else:
            i += 1
    return pairs

pairs1 = group_pairs(row1)
pairs2 = group_pairs(row2)

FRONT_HOLE_OFFSETS = [38, 54, 68, 82, 104, 118, 132, 146]
BACK_HOLE_OFFSETS = [54, 118]

def classify_hole(tube_rect, y_offset, radius=3):
    x, y, bw, bh = tube_rect
    cx = x + bw // 2
    cy = y + int(y_offset)
    patch = gray[cy-radius:cy+radius+1, cx-radius:cx+radius+1]
    if patch.size == 0:
        return 0, 255
    mean_val = np.mean(patch)
    # Simple threshold: < 128 = closed, >= 128 = open
    state = 1 if mean_val < 128 else 0
    return state, mean_val

def extract_fingering(pair):
    left_tube, right_tube = pair
    back = [classify_hole(right_tube, yo) for yo in BACK_HOLE_OFFSETS]
    front = [classify_hole(left_tube, yo) for yo in FRONT_HOLE_OFFSETS]
    return [s for s, _ in back] + [s for s, _ in front]

note_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
results = {}

print("ROW 1: C4-B4 (MIDI 60-71)")
for i, pair in enumerate(pairs1):
    midi = 60 + i
    f = extract_fingering(pair)
    results[midi] = f
    print(f"  [{midi}, {f}],  // {note_names[i]}4")

print("\nROW 2: C5-B5 (MIDI 72-83)")
for i, pair in enumerate(pairs2):
    midi = 72 + i
    f = extract_fingering(pair)
    results[midi] = f
    print(f"  [{midi}, {f}],  // {note_names[i]}5")

with open("fingerings_extracted.json", "w") as fp:
    json.dump({str(k): v for k, v in results.items()}, fp, indent=2)
print("\nSaved fingerings_extracted.json")
