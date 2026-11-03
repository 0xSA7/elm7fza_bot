#!/usr/bin/env python3
"""build-payload.py: بناء payload الـ API من ملفات المشروع
المدخل : src/*.js + src/appsscript.json (كل حاجة اللي بتوصل جوجل)
المخرج : /tmp/payload.json + عدد الملفات في stdout

ملاحظة مهمة: الاسم المتبعت لجوجل هو basename من غير مسار (src/App.js ← "App")
فسطح المشروع على GAS بيفضل مسطح زي ما هو مهما كان ترتيب الفولدرات عندنا.
"""
import json
import glob
import sys
import os

def main():
    files = []

    # كل ملفات src/*.js → SERVER_JS (الاسم basename من غير الامتداد)
    for f in sorted(glob.glob('src/*.js')):
        with open(f, encoding='utf-8') as fh:
            files.append({
                'name': os.path.basename(f)[:-3],   # src/App.js → "App"
                'type': 'SERVER_JS',
                'source': fh.read()
            })

    # المانيفست → JSON (جواه src/ مع الكود: src/ هو بالظبط اللي بيوصل جوجل)
    manifest = 'src/appsscript.json'
    if os.path.exists(manifest):
        with open(manifest, encoding='utf-8') as fh:
            files.append({
                'name': 'appsscript',
                'type': 'JSON',
                'source': fh.read()
            })

    if not files:
        print('::error::مفيش ملفات .js في src/ ولا src/appsscript.json!')
        sys.exit(1)

    with open('/tmp/payload.json', 'w', encoding='utf-8') as fh:
        json.dump({'files': files}, fh, ensure_ascii=False)

    print(len(files))

if __name__ == '__main__':
    main()