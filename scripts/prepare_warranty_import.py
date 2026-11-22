import argparse
import collections
import csv
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import shutil
import unicodedata
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
UPLOADS = pathlib.Path('/home/.z/chat-uploads')
FILES = {
    'WarrantyProject': 'Project_export-1a01deb47942.csv',
    'Technician': 'Technician_export-1535e4bb238e.csv',
    'QCIssue': 'QCIssue_export-42cd917dc677.csv',
    'WarrantyClaim': 'WarrantyClaim_export-9eb934756e21.csv',
    'UserSession': 'UserSession_export-abd37d503827.csv',
}
EXTRA_PROJECT = 'Project_export-ecd0a730fccf.csv'
META = {'id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample'}
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, 'm2fleetcomportal.com/warranty/base44')
PLACEHOLDERS = {'', 'unknown', 'tbd', 'na', 'n a', 'pending', 'not specified', 'not provided', 'unspecified', 'technician', 'tech', 'installer', 'employee', 'staff', 'contractor', 'john doe', 'john smith', 'jane doe'}


def stable_id(table, original):
    return str(uuid.uuid5(NAMESPACE, f'{table}:{original}')) if original else None


def normalize(value):
    value = html.unescape(value or '')
    if any(c in value for c in ('Ã', 'Â', 'â')):
        try:
            value = value.encode('latin1').decode('utf-8')
        except (UnicodeError, ValueError):
            pass
    value = re.sub(r'\[MERGED\]', '', value, flags=re.I)
    value = unicodedata.normalize('NFKD', value)
    return ' '.join(re.sub(r'[^a-z0-9\s]', ' ', value.lower()).split())


def read_rows(path):
    with path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError(f'Duplicate headers: {path.name}')
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f'Invalid CSV shape: {path.name}')
    if any(not row['id'] for row in rows) or len({row['id'] for row in rows}) != len(rows):
        raise ValueError(f'Blank or duplicate record IDs: {path.name}')
    return rows


def schemas():
    sql = (ROOT / 'supabase/migrations/20260928000000_warranty_app_tables.sql').read_text()
    result = {}
    for table, body in re.findall(r'create table if not exists public\."(\w+)" \((.*?)\n\);', sql, flags=re.S | re.I):
        result[table] = dict(re.findall(r'^\s+(\w+)\s+(uuid|text|date|timestamptz|numeric|boolean|jsonb)\b', body, flags=re.M))
    result['UserSession']['session_end'] = 'timestamptz'
    result['WarrantyClaim'] = {'id': 'uuid', 'created_at': 'timestamptz', 'updated_at': 'timestamptz', **{key: 'text' for key in ['claim_number', 'technician_id', 'technician_name', 'customer_name', 'product_description', 'issue_description', 'resolution', 'status']}, 'return_required': 'boolean', 'claim_date': 'date', 'resolution_date': 'date'}
    return result


def convert(value, kind, field, reasons):
    if not value.strip():
        return value if kind == 'text' else None
    if kind == 'text':
        return value
    try:
        if kind == 'boolean':
            if value.lower() not in ('true', 'false'):
                raise ValueError('Not a boolean')
            return value.lower() == 'true'
        if kind == 'numeric':
            number = float(value)
            if not (-float('inf') < number < float('inf')):
                raise ValueError('Not finite')
            return int(number) if number.is_integer() else number
        if kind == 'date':
            return dt.date.fromisoformat(value).isoformat()
        if kind == 'timestamptz':
            instant = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
            if not instant.tzinfo:
                instant = instant.replace(tzinfo=dt.timezone.utc)
            return instant.isoformat()
        if kind == 'jsonb':
            return json.loads(value)
    except (ValueError, TypeError):
        reasons.append(f'invalid_{kind}:{field}')
        return None
    return value


