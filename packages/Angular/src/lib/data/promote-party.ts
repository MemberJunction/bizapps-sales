/**
 * @fileoverview Promoting an existing Organization or Person into sales.
 *
 * Sales Accounts and Sales Contacts are IS-A subtypes: the child shares the parent's key, so a
 * company or person Common already knows does not need re-entering to become a sales record. It
 * needs PROMOTING — inserting only the subtype row and leaving the parent untouched. Decided in
 * `docs/DECISIONS.md` D-PR1…D-PR4; proven end to end by `IS4` and `IS5`.
 *
 * THE SEQUENCE IS NOT NEGOTIABLE, and it is MJ's, not ours: `GetEntityObject` the CHILD, then
 * `NewRecord()`, then `AttachToParent(CompositeKey.FromID(parentID))`, then set the child's own
 * fields, then `Save()`. `AttachToParent` loads the parent chain ITSELF, so the caller must not load
 * the parent first — it throws on a record that is already saved, and on an entity that is not an
 * IS-A child.
 *
 * WHY THIS PRE-CHECKS EXISTENCE, which looks redundant next to `AttachToParent`'s boolean:
 * `AttachToParent` asks only whether the PARENT row exists. It returns `true` for a parent whose
 * child row is already there, and `EnforceDisjointSubtype` does not fire because People and
 * Organizations carry `AllowMultipleSubtypes = 1`. So a second promotion reaches the database and
 * dies on `PK_SalesAccount` / `PK_SalesContact` — a raw primary-key violation, with nothing in it a
 * rep could act on. The check below is what turns that into a sentence.
 *
 * @module @mj-biz-apps/sales-ng
 */
import { CompositeKey, Metadata, RunView, type BaseEntity } from '@memberjunction/core';
import { MJS_ENTITIES, MJS_FOREIGN_ENTITIES } from './entity-names';

/** Reads whether a row exists in an entity by ID. A seam so the gate tests without a provider. */
export type PartyRowReader = (entityName: string, id: string) => Promise<boolean | null>;

/**
 * Whether the Sales Account or Sales Contact row exists for this ID: true, false, or null when the
 * read failed. IsA means it shares the Organization's or Person's ID, so one read by ID answers it.
 */
export async function SalesPartyRowExists(entityName: string, id: string): Promise<boolean | null> {
    const result = await new RunView().RunView<{ ID: string }>({
        EntityName: entityName,
        ExtraFilter: `ID = '${id.replace(/'/g, "''")}'`,
        ResultType: 'simple',
        Fields: ['ID'],
    });
    if (!result?.Success) return null;
    return (result.Results ?? []).length > 0;
}

/** What a promotion did. Every arm is a sentence a surface can show without inventing copy. */
export type PromoteOutcome =
    | { Kind: 'Promoted'; ID: string }
    /** The subtype row was already there. Not an error — the rep's goal is already met. */
    | { Kind: 'AlreadyPromoted' }
    /** No parent row under that key. `AttachToParent` said so; nothing was written. */
    | { Kind: 'NoParent' }
    | { Kind: 'Failed'; Message: string };

/** What a promotion needs from the world. Replaced wholesale in tests. */
export interface PromoteDeps {
    ReadPartyRow: PartyRowReader;
    OpenChild: (entityName: string) => Promise<BaseEntity | null>;
}

const DEFAULT_DEPS: PromoteDeps = {
    ReadPartyRow: SalesPartyRowExists,
    OpenChild: (entityName) => new Metadata().GetEntityObject<BaseEntity>(entityName),
};

/** The two promotions this app offers, each naming the child entity and the parent it extends. */
export const PROMOTIONS = {
    Account: { Child: MJS_ENTITIES.SalesAccount, Parent: MJS_FOREIGN_ENTITIES.Organization },
    Contact: { Child: MJS_ENTITIES.SalesContact, Parent: MJS_FOREIGN_ENTITIES.Person },
} as const;

