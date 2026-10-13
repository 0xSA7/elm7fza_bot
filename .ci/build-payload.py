#!/usr/bin/env python3
"""build-payload.py — بناء payload الـ API من ملفات المشروع
المدخل : الملفات في المجلد الحالي
المخرج : /tmp/payload.json + عدد الملفات في stdout
"""
import json
import glob
import sys
import os

def main():
    files = []

    # كل ملفات .gs → SERVER_JS (الاسم من غير الامتداد)
    for f in sorted(glob.glob('*.gs')):
        with open(f, encoding='utf-8') as fh:
            files.append({
                'name': f[:-3],           # App.gs → "App"
                'type': 'SERVER_JS',
                'source': fh.read()
            })

    # المانيفست → JSON
    manifest = 'appsscript.json'
    if os.path.exists(manifest):
        with open(manifest, encoding='utf-8') as fh:
            files.append({
                'name': 'appsscript',
                'type': 'JSON',
                'source': fh.read()
            })

    if not files:
        print('::error::مفيش ملفات .gs أو appsscript.json في المجلد!')
        sys.exit(1)

    with open('/tmp/payload.json', 'w', encoding='utf-8') as fh:
        json.dump({'files': files}, fh, ensure_ascii=False)

    print(len(files))

if __name__ == '__main__':
    main()