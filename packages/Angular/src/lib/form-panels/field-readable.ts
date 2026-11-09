/**
 * @fileoverview Whether the viewer may read a field the deal form draws itself.
 *
 * `mj-form-field` asks field-level security before it reads a value. A row this app draws itself
 * (the Commercial panel's money rows, the header's Amount) inherits that duty with the markup: it
 * must not print a field the user may not read, and `BaseEntity.Get()` throws for such a field, so
 * reading it first would take the panel down rather than hide one value (#403).
 *
 * Same rule as the shared control: `EntityInfo.IsFieldReadableByUser`, which answers true when the
 * entity has field security switched off or no user has resolved yet. The server is the boundary.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { EntityInfo, UserInfo } from '@memberjunction/core';

export function IsFieldReadable(
    entityInfo: EntityInfo | null | undefined,
    fieldName: string,
    user: UserInfo | null | undefined,
): boolean {
    if (!entityInfo) return true;
    return entityInfo.IsFieldReadableByUser(fieldName, user);
}
