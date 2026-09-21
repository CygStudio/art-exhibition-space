"""Extract only the photographed tabletop prints; no invented artwork content."""
from pathlib import Path
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def extract(image, name, corners, size):
    # Pillow QUAD order is top-left, bottom-left, bottom-right, top-right.
    result = image.transform(size, Image.Transform.QUAD, corners, Image.Resampling.BICUBIC)
    result.save(ROOT / 'blender/textures' / name, quality=85, optimize=True)

video = next((ROOT / 'refs').glob('*2000192052148269057*.mp4'))
with tempfile.TemporaryDirectory() as temporary:
    frame = Path(temporary) / 'desk.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '34', '-i', str(video), '-frames:v', '1', str(frame)], check=True)
    image = Image.open(frame).convert('RGB')
    # Reference video is 720 × 1280; normalize for alternate source encodes.
    sx, sy = image.width / 720, image.height / 1280
    def quad(points): return [value * (sx if i % 2 == 0 else sy) for i, value in enumerate(points)]
    extract(image, 'desk-landscape.jpg', quad([67,642, 49,724, 200,732, 220,639]), (192,104))
    extract(image, 'desk-portrait.jpg', quad([280,654, 267,744, 351,754, 365,655]), (144,170))

image = Image.open(ROOT / 'refs/IMG_9426.jpg').convert('RGB')
sx, sy = image.width / 2048, image.height / 1152
corners = [1459,507, 1450,639, 1630,658, 1637,508]
extract(image, 'desk-top-print.jpg', [v * (sx if i % 2 == 0 else sy) for i,v in enumerate(corners)], (192,144))
