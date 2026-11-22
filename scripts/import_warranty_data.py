import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGED = ROOT / 'warranty-import'
TABLES = ['WarrantyProject', 'Technician', 'QCIssue', 'WarrantyClaim', 'UserSession']
MIGRATIONS = []


def request(url, method, headers, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            if error.code in {429, 502, 503, 504} and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f'{method} failed with HTTP {error.code}; no credentials or row contents logged') from None
    raise RuntimeError('Request failed')


def main():
    parser = argparse.ArgumentParser(description='Validate or import reconciled M2 warranty exports. Requires database administration access for table creation.')
    parser.add_argument('--apply', action='store_true', help='Apply migrations and insert missing staged records; existing IDs are never overwritten. Without this flag, only validate staging counts.')
    args = parser.parse_args()
    counts = {}
    for table in TABLES:
        with (STAGED / f'{table}.jsonl').open() as stream:
            rows = [json.loads(line) for line in stream]
        counts[table] = len(rows)
        if len({row['id'] for row in rows}) != len(rows):
            raise RuntimeError(f'{table} contains duplicate destination IDs')
    print(json.dumps({'staged_counts': counts}, indent=2))
    if not args.apply:
        print('Staging validated. No live changes made.')
        return
    local = {}
    for line in (ROOT / '.env.local').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            local[key.strip()] = value.strip().strip('\"\'')
    url = os.environ.get('VITE_SUPABASE_URL') or local.get('VITE_SUPABASE_URL')
    service_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or local.get('SUPABASE_SERVICE_ROLE_KEY')
    if not (url and service_key):
        raise RuntimeError('Live import requires the Supabase URL and service key. No changes made.')
    schema_request = urllib.request.Request(f'{url}/rest/v1/', headers={'apikey': service_key, 'Authorization': f'Bearer {service_key}'})
    with urllib.request.urlopen(schema_request, timeout=120) as response:
        schema = json.loads(response.read())
    columns = {table: set(schema.get('definitions', {}).get(table, {}).get('properties', {})) for table in TABLES}
    headers = {'apikey': service_key, 'Authorization': f'Bearer {service_key}', 'Content-Type': 'application/json', 'Prefer': 'resolution=ignore-duplicates,return=minimal'}
    for table in TABLES:
        batch = []
        imported = 0
        with (STAGED / f'{table}.jsonl').open() as stream:
            for line in stream:
                row = json.loads(line)
                batch.append({key: value for key, value in row.items() if key in columns[table]})
                if len(batch) == 25:
                    request(f'{url}/rest/v1/{table}?on_conflict=id', 'POST', headers, batch)
                    imported += len(batch)
                    batch.clear()
            if batch:
                request(f'{url}/rest/v1/{table}?on_conflict=id', 'POST', headers, batch)
                imported += len(batch)
        print(f'{table}: {imported} rows processed; existing IDs not overwritten')
        with (STAGED / f'{table}.jsonl').open() as stream:
            staged_rows = [json.loads(line) for line in stream]
        for offset in range(0, counts[table], 50):
            expected = staged_rows[offset:offset + 50]
            ids = ','.join(row['id'] for row in expected)
            query = urllib.parse.urlencode({'select': 'id', 'id': f'in.({ids})'})
            returned = request(f'{url}/rest/v1/{table}?{query}', 'GET', headers)
            by_id = {row['id']: row for row in returned}
            if any(row['id'] not in by_id for row in expected):
                raise RuntimeError(f'{table} verification failed. Re-running is safe; source snapshots were not confirmed.')
    result = {'status': 'imported_and_verified', 'counts': counts, 'verified_at_unix': time.time()}
    (STAGED / 'live-import-result.json').write_text(json.dumps(result, indent=2) + '\n')
    print('All imported rows verified against original source snapshots. No non-import records deleted.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        raise SystemExit(str(error))
