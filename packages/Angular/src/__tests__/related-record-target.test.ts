import { afterEach, describe, expect, it, vi } from 'vitest';
import { Metadata, type EntityInfo } from '@memberjunction/core';

import { RelatedRecordTarget } from '../lib/pages/deal-views';

/**
 * Turning a grid's linked-cell request into a record to open. The related entity can be any entity, so
 * the key is read against its metadata rather than assumed to be `ID`.
 */

const STAGE = 'MJ_BizApps_Sales: Pipeline Stages';
const CODE_KEYED = 'Placeholder: Code Keyed';

afterEach(() => vi.restoreAllMocks());

function withEntities(): void {
    vi.spyOn(Metadata.prototype, 'Entities', 'get').mockReturnValue([
        { Name: STAGE, FirstPrimaryKey: { Name: 'ID' } } as unknown as EntityInfo,
        { Name: CODE_KEYED, FirstPrimaryKey: { Name: 'Code' } } as unknown as EntityInfo,
    ]);
}

describe('RelatedRecordTarget', () => {
    it("resolves a bare key against the entity's own key column", () => {
        withEntities();
        const target = RelatedRecordTarget({ entityName: STAGE, recordKey: 'stage-1' });
        expect(target?.EntityName).toBe(STAGE);
        expect(target?.Key.GetValueByFieldName('ID')).toBe('stage-1');

        const coded = RelatedRecordTarget({ entityName: CODE_KEYED, recordKey: 'USD' });
        expect(coded?.Key.GetValueByFieldName('Code')).toBe('USD');
    });

    it('ignores an entity this host does not know', () => {
        withEntities();
        expect(RelatedRecordTarget({ entityName: 'Not: Installed', recordKey: 'x' })).toBeNull();
    });

    it('ignores a request with no key', () => {
        withEntities();
        expect(RelatedRecordTarget({ entityName: STAGE, recordKey: null })).toBeNull();
        expect(RelatedRecordTarget({ entityName: STAGE, recordKey: '' })).toBeNull();
        expect(RelatedRecordTarget(null)).toBeNull();
    });
});
