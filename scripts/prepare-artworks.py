"""Create color-managed display assets without changing the supplied originals.

Usage: python3 scripts/prepare-artworks.py '/path/to/熙歌三周年畫展'
Requires Pillow (including WebP and ImageCms) and ffmpeg.
"""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).expanduser().resolve()
LAYOUT = json.loads((ROOT / 'blender/artwork-layout.json').read_text())
DISPLAY = ROOT / 'public/artworks'
TEXTURES = ROOT / 'blender/textures'
TEXTURES.mkdir(exist_ok=True)
SRGB = ImageCms.createProfile('sRGB')


def srgb_image(path):
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        size = image.size
        mode = image.mode
        profile = image.info.get('icc_profile')
        alpha = image.getchannel('A') if image.mode == 'RGBA' else None
        if profile:
            image = ImageCms.profileToProfile(
                image.convert('RGB') if alpha else image,
                ImageCms.ImageCmsProfile(io.BytesIO(profile)), SRGB, outputMode='RGB',
            )
        else:
            image = image.convert('RGB')
        if alpha:
            background = Image.new('RGB', image.size, 'white')
            background.paste(image, mask=alpha)
            image = background
        return image, size, mode, bool(profile)


metadata = {}
for art in LAYOUT['artworks']:
    if art['imageKind'] != 'original-artwork':
        continue
    source = SOURCE / art['sourceFile']
    image, size, mode, profile = srgb_image(source)
    image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    image.save(ROOT / 'public' / art['image'], 'WEBP', quality=92, method=6)
    display_size = image.size
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    image.save(TEXTURES / f"{art['key']}.jpg", quality=90, subsampling=0, optimize=True)
    metadata[art['key']] = {
        'sourceFile': art['sourceFile'],
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceSize': size, 'sourceMode': mode, 'convertedICC': profile,
        'displaySize': display_size, 'modelSize': image.size,
        'modelImage': f"textures/{art['key']}.jpg",
    }

# Keep the photographic reference intact; the model selects its quadrilateral.
image, *_ = srgb_image(ROOT / 'refs/IMG_9426.jpg')
image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
image.save(DISPLAY / 'guestbook-reference.jpg', quality=93, subsampling=0)
video = next((ROOT / 'refs').glob('*1992869251154386944*.mp4'))
subprocess.run([
    'ffmpeg', '-v', 'error', '-y', '-ss', '42', '-i', str(video),
    '-frames:v', '1', '-q:v', '2', str(DISPLAY / 'service-reference.jpg'),
], check=True)
for art in LAYOUT['artworks']:
    if art['imageKind'] == 'reference-photo':
        metadata[art['key']] = {'modelImage': '../public/' + art['image']}

(ROOT / 'blender/artwork-assets.json').write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2) + '\n',
)
print(f'Prepared {len(metadata) - 2} original artworks and 2 photographic backdrops.')