/**
 * Promotes one parent row into `childEntity`, setting only `fields`.
 *
 * A null or undefined value in `fields` is NOT written: the caller states what it knows, and an
 * absent Account Type must stay absent rather than become an empty string (D-PR1). `IsActive` and
 * `OptedOutOfOutreach` are the only NOT NULL columns on these two children and `NewRecord()` seeds
 * both from their field defaults, so nothing here needs to supply them — and nothing here may null
 * them out.
 *
 * A FAILED existence read refuses the promotion rather than trying anyway. That is deliberately the
 * opposite of the Deals panel's New gate, which fails open and lets the server name the case: here
 * the server's refusal would be a primary-key violation, so there is no good message to fall back on.
 */
export async function PromoteParty(
    childEntity: string,
    parentID: string,
    fields: Readonly<Record<string, unknown>> = {},
    deps: PromoteDeps = DEFAULT_DEPS,
): Promise<PromoteOutcome> {
    const id = String(parentID ?? '').trim();
    if (!id) return { Kind: 'Failed', Message: 'No record to promote.' };

    const exists = await deps.ReadPartyRow(childEntity, id);
    if (exists === true) return { Kind: 'AlreadyPromoted' };
    if (exists === null) {
        return { Kind: 'Failed', Message: 'Could not check whether it is already a sales record. Try again.' };
    }

    try {
        return await writeChild(childEntity, id, fields, deps);
    } catch (error) {
        return { Kind: 'Failed', Message: messageOf(error) };
    }
}

/** The write half, kept separate so the guard above reads as one thought. */
async function writeChild(
    childEntity: string,
    parentID: string,
    fields: Readonly<Record<string, unknown>>,
    deps: PromoteDeps,
): Promise<PromoteOutcome> {
    const child = await deps.OpenChild(childEntity);
    if (!child) return { Kind: 'Failed', Message: `Could not open ${childEntity}.` };

    child.NewRecord();
    if (!(await child.AttachToParent(CompositeKey.FromID(parentID)))) {
        return { Kind: 'NoParent' };
    }
    for (const [name, value] of Object.entries(fields)) {
        if (value !== null && value !== undefined) child.Set(name, value);
    }
    if (!(await child.Save())) {
        return { Kind: 'Failed', Message: child.LatestResult?.CompleteMessage || 'The save was refused.' };
    }
    return { Kind: 'Promoted', ID: String(child.Get('ID') ?? parentID) };
}

function messageOf(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'The promotion failed.';
}

/** What choosing the prospect type needs from an Account Type row. */
export interface AccountTypeFlagRow {
    ID: string;
    IsProspect: boolean;
    IsActive: boolean;
    DisplayRank?: number | null;
}

/**
 * The Account Type a promotion defaults to: the active row flagged `IsProspect` (D-PR1).
 *
 * BY FLAG, NEVER BY NAME. The row is called `Prospect` in the seeds and a deployment is free to
 * rename it; the engine must not notice (`pnpm run test:vocabulary-gate`). Returns null when no row
 * carries the flag, and the caller then leaves the field blank — a blank Account Type is legal, and
 * guessing one would assert a classification nobody chose.
 *
 * FILTERED, NOT COUNTED. "Exactly one row is flagged" is a statement about today's seeds, not about
 * the requirement. More than one is a seeding error this cannot fix, so it takes the lowest
 * `DisplayRank` and breaks ties on ID — a stable answer rather than whichever row the view returned
 * first.
 */
export function ProspectAccountTypeID(rows: readonly AccountTypeFlagRow[]): string | null {
    const candidates = rows
        .filter((r) => r.IsProspect && r.IsActive && String(r.ID ?? '').trim())
        .sort((a, b) => (a.DisplayRank ?? 0) - (b.DisplayRank ?? 0) || a.ID.localeCompare(b.ID));
    return candidates.length ? candidates[0].ID : null;
}

/** Reads the prospect Account Type. Null when the read fails as well as when no row is flagged. */
export async function ReadProspectAccountTypeID(): Promise<string | null> {
    const result = await new RunView().RunView<AccountTypeFlagRow>({
        EntityName: MJS_ENTITIES.AccountType,
        ResultType: 'simple',
        Fields: ['ID', 'IsProspect', 'IsActive', 'DisplayRank'],
    });
    if (!result?.Success) return null;
    return ProspectAccountTypeID(result.Results ?? []);
}
