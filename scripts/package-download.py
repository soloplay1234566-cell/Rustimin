"""Wrap an already prepared portable payload in a ZIP below GitHub's 100 MiB limit."""
from pathlib import Path
import hashlib
import zipfile

root = Path(__file__).resolve().parents[1]
payload = root / 'release' / 'portable-wrapper'
required = ['application.7z', '7za.exe', 'START.cmd', 'ПРОЧИТАЙ.txt', '7zip-LICENSE.txt', '7zip-LGPL.txt']
for name in required:
    if not (payload / name).is_file():
        raise SystemExit(f'Missing payload: {name}')
out = root / 'downloads' / 'Rustimin-Windows.zip'
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_STORED) as z:
    for name in required:
        z.write(payload / name, name)
if out.stat().st_size >= 100 * 1024 * 1024:
    raise SystemExit('Archive exceeds GitHub single-file limit')
with zipfile.ZipFile(out) as z:
    if z.testzip() is not None:
        raise SystemExit('ZIP integrity check failed')
with out.open('rb') as f:
    digest = hashlib.file_digest(f, 'sha256').hexdigest()
out.with_suffix('.zip.sha256').write_text(f'{digest}  {out.name}\n')
print(f'{out}: {out.stat().st_size / 1024 / 1024:.1f} MiB, integrity OK')
