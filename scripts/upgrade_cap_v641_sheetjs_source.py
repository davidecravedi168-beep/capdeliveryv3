from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s
old='<script src="vendor/xlsx.full.min.js"></script>'
new='<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>'
if old in s:s=s.replace(old,new,1)
elif new not in s:raise SystemExit('SheetJS 0.20.3 source anchor missing')
if 'cdn.jsdelivr.net/npm/xlsx@0.18.5' in s:raise SystemExit('obsolete SheetJS source remains')
if s!=orig:p.write_text(s,encoding='utf-8');print('Pinned authoritative SheetJS 0.20.3 source')
else:print('SheetJS authoritative source already pinned')
