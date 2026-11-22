import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WARRANTY_COLUMN_TYPES, createWarrantyEntityProxy, fromWarrantyRow, toWarrantyRecord, isLiveWarrantySession } from '../shared/warrantyContract.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`create role authenticated; create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table public."User" (email text, role text);
create table public."WarrantyClaim" (id uuid primary key default gen_random_uuid(), claim_number text, technician_id text, technician_name text, customer_name text not null, product_description text not null, issue_description text not null, return_required boolean, status text, claim_date date, resolution text, resolution_date date, created_at timestamptz default now(), updated_at timestamptz default now());`);
for (const name of ['20260928000000_warranty_app_tables.sql', '20261005041100_warranty_import_contract.sql']) {
  const sql = (await fs.readFile(path.join(root, 'supabase/migrations', name), 'utf8')).replace(/create extension if not exists pgcrypto;/i, '');
  await db.exec(sql);
}
const manifest = JSON.parse(await fs.readFile(path.join(root, 'warranty-import/manifest.json'), 'utf8'));
const records = {};
for (const [table, count] of Object.entries(manifest.counts)) {
  records[table] = (await fs.readFile(path.join(root, 'warranty-import', `${table}.jsonl`), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(records[table].length, count);
  const columns = Object.keys(records[table][0]);
  const projection = columns.map(column => `"${column}"`).join(',');
  for (let offset = 0; offset < count; offset += 100) {
    await db.query(`insert into public."${table}" (${projection}) select ${projection} from jsonb_populate_recordset(null::public."${table}", $1::jsonb) on conflict (id) do nothing`, [JSON.stringify(records[table].slice(offset, offset + 100))]);
  }
  assert.equal(Number((await db.query(`select count(*) as count from public."${table}"`)).rows[0].count), count);
  const first = records[table][0];
  await db.query(`insert into public."${table}" (${projection}) select ${projection} from jsonb_populate_recordset(null::public."${table}", $1::jsonb) on conflict (id) do nothing`, [JSON.stringify([first])]);
  assert.equal(Number((await db.query(`select count(*) as count from public."${table}"`)).rows[0].count), count);
  const saved = (await db.query(`select source_record from public."${table}" where id=$1`, [first.id])).rows[0].source_record;
  assert.deepEqual(saved, first.source_record);
  console.log(`${table}: ${count} rows inserted; repeat import and original snapshot verified`);
}
for (const [table, field, target] of [['QCIssue', 'technician_id', 'Technician'], ['QCIssue', 'project_id', 'WarrantyProject'], ['QCIssue', 'assigned_repair_technician_id', 'Technician'], ['WarrantyClaim', 'qc_issue_id', 'QCIssue']]) {
  const result = await db.query(`select count(*) as count from public."${table}" s left join public."${target}" t on s."${field}"=t.id where s."${field}" is not null and t.id is null`);
  assert.equal(Number(result.rows[0].count), 0, `${table}.${field} has dangling references`);
}
assert.equal(Number((await db.query(`select count(*) as count from public."WarrantyClaim" c left join public."Technician" t on c.technician_id=t.id::text where c.technician_id is not null and t.id is null`)).rows[0].count), 0);
const missingSourceColumns = [];
for (const [table, types] of Object.entries(WARRANTY_COLUMN_TYPES)) {
  const columns = (await db.query(`select column_name from information_schema.columns where table_name=$1 and table_schema='public'`, [table])).rows.map(row => row.column_name);
  for (const field of Object.keys(types)) if (!columns.includes(field)) missingSourceColumns.push(`${table}.${field}`);
}
assert.deepEqual(missingSourceColumns, []);
assert.equal(toWarrantyRecord('QCIssue', { date_closed: '', technician_id: '', issue_weight: '1.75', qc_verified: 'false' }).qc_verified, false);
assert.equal(toWarrantyRecord('QCIssue', { date_closed: '' }).date_closed, null);
assert.equal(toWarrantyRecord('Technician', { equipment_types: '[]' }).equipment_types.length, 0);
assert.throws(() => toWarrantyRecord('QCIssue', { date_closed: '0000-00-00' }));
assert.throws(() => toWarrantyRecord('QCIssue', { unrecognized_field: true }));
assert.equal(fromWarrantyRow({ created_at: '2026-10-01', technician_id: 'abc', source_record: {} }).technician_id, 'abc');
assert.equal('source_record' in fromWarrantyRow({ source_record: {} }), false);
assert.equal(isLiveWarrantySession({ is_active: true, last_seen: '2026-09-01' }, Date.parse('2026-10-05')), false);
assert.equal(isLiveWarrantySession({ is_active: true, last_seen: '2026-10-05T00:00:00Z' }, Date.parse('2026-10-05T00:01:00Z')), true);
const ranges = [];
const all = Array.from({ length: 1205 }, (_, id) => ({ id, full_name: `Tech ${id}` }));
const client = { from: () => {
  const query = { select: () => query, order: () => query, eq: () => query, is: () => query, range: (start, end) => {
    ranges.push([start, end]);
    return Promise.resolve({ data: all.slice(start, Math.min(end + 1, start + 200)), error: null });
  }};
  return query;
}};
assert.equal((await createWarrantyEntityProxy(client, 'Technician').list('-created_date')).length, 1205);
assert.equal((await createWarrantyEntityProxy(client, 'Technician').list(undefined, 307)).length, 307);
assert.equal(ranges[1][0], 200);
console.log('PASS: all 11,066 rows, typed columns, source fidelity, relationships, pagination, and stale sessions');
await db.close();
