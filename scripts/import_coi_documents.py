#!/usr/bin/env python3
"""Migrate Base44 COI certificates into the app's private insurance-docs bucket.

Reads the WorkersCompRecord export CSV, downloads each certificate from
base44.app (following the 302 to media.base44.com), verifies the file is a
real PDF/image, uploads it to the private 'insurance-docs' bucket, and links
it to the matching InsurancePolicy row (contractor_email + insurance_type +
policy_number, newest-expiration fallback).

Usage:
  python3 scripts/import_coi_documents.py            # dry run
  python3 scripts/import_coi_documents.py --apply    # upload + link
"""
import csv, json, os, sys, time, mimetypes, urllib.request, urllib.error

DRY = "--apply" not in sys.argv
SUPABASE_URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CSV_PATH = "/home/.z/chat-uploads/WorkersCompRecord_export-121a9b664d17.csv"
APP_ID = "68a390239868be00767c8ae8"

MAGICS = (b"%PDF", b"\x89PNG", b"\xff\xd8\xff", b"GIF8", b"BM")  # pdf/png/jpeg/gif/bmp


def api(method, path, body=None, content_type="application/json"):
    url = f"{SUPABASE_URL}{path}"
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
    headers = {
        "apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": content_type, "Prefer": "return=representation",
    }
    if "/storage/v1/" in path:
        headers["x-upsert"] = "true"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req) as r:
        raw = r.read()
    return json.loads(raw) if raw else None


def is_real_file(data):
    return bool(data) and any(data.startswith(m) for m in MAGICS)


def candidates(u):
    """URL forms to try, in order. urllib follows the 302 to media.base44.com."""
    base = u.split("?")[0]
    rel = base.split("/files/", 1)[-1]  # e.g. mp/public/{app}/file.pdf
    return [
        base,                                            # https://base44.app/api/apps/{app}/files/...
        f"https://media.base44.com/files/{rel}",         # final target, direct
        f"https://app.base44.com/api/apps/{APP_ID}/files/{rel}",
    ]


def fetch(u):
    for c in candidates(u):
        try:
            req = urllib.request.Request(c, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if r.status == 200 and is_real_file(data):
                return data, c
        except (urllib.error.HTTPError, urllib.error.URLError, Exception):
            continue
    return None, None


# ── 1. Parse CSV ──────────────────────────────────────────────────────
rows = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        doc = (row.get("documentUrl") or "").strip()
        rows.append({
            "email": (row.get("userEmail") or "").strip().lower(),
            "name": (row.get("userName") or "").strip(),
            "policy_number": (row.get("policyNumber") or "").strip(),
            "insurance_type": (row.get("insuranceType") or "").strip().lower() or "workers_comp",
            "expiration": (row.get("expirationDate") or "").strip() or None,
            "doc": doc,
        })
with_docs = [r for r in rows if r["doc"] and r["doc"] != "None"]
unique_urls = sorted({r["doc"] for r in with_docs})
print(f"rows={len(rows)} withDocs={len(with_docs)} uniqueDocs={len(unique_urls)}")

# ── 2. Probe one URL ──────────────────────────────────────────────────
probe, worked = fetch(unique_urls[0])
print(f"probe: {'OK %d bytes via %s' % (len(probe), worked) if probe else 'FAILED ' + unique_urls[0]}")

# ── 3. Download all unique docs ───────────────────────────────────────
docs, failed = {}, []
if probe:
    for u in unique_urls:
        data, src = fetch(u)
        if data:
            docs[u] = (data, src)
        else:
            failed.append(u)
        time.sleep(0.15)
    print(f"downloaded={len(docs)} failed={len(failed)}")
    for u in failed[:8]:
        print("  FAILED:", u)

if DRY or not probe:
    print("DRY RUN ONLY — re-run with --apply to upload + link")
    sys.exit(0)

# ── 4. Load live policies & link per CSV row ──────────────────────────
policies = api("GET", "/rest/v1/InsurancePolicy?select=id,contractor_email,insurance_type,policy_number,effective_date,expiration_date,document_path&order=expiration_date.asc")
by_email = {}
for p in policies:
    by_email.setdefault((p["contractor_email"] or "").strip().lower(), []).append(p)


def safe_name(u):
    base = u.split("/")[-1].split("?")[0]
    return base or "certificate.pdf"


linked, uploads, skipped = 0, 0, []
for r in with_docs:
    cands = by_email.get(r["email"], [])
    if not cands:
        skipped.append((r["email"], r["policy_number"], "no policy rows"))
        continue
    same_type = [p for p in cands if (p["insurance_type"] or "").lower() == r["insurance_type"]] or cands
    pn = r["policy_number"].strip().upper()
    cur = next((p for p in same_type if (p.get("policy_number") or "").strip().upper() == pn), None)
    if not cur:
        cur = same_type[-1]  # newest-expiration fallback
    if r["doc"] not in docs:
        skipped.append((r["email"], pn, "doc not downloaded"))
        continue
    data, src = docs[r["doc"]]
    ext = os.path.splitext(safe_name(r["doc"]))[1] or ".pdf"
    path = f"{cur['id']}/COI{ext}"
    ct = mimetypes.guess_type("x" + ext)[0] or "application/pdf"
    try:
        api("POST", f"/storage/v1/object/insurance-docs/{path}", body=data, content_type=ct)
        uploads += 1
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "ignore")
        except Exception:
            pass
        if e.code != 409 and "KeyAlreadyExists" not in body:
            skipped.append((r["email"], pn, f"upload {e.code} {body[:120]}"))
            continue
    api("PATCH", f"/rest/v1/InsurancePolicy?id=eq.{cur['id']}", body={
        "document_bucket": "insurance-docs",
        "document_path": path,
        "document_name": safe_name(r["doc"]),
    })
    linked += 1

print(f"uploads={uploads} linked={linked} skipped={len(skipped)}")
for s in skipped[:10]:
    print("  SKIPPED:", s)
print("APPLIED" if not DRY else "DRY RUN ONLY")
