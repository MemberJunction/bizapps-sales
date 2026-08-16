/**
 * @fileoverview The shared rule for forms holding SERVER-OWNED fields.
 *
 * ── WHY A HELPER AND NOT A BASE CLASS OR A MIXIN ────────────────────────────────────────────────
 *
 * Each custom form must extend its OWN generated form component — that is where the section list, the
 * record typing and the related-grid wiring live, and re-declaring them by hand would drift the moment
 * CodeGen runs. TypeScript has single inheritance, so a shared base class cannot also sit in that chain.
 *
 * A mixin was the obvious next answer and is the wrong one here: TypeScript requires a mixin's
 * constructor to be `(...args: any[])`, and this codebase does not use `any`. Trading a documented
 * type-safety rule for three lines of shared inheritance is a bad trade, especially when the shared part
 * is one pure function.
 *
 * So the shape is: each form extends its generated parent and overrides `Validate()` in two lines,
 * calling into here. The BEHAVIOUR — which fields, how detected, what the message is — lives in exactly
 * one place, which is what mattered.
 *
 * ── WHY THIS REFUSES EARLY INSTEAD OF GREYING FIELDS OUT ────────────────────────────────────────
 *
 * The honest constraint, stated plainly: **`BaseFormComponent` has no per-field read-only hook.** It
 * exposes `EditMode` (whole form), `Validate()` and `SaveRecord()`. MJ metadata has no field-level UI
 * config either — the JSON contracts upstream cover entities and relationships, not fields. So a subclass
 * cannot grey out four fields on a form of twenty-six.
 *
 * What it CAN do is make the refusal arrive at the right moment. Without this, a user edits a
 * server-owned field, presses Save, and the entity server refuses — a correct refusal delivered after the
 * round trip, attached to no particular field. With it, `Validate()` fails immediately and names the
 * field.
 *
 * True greying is left undone deliberately rather than faked with a forked template, which would drift
 * from CodeGen on the next run.
 *
 * @module @mj-biz-apps/sales-ng
 */
import type { BaseEntity, ValidationResult } from '@memberjunction/core';

/** The server-owned fields the user has actually touched. */
export function DirtyServerOwnedFields(record: BaseEntity | null | undefined, fields: readonly string[]): string[] {
    if (!record) {
        return [];
    }
    return fields.filter((name) => record.GetFieldByName(name)?.Dirty === true);
}

/**
 * Fails `result` for every server-owned field the user has edited.
 *
 * MUTATES AND RETURNS the caller's result rather than building a new one, so the generated validation and
 * the entity's own `Validate()` still report everything they found. This only adds the failure the server
 * would otherwise deliver late.
 */
export function RefuseServerOwnedEdits(
    result: ValidationResult,
    record: BaseEntity | null | undefined,
    fields: readonly string[],
    reason: string,
): ValidationResult {
    const dirty = DirtyServerOwnedFields(record, fields);
    if (dirty.length === 0) {
        return result;
    }

    result.Success = false;
    for (const field of dirty) {
        result.Errors.push({
            Source: field,
            Message: reason,
            Value: record?.Get(field) ?? null,
            Type: 'Failure',
        });
    }
    return result;
}
