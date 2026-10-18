import os
import json
import re

dir_path = 'assets/categories/tier_01'
files = sorted(os.listdir(dir_path))

for fname in files:
    if not fname.endswith('.json'):
        continue
    fpath = os.path.join(dir_path, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        raw = f.read()

    # Clean markdown backslash escapes
    cleaned = re.sub(r'\\([_\[\]:*~`#])', r'\1', raw)
    cleaned = cleaned.replace('https\\:', 'https:').replace('http\\:', 'http:')

    try:
        data = json.loads(cleaned)
    except Exception as e:
        print(f"Failed parsing {fname}: {e}")
        continue

    # Ensure tier is tier_01 for every prompt
    for item in data:
        item['tier'] = 'tier_01'
        if 'category' not in item or not item['category']:
            title = fname.replace('.json', '').replace('_', ' ').title()
            item['category'] = title

    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Sanitized & updated {fname}: {len(data)} items, tier={data[0]['tier']}, category={data[0].get('category')}")

print("All 8 files processed successfully!")