def prepare(output):
    output.mkdir(parents=True, exist_ok=True)
    source = output / 'source'
    source.mkdir(exist_ok=True)
    rows = {table: read_rows(UPLOADS / name) for table, name in FILES.items()}
    extra = read_rows(UPLOADS / EXTRA_PROJECT)
    if extra != rows['WarrantyProject']:
        raise ValueError('Project exports differ; refuse to choose one silently')
    types = schemas()
    unknown = {table: sorted(set(records[0]) - META - set(types[table])) for table, records in rows.items()}
    if any(unknown.values()):
        raise ValueError(f'Unmapped fields: {unknown}')
    for name in list(FILES.values()) + [EXTRA_PROJECT]:
        shutil.copy2(UPLOADS / name, source / name)
    indices = {table: {row['id']: row for row in records} for table, records in rows.items()}
    active_names = collections.defaultdict(list)
    for tech in rows['Technician']:
        if tech['status'] != 'inactive' and tech['is_active'] != 'false' and '[MERGED]' not in tech['full_name']:
            active_names[normalize(tech['full_name'])].append(tech['id'])
    project_names = collections.defaultdict(list)
    for project in rows['WarrantyProject']:
        project_names[normalize(project['project_name'])].append(project['id'])
    links = collections.Counter()
    warnings = []
    prepared = {table: [] for table in rows}

    def link(target, original, name, reasons, field, allow_name=True):
        if original in indices[target]:
            links[f'{target}:preserved_id'] += 1
            if target == 'Technician' and name and normalize(name) != normalize(indices[target][original]['full_name']):
                reasons.append(f'name_id_disagreement:{field}')
            return stable_id(target, original)
        choices = []
        key = normalize(name)
        if allow_name and key not in PLACEHOLDERS:
            choices = (active_names if target == 'Technician' else project_names).get(key, [])
        if len(choices) == 1:
            links[f'{target}:recovered_by_exact_name'] += 1
            return stable_id(target, choices[0])
        if original or name:
            reasons.append(f'{"ambiguous" if len(choices) > 1 else "unresolved"}_reference:{field}')
            links[f'{target}:unresolved'] += 1
        return None

    for table, records in rows.items():
        for record in records:
            reasons = []
            dest = {key: convert(value, types[table][key], key, reasons) for key, value in record.items() if key not in META and key in types[table] and types[table][key] != 'uuid'}
            dest.update(id=stable_id(table, record['id']), legacy_id=record['id'], source_record=record, created_at=convert(record['created_date'], 'timestamptz', 'created_date', reasons), updated_at=convert(record['updated_date'], 'timestamptz', 'updated_date', reasons))
            if table == 'Technician':
                dest['merged_into_technician_id'] = link(table, record['merged_into_technician_id'], '', reasons, 'merged_into_technician_id', False)
                if record['status'] == 'inactive' or '[MERGED]' in record['full_name']:
                    dest['is_active'] = False
                    dest['is_primary'] = False
                if normalize(record['full_name']) in PLACEHOLDERS:
                    reasons.append('placeholder_technician_name')
            if table == 'QCIssue':
                dest['technician_id'] = link('Technician', record['technician_id'], record['technician_name'], reasons, 'technician_id')
                dest['assigned_repair_technician_id'] = link('Technician', record['assigned_repair_technician_id'], record['assigned_repair_technician_name'], reasons, 'assigned_repair_technician_id')
                dest['project_id'] = link('WarrantyProject', record['project_id'], record['work_order_name'], reasons, 'project_id')
                raw = record['warranty_audit_log']
                if raw:
                    try:
                        log = json.loads(raw)
                        if not isinstance(log, list):
                            raise ValueError('Not an array')
                    except (ValueError, TypeError):
                        dest['warranty_audit_log'] = json.dumps([{'action': 'Imported legacy activity', 'notes': raw}], ensure_ascii=False)
                        links['legacy_audit_logs_preserved'] += 1
                if not record['issue_type']:
                    reasons.append('missing_issue_type')
                if not record['asset_number']:
                    reasons.append('missing_asset_number')
                if normalize(record['technician_name']) in PLACEHOLDERS:
                    reasons.append('placeholder_technician_name')
                duplicate = re.fullmatch(r'duplicate_of_(.+)', record['duplicate_status'])
                if duplicate:
                    target = duplicate.group(1)
                    if target in indices['QCIssue']:
                        dest['duplicate_status'] = 'duplicate_of_' + stable_id('QCIssue', target)
                    else:
                        reasons.append('unresolved_reference:duplicate_of')
            if table == 'WarrantyClaim':
                dest['technician_id'] = link('Technician', record['technician_id'], record['technician_name'], reasons, 'technician_id')
                for field in ['customer_name', 'product_description', 'issue_description']:
                    if not record[field].strip():
                        reasons.append(f'missing_required_text:{field}')
            if table == 'UserSession':
                if record['is_active'] == 'true':
                    reasons.append('historical_session_active_flag_preserved')
                seconds = dest.get('duration_seconds') or 0
                tracked = (dest.get('active_seconds') or 0) + (dest.get('idle_seconds') or 0)
                if tracked > seconds + 120:
                    reasons.append('session_activity_exceeds_duration')
            dest['import_review_reasons'] = reasons
            prepared[table].append(dest)
            for reason in reasons:
                warnings.append({'table': table, 'legacy_id': record['id'], 'reason': reason})

    issues_by_key = collections.defaultdict(list)
    for issue in prepared['QCIssue']:
        asset = re.match(r'^\s*[* >]*([A-Za-z0-9_-]+)', issue.get('asset_number') or '')
        if not asset:
            continue
        key = (asset.group(1).upper(), issue.get('install_service_date') or issue.get('qc_event_date'), issue.get('technician_id'))
        issues_by_key[key].append(issue)
    for claim in prepared['WarrantyClaim']:
        asset = re.match(r'^\s*[* >]*([A-Za-z0-9_-]+)', claim.get('product_description') or '')
        key = (asset.group(1).upper() if asset else None, claim.get('claim_date'), claim.get('technician_id'))
        choices = issues_by_key.get(key, []) if claim.get('technician_id') and key[0] else []
        claim_number = claim.get('claim_number') or ''
        prefix = claim_number[3:].lower() if claim_number.startswith('WC-') else ''
        exact = [issue for issue in choices if prefix and (issue.get('source_message_id') or '').lower().startswith(prefix)]
        if exact:
            choices = exact
        if len(choices) > 1:
            live = [issue for issue in choices if issue.get('data_status') not in ('archived', 'legacy_review') and issue.get('duplicate_status') != 'duplicate' and not str(issue.get('duplicate_status') or '').startswith('duplicate_of_')]
            if len(live) == 1:
                choices = live
        claim['qc_issue_id'] = choices[0]['id'] if len(choices) == 1 else None
        links[f'claim_issue_link:{"matched" if len(choices) == 1 else "ambiguous" if choices else "unresolved"}'] += 1
        if len(choices) != 1:
            reason = 'ambiguous_reference:qc_issue_id' if choices else 'unresolved_reference:qc_issue_id'
            claim['import_review_reasons'].append(reason)
            warnings.append({'table': 'WarrantyClaim', 'legacy_id': claim['legacy_id'], 'reason': reason})
        elif claim.get('status') == 'pending' and choices[0].get('status') in ('closed', 'repaired'):
            reason = 'claim_pending_but_qc_resolved'
            claim['import_review_reasons'].append(reason)
            warnings.append({'table': 'WarrantyClaim', 'legacy_id': claim['legacy_id'], 'reason': reason})

    for table, records in prepared.items():
        with (output / f'{table}.jsonl').open('w') as handle:
            for record in records:
                handle.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + '\n')
    with (output / 'review-needed.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['table', 'legacy_id', 'reason'])
        writer.writeheader()
        writer.writerows(warnings)
    repeated_names = {name: ids for name, ids in active_names.items() if len(ids) > 1}
    repeated_claim_numbers = sum(1 for count in collections.Counter(r['claim_number'] for r in rows['WarrantyClaim']).values() if count > 1)
    manifest = {
        'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'live_import_performed': False,
        'counts': {table: len(records) for table, records in rows.items()},
        'unique_records': sum(len(records) for records in rows.values()),
        'identical_project_export_ignored': EXTRA_PROJECT,
        'source_sha256': {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in list(FILES.values()) + [EXTRA_PROJECT]},
        'unmapped_fields': unknown,
        'links': dict(links),
        'review_reasons': dict(collections.Counter(w['reason'] for w in warnings)),
        'records_needing_review': len({(w['table'], w['legacy_id']) for w in warnings}),
        'ambiguous_active_technician_names': repeated_names,
        'repeated_claim_number_groups': repeated_claim_numbers,
        'source_issue_status_counts': dict(collections.Counter(r['status'] for r in rows['QCIssue'])),
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    report = ['# Warranty export reconciliation', '', f"Generated: {manifest['generated_at']}", '', '**Status: prepared and validated locally; not imported into live Supabase.**', '', '| Destination | Rows | Source columns |', '|---|---:|---:|']
    report += [f'| {table} | {len(records):,} | {len(records[0])} |' for table, records in rows.items()]
    report += ['', f"Total: **{manifest['unique_records']:,} distinct source records**. The second project CSV is byte-identical and is not imported twice.", '', '## Compatibility repairs', '', '- All source fields map to a database column or the preserved `source_record` snapshot; none are discarded.', '- Legacy IDs map deterministically to UUIDs, including technician, project, repair-technician and duplicate-of references. Original IDs remain in `legacy_id` and `source_record`.', '- Source created/updated dates map to `created_at`/`updated_at`. The app exposes both date naming conventions.', '- Blank non-text values become null; blank text stays blank (including one missing claim description). Impossible dates become null and are listed for review. Original strings remain in the source snapshot.', '- Technician-name uniqueness must be removed: merged history and duplicate names are legitimate source records, not safe automatic deletions.', '- `UserSession.session_end` must be added.', '- Plain-text activity logs become readable timeline entries; full original logs are preserved.', '- Reads must paginate: Supabase’s default response cap would otherwise omit records.', '', '## Safe linkage results', '']
    report += [f'- {key}: **{value:,}**' for key, value in sorted(links.items())]
    report += ['', '## Review findings', '', f"{manifest['records_needing_review']:,} records have at least one review reason; records and statuses are retained, not deleted or silently rewritten.", f'{repeated_claim_numbers:,} claim-number groups repeat. Claim number alone is not a reliable identity; use source ID plus asset/date/technician.', f'{len(repeated_names):,} normalized names identify multiple active technicians; these are not guessed.', '']
    report += [f'- {key}: **{value:,}**' for key, value in sorted(manifest['review_reasons'].items())]
    report += ['', '## Protected behavior', '', 'Existing M2 `Project`, `TechnicianMaster`, `QCInspection` and `CallLog` tables are not altered or repurposed. Source counters and session activity are retained as historical snapshots. Pending claims are not automatically closed from an issue status. Original archived, suspected-duplicate, placeholder and merged records remain available for review.', '', '## Live prerequisites', '', 'The five new warranty tables are still absent in the last live check. Applying migrations requires database-administration access; the connected data API key cannot execute table-creation SQL. The scheduling mailbox connection is also not configured. No live data has been imported.', '']
    (output / 'MATCHING-REPORT.md').write_text('\n'.join(report))
    print(json.dumps({key: manifest[key] for key in ['counts', 'unique_records', 'links', 'records_needing_review', 'review_reasons']}, indent=2))
    print(str(output / 'MATCHING-REPORT.md'))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Prepare lossless warranty exports with deterministic linked IDs; never writes to live Supabase.')
    parser.add_argument('--output', type=pathlib.Path, default=ROOT / 'warranty-import')
    args = parser.parse_args()
    prepare(args.output.resolve())
