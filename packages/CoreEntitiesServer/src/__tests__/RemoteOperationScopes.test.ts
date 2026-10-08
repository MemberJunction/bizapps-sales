import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseRemotableOperation } from '@memberjunction/core';
import { describe, expect, it } from 'vitest';
import * as server from '../index.js';

/**
 * MJAPI checks an API key's scopes only when the registered operation class carries a
 * `RequiredScope`, and refuses a scope that has no `MJ: API Scopes` row (#186). This pins:
 * every Sales operation class carries a `sales:` scope; a class with a metadata row
 * carries the scope that row declares; and every scope a class carries ships in metadata/api-scopes
 * with an MJAPI ceiling row in metadata/api-application-scopes.
 */

const METADATA_DIR = join(import.meta.dirname, '..', '..', '..', '..', 'metadata');

interface MetadataRecord {
    fields: Record<string, string | number | boolean | undefined>;
    relatedEntities?: Record<string, MetadataRecord[]>;
}

function readRecords(folder: string): MetadataRecord[] {
    const dir = join(METADATA_DIR, folder);
    return readdirSync(dir)
        .filter((f) => f.endsWith('.json') && f !== '.mj-sync.json')
        .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as MetadataRecord[]);
}

function flatten(records: MetadataRecord[]): MetadataRecord[] {
    return records.flatMap((r) => [r, ...Object.values(r.relatedEntities ?? {}).flatMap(flatten)]);
}

function declaredScopes(): Map<string, string> {
    const scopes = new Map<string, string>();
    for (const r of readRecords('remote-operations')) {
        scopes.set(String(r.fields.OperationKey), String(r.fields.RequiredScope ?? ''));
    }
    return scopes;
}

function serverScopes(): Map<string, string | undefined> {
    const scopes = new Map<string, string | undefined>();
    for (const value of Object.values(server)) {
        if (typeof value !== 'function' || !(value.prototype instanceof BaseRemotableOperation)) continue;
        const op = new (value as new () => BaseRemotableOperation)();
        if (op.OperationKey?.startsWith('Sales.')) scopes.set(op.OperationKey, op.RequiredScope);
    }
    return scopes;
}

const shippedScopes = new Set(flatten(readRecords('api-scopes')).map((r) => String(r.fields.FullPath)));

const mjapiScopes = new Set(
    readRecords('api-application-scopes')
        .filter((r) => r.fields.ApplicationID === '@lookup:MJ: API Applications.Name=MJAPI' && r.fields.IsDeny === false)
        .map((r) => String(r.fields.ScopeID).replace('@lookup:MJ: API Scopes.FullPath=', '')),
);

describe('Sales remote operation scopes (#186)', () => {
    const declared = declaredScopes();
    const actual = serverScopes();

    it('finds operations in metadata and in the server package', () => {
        expect(declared.size).toBeGreaterThan(0);
        expect(actual.size).toBeGreaterThanOrEqual(declared.size);
    });

    it.each([...declared.keys()])('%s carries the scope its metadata row declares', (key) => {
        expect(actual.get(key)).toBe(declared.get(key));
    });

    it.each([...actual.keys()])('%s carries a sales scope that ships with an MJAPI ceiling', (key) => {
        const scope = actual.get(key);
        expect(scope).toMatch(/^sales:/);
        expect(shippedScopes.has(scope!)).toBe(true);
        expect(mjapiScopes.has(scope!)).toBe(true);
    });

    it('ships the sales parent scope', () => {
        expect(shippedScopes.has('sales')).toBe(true);
    });
});
