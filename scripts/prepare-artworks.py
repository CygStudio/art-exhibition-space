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
import tempfile

from PIL import Image, ImageCms, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).expanduser().resolve()
LAYOUT = json.loads((ROOT / 'blender/artwork-layout.json').read_text())
DISPLAY = ROOT / 'public/artworks'
TEXTURES = ROOT / 'blender/textures'
TEXTURES.mkdir(exist_ok=True)
PREVIEWS = ROOT / 'blender/previews'
PREVIEWS.mkdir(exist_ok=True)
SCENE = DISPLAY / 'scene'
THUMBS = DISPLAY / 'thumbnails'
for directory in [SCENE, THUMBS]:
    directory.mkdir(exist_ok=True)
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


def variant(image, directory, key, edge, quality, fmt='WEBP'):
    resized = image.copy()
    resized.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    options = {'subsampling': 0, 'optimize': True} if fmt == 'JPEG' else {'method': 6}
    resized.save(output, fmt, quality=quality, **options)
    content = output.getvalue()
    suffix = 'jpg' if fmt == 'JPEG' else 'webp'
    name = f'{key}.{hashlib.sha256(content).hexdigest()[:12]}.{suffix}'
    (directory / name).write_bytes(content)
    return str((directory / name).relative_to(ROOT / 'public'))


def tiers(image, key):
    # Saturated, very fine red lines benefit from JPEG's 4:4:4 color sampling.
    fmt = 'JPEG' if key == 'lllokkk-portrait' else 'WEBP'
    quality = 90 if key in ['lllokkk-portrait', 'lllokkk-landscape', 'kakult-portrait', 'kakult-landscape'] else 88
    scene = variant(image, SCENE, key, 1024, quality, fmt)
    thumb = variant(image, THUMBS, key, 320, 82)
    preview = image.copy()
    preview.thumbnail((128, 128), Image.Resampling.LANCZOS)
    preview.save(PREVIEWS / f'{key}.jpg', quality=72, optimize=True)
    return {'sceneImage': scene, 'thumbnailImage': thumb, 'previewImage': f'previews/{key}.jpg'}


metadata = {}
for art in LAYOUT['artworks']:
    if art['imageKind'] != 'original-artwork':
        continue
    source = SOURCE / art['sourceFile']
    image, size, mode, profile = srgb_image(source)
    image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    image.save(ROOT / 'public' / art['image'], 'WEBP', quality=92, method=6)
    display_size = image.size
    variants = tiers(image, art['key'])
    image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    image.save(TEXTURES / f"{art['key']}.jpg", quality=90, subsampling=0, optimize=True)
    metadata[art['key']] = {
        'sourceFile': art['sourceFile'],
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceSize': size, 'sourceMode': mode, 'convertedICC': profile,
        'displaySize': display_size, 'modelSize': image.size,
        'modelImage': f"textures/{art['key']}.jpg",
        **variants,
    }

# The vector source is rendered once for the editable Blender material.
# Rebuild with: node scripts/render-flag.mjs (requires sharp).
image = Image.open(TEXTURES / 'guestbook-flag.png').convert('RGB')
metadata['guestbook-flag'] = {
    'modelImage': 'textures/guestbook-flag.png', **tiers(image, 'guestbook-flag'),
    'sceneImage': 'artworks/guestbook-flag.svg',
}
video = next((ROOT / 'refs').glob('*1992869251154386944*.mp4'))
with tempfile.TemporaryDirectory() as temporary:
    frame = Path(temporary) / 'backdrop.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '42', '-i', str(video), '-frames:v', '1', str(frame)], check=True)
    image = Image.open(frame).convert('RGB')
    w, h = image.size
    # Source corners: top-left, bottom-left, bottom-right, top-right.
    quad = [.06015625*w, .1375*h, .075*w, .7666666667*h, .909375*w, .8611111111*h, .921875*w, .0861111111*h]
    image = image.transform((1024, 524), Image.Transform.QUAD, quad, Image.Resampling.BICUBIC)
    image.save(TEXTURES / 'service-backdrop.jpg', quality=93, subsampling=0)
    image.save(DISPLAY / 'service-backdrop.webp', quality=90, method=6)
    metadata['service-backdrop'] = {'modelImage': 'textures/service-backdrop.jpg', **tiers(image, 'service-backdrop')}

# Prune only generated variants; original artwork files are never modified.
used = {entry[field] for entry in metadata.values() for field in ['sceneImage', 'thumbnailImage']}
for directory in [SCENE, THUMBS]:
    for path in directory.iterdir():
        if str(path.relative_to(ROOT / 'public')) not in used:
            path.unlink()

(ROOT / 'blender/artwork-assets.json').write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2) + '\n',
)
print(f'Prepared {len(metadata) - 2} original artworks, 1 vector flag and 1 photographic backdrop.')
