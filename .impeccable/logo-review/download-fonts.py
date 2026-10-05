from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
import json
import re
import shutil

root = Path(__file__).resolve().parent
font_dir = root / 'fonts'
font_dir.mkdir(parents=True, exist_ok=True)
characters = '천하제일단타대회'
families = [
    ('noto', 'Noto Serif KR:wght@700', 'notoserifkr', 'Noto Serif KR', 700),
    ('nanum', 'Nanum Myeongjo:wght@800', 'nanummyeongjo', '나눔명조 ExtraBold', 800),
    ('black', 'Black Han Sans', 'blackhansans', 'Black Han Sans', 400),
]
headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'}
sources = []
for key, request_family, folder, label, weight in families:
    css_url = 'https://fonts.googleapis.com/css2?' + urlencode({'family': request_family, 'display': 'swap', 'text': characters})
    css = urlopen(Request(css_url, headers=headers), timeout=30).read().decode()
    matches = re.findall(r"url\((https://[^)]+)\)\s+format\(['\"]([^'\"]+)['\"]\)", css)
    if not matches:
        raise RuntimeError(f'No font URL: {label}')
    font_url, format_name = matches[-1]
    suffix = {'woff2': '.woff2', 'woff': '.woff', 'truetype': '.ttf'}[format_name]
    payload = urlopen(Request(font_url, headers=headers), timeout=30).read()
    destination = font_dir / (key + suffix)
    destination.write_bytes(payload)
    for obsolete_suffix in ['.ttf', '.woff', '.woff2']:
        obsolete = font_dir / (key + obsolete_suffix)
        if obsolete != destination and obsolete.exists():
            obsolete.unlink()
    (font_dir / (key + '.css-source.txt')).write_text(css)
    license_url = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/OFL.txt'
    license_text = urlopen(license_url, timeout=30).read().decode()
    (font_dir / (key + '.OFL.txt')).write_text(license_text)
    sources.append({'id': key, 'label': label, 'weight': weight, 'family': request_family, 'characters': characters, 'bytes': len(payload), 'format': format_name, 'file': 'fonts/' + destination.name, 'css_url': css_url, 'font_url': font_url, 'license_url': license_url, 'source': f'https://github.com/google/fonts/tree/main/ofl/{folder}'})
(root / 'font-sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2))
assets = root / 'assets'
assets.mkdir(exist_ok=True)
project = root.parent.parent
for key, filename in [('a', 'a-scoreboard-v2.png'), ('b', 'b-recordbook-v2.png'), ('c', 'c-studio-v2.png')]:
    shutil.copyfile(project / '.impeccable/mocks/decision' / filename, assets / (key + '-base.png'))
    shutil.copyfile(project / '.impeccable/mocks/decision' / (filename + '.json'), assets / (key + '-base.png.json'))
shutil.copyfile(project / 'public/icon.svg', assets / 'icon.svg')
print(json.dumps([{'font': entry['label'], 'bytes': entry['bytes'], 'file': entry['file'], 'format': entry['format']} for entry in sources], ensure_ascii=False))
