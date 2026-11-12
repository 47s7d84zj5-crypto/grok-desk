"""Runs inside GitHub Actions. Decrypts bundle.enc (AES-GCM) into _site/d/$DATA_PATH/.
Reads DATA_KEY and DATA_PATH from env (Actions secrets). Prints nothing about either."""
import base64, io, os, re, sys, tarfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = base64.b64decode(os.environ["DATA_KEY"]); dp = os.environ["DATA_PATH"]
if not re.fullmatch(r"[A-Za-z0-9_-]{32,}", dp): sys.exit("bad data path")
src, site = sys.argv[1], sys.argv[2]
blob = open(src, "rb").read()
plain = AESGCM(key).decrypt(blob[:12], blob[12:], b"grok-desk-v1")
out = os.path.join(site, "d", dp)
with tarfile.open(fileobj=io.BytesIO(plain), mode="r:gz") as t:
    for m in t.getmembers():
        if not m.isfile() or ".." in m.name or m.name.startswith("/") or not re.fullmatch(r"[A-Za-z0-9_./-]+\.json", m.name):
            continue
        p = os.path.join(out, m.name); os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f: f.write(t.extractfile(m).read())
print("data ok")
