"""Rebuild LYRIA's bundled Unicode emoji data. No application dependencies."""
from pathlib import Path
import json
import re
import urllib.request

VERSION = '16.0'
SOURCE = f'https://www.unicode.org/Public/emoji/{VERSION}/emoji-test.txt'
ROOT = Path(__file__).resolve().parents[1]

def main():
    text = urllib.request.urlopen(SOURCE, timeout=30).read().decode('utf-8')
    groups, emojis, group = [], [], ''
    for line in text.splitlines():
        if line.startswith('# group: '):
            group = line[len('# group: '):]
            groups.append(group)
        elif '; fully-qualified' in line:
            codepoints = line.split(';')[0].split()
            name = re.split(r' E[0-9.]+ ', line.split('#', 1)[1], maxsplit=1)[1].strip()
            emojis.append({'emoji': ''.join(chr(int(value, 16)) for value in codepoints), 'name': name, 'group': group})
    if not groups or len(emojis) < 3000:
        raise ValueError('Unexpected Unicode source: refusing to replace bundled data')
    license_data = urllib.request.urlopen('https://www.unicode.org/license.txt', timeout=30).read()
    if b'UNICODE LICENSE' not in license_data:
        raise ValueError('Unicode license unavailable')
    folder = ROOT / 'assets' / 'emoji'
    folder.mkdir(parents=True, exist_ok=True)
    value = {'version': VERSION, 'source': SOURCE, 'groups': groups, 'emojis': emojis}
    (folder / f'emoji-{VERSION}.json').write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    (folder / 'LICENSE.txt').write_bytes(license_data)
    print(f'Updated {len(emojis)} Unicode {VERSION} emojis.')

if __name__ == '__main__':
    main()
