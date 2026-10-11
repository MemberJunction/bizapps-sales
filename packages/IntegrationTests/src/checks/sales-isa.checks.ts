/**
 * @fileoverview `sales-isa` — IS1–IS9. MemberJunction's IS-A (table-per-type) contract, proven against a real
 * database through sales' own two subtypes: `SalesContact` IsA `common.Person` and `SalesAccount` IsA
 * `common.Organization`.
 *
 * WHY THIS BUNDLE EXISTS. Sales stores no name, email or company name of its own. A contact's identity is
 * a `Person` row, its CRM attributes are a `SalesContact` row under the SAME ID, and the machinery that
 * keeps those two rows one record is MemberJunction's, not ours. MJ proves that machinery only with MOCKED
 * unit tests — it has no IS-A entity of its own — so this is where it meets two real tables, two save
 * procedures, a view that joins them and a transaction around both. Its failure modes are the silent
 * kind this repo keeps meeting: an orphaned Person nobody can see,
 * a second Person where promotion should have reused the first, a Person deleted out from under another
 * app that still extends it. None of those throws, and none shows on a form.
 *
 * ── OVERLAPPING, NOT DISJOINT ────────────────────────────────────────────────────────────────────
 *
 * People and Organizations carry `AllowMultipleSubtypes = 1` (bizapps-common 5.33.0): the same human can
 * be a sales contact AND an applicant AND a member. That flag changes the contract, and these checks
 * assert the OVERLAPPING version of it — a loaded Person LISTS its subtypes instead of linking one, never
 * hands its save or delete to a child, and outlives a deleted subtype while another still holds it. Every
 * check asserts the flag first, so a host that lost it fails with that reason rather than with a chain of
 * wrong answers that each look like a different bug.
 *
 *   IS1  a Sales Contact built through the CHILD writes Person + SalesContact under one key
 *   IS2  a RunView on Sales Contacts filters and sorts on Person's columns
 *   IS3  a Person loaded through People lists its subtypes: ISAChildren, ISAChild null, LeafEntity itself
 *   IS4  promotion: an existing Person becomes a Sales Contact without a second Person
 *   IS5  promotion: an existing Organization becomes a Sales Account without a second Organization
 *   IS6  saving through People updates Person only; the save is not handed to the Sales Contact
 *   IS7  a SalesContact the DATABASE refuses after the Person was written leaves no Person behind
 *   IS8  deleting the Person's only subtype deletes the Person
 *   IS9  deleting one subtype leaves the Person while ANOTHER app's subtype still holds it
 *
 * ── TWO DEPARTURES FROM THE SUITE'S HABITS, BOTH DELIBERATE ─────────────────────────────────────
 *
 * IS7 does NOT run inside `InRolledBackTransaction`: a database refusal inside a savepoint can doom the
 * surrounding transaction, and the check has to read the database AFTER the refusal. Its own comment has
 * the reasoning; it cleans up after itself on the one path that can leave anything behind.
 *
 * IS9 SKIPS, with a warning, on a host where nothing but Sales Contacts extends People. Its claim needs a
 * second subtype and sales cannot supply one — it would have to name another app's entity. The skip
 * counts as a run in the tally, so read the warning, not the green.
 *
 * ⚠️ **REQUIRES bizapps-common** (People, Organizations) and nothing else — not orders. No deal is saved.
 *
 * ⚠️ **`RUN_MUTATION_TESTS=1` IS MANDATORY.** Every check writes. All but IS7 roll their transaction back.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { randomUUID } from 'node:crypto';

import {
    CompositeKey,
    EntityFieldTSType,
    LogError,
    RunView,
    type BaseEntity,
    type EntityFieldInfo,
    type EntityInfo,
} from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import type { mjBizAppsCommonOrganizationEntity, mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import type { mjBizAppsSalesSalesAccountEntity, mjBizAppsSalesSalesContactEntity } from '@mj-biz-apps/sales-entities';

import { E_ACCOUNT, InRolledBackTransaction, ProviderOf, TxOne } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_PERSON = 'MJ_BizApps_Common: People';
const E_ORGANIZATION = 'MJ_BizApps_Common: Organizations';
const E_CONTACT = 'MJ_BizApps_Sales: Sales Contacts';
const E_RECORD_CHANGE = 'MJ: Record Changes';

/**
 * How long a delete may take before the check calls it hung. Generous on purpose: this is not a
 * performance budget, it is the difference between one red check and a suite that never finishes.
 */
const DELETE_SETTLE_MS = 30_000;

// ─── Identity of a fixture ─────────────────────────────────────────────────────────────────────

/** A surname no other run shares, so every read below can be filtered to THIS check's rows. */
function uniqueSurname(check: string): string {
    return `${check}-${randomUUID().slice(0, 8)}`;
}

/** A reserved domain, so a leaked row is traceable to this bundle and can never reach a real inbox. */
function emailFor(surname: string): string {
    return `${surname.toLowerCase()}@example.invalid`;
}

/** Entity names compared the way `EntityByName` resolves them: trimmed and case-insensitive. */
function sameEntityName(a: string | null | undefined, b: string): boolean {
    return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

// ─── The precondition every check re-asserts ───────────────────────────────────────────────────

/**
 * The parent `childName` extends, asserted to be `parentName` AND to allow several subtypes.
 *
 * Called at the top of every check rather than once in Setup, so the claim is checked where it is USED
 * (CLAUDE.md rule 8). A check that assumed the flag would, on a host without it, report a disjoint
 * parent's behaviour as a failure of whatever it happened to be asserting.
 */
function overlappingParent(ctx: Ctx, childName: string, parentName: string): EntityInfo {
    const child = ProviderOf(ctx).EntityByName(childName);
    Assert(!!child, `setup: '${childName}' is not registered on this host`);
    const parent = child!.ParentEntityInfo;
    Assert(
        !!parent && sameEntityName(parent.Name, parentName),
        `setup: '${childName}' must be an IS-A child of '${parentName}', but its parent is ` +
            `'${parent?.Name ?? 'none'}'. codegen-schema-info.json declares the link; a host whose ` +
            'metadata lacks it never ran that CodeGen pass.',
    );
    Assert(
        parent!.AllowMultipleSubtypes === true,
        `setup: '${parentName}' must allow several subtypes (AllowMultipleSubtypes = 1, shipped by ` +
            'bizapps-common 5.33.0). This bundle asserts the OVERLAPPING contract; on a disjoint parent the ' +
            'first app to extend it takes the only slot (docs/KNOWN-ISSUES.md KI-1).',
    );
    return parent!;
}

// ─── Reading the TABLES, not the views ─────────────────────────────────────────────────────────

/** `[schema].[table]` for an entity, from its metadata rather than a hard-coded schema name. */
function tableOf(ctx: Ctx, entityName: string): string {
    const info = ProviderOf(ctx).EntityByName(entityName);
    Assert(!!info, `setup: '${entityName}' is not registered on this host`);
    return `[${info!.SchemaName}].[${info!.BaseTable}]`;
}

/*
 * Every reader below is COUNT + MAX filtered to one key or one fixture value, so an ABSENT row is an
 * answer (N = 0) instead of `TxOne` throwing, and N is a statement about this check's own row rather
 * than a count of the table. They read the BASE TABLES on purpose: "the person's name landed in
 * Person" is a claim about where a value is stored, which a view that joins both tables cannot make.
 */
type PersonRow = { N: number; FirstName: string | null; LastName: string | null; Email: string | null; Title: string | null };
type SalesContactRow = { N: number; Seniority: string | null; UpdatedAt: string | null };
type OrganizationRow = { N: number; ID: string | null; Email: string | null };
type SalesAccountRow = { N: number; Territory: string | null };
type KeyRow = { N: number; ID: string | null };

/** What IS2 asks the Sales Contacts VIEW for. Three of these columns are stored only in Person's table. */
type ContactViewRow = { ID: string; FirstName: string; LastName: string; Email: string | null; Seniority: string | null };

async function personRow(ctx: Ctx, id: string): Promise<PersonRow> {
    return TxOne<PersonRow>(
        ctx,
        'SELECT COUNT(*) AS N, MAX(FirstName) AS FirstName, MAX(LastName) AS LastName, ' +
            `MAX(Email) AS Email, MAX(Title) AS Title FROM ${tableOf(ctx, E_PERSON)} WHERE ID = '${id}'`,
    );
}

async function salesContactRow(ctx: Ctx, id: string): Promise<SalesContactRow> {
    return TxOne<SalesContactRow>(
        ctx,
        // __mj_UpdatedAt as ISO-8601 TEXT, so "the row was not rewritten" compares the stored value at
        // its full precision rather than whatever a JavaScript Date keeps of it.
        'SELECT COUNT(*) AS N, MAX(Seniority) AS Seniority, ' +
            'MAX(CONVERT(NVARCHAR(40), __mj_UpdatedAt, 127)) AS UpdatedAt ' +
            `FROM ${tableOf(ctx, E_CONTACT)} WHERE ID = '${id}'`,
    );
}

/** How many Person rows carry the fixture's own address — the promotion claim is "still exactly one". */
async function peopleWithEmail(ctx: Ctx, email: string): Promise<KeyRow> {
    return TxOne<KeyRow>(
        ctx,
        'SELECT COUNT(*) AS N, MAX(CONVERT(NVARCHAR(36), ID)) AS ID ' +
            `FROM ${tableOf(ctx, E_PERSON)} WHERE Email = '${email}'`,
    );
}

async function organizationsNamed(ctx: Ctx, name: string): Promise<OrganizationRow> {
    return TxOne<OrganizationRow>(
        ctx,
        'SELECT COUNT(*) AS N, MAX(CONVERT(NVARCHAR(36), ID)) AS ID, MAX(Email) AS Email ' +
            `FROM ${tableOf(ctx, E_ORGANIZATION)} WHERE Name = '${name}'`,
    );
}

async function salesAccountRow(ctx: Ctx, id: string): Promise<SalesAccountRow> {
    return TxOne<SalesAccountRow>(
        ctx,
        `SELECT COUNT(*) AS N, MAX(Territory) AS Territory FROM ${tableOf(ctx, E_ACCOUNT)} WHERE ID = '${id}'`,
    );
}

/**
 * How many 'Update' entries a record's change history holds that mention `field`, keyed the way MJ keys
 * them (`CompositeKey` URL form, `ID|<value>`). UPPER on both sides because the key was written from
 * whatever case the provider held the value in.
 */
async function historyUpdatesMentioning(ctx: Ctx, entity: EntityInfo, id: string, field: string): Promise<number> {
    const recordID = CompositeKey.FromID(id).ToURLSegment();
    const found = await TxOne<{ N: number }>(
        ctx,
        `SELECT COUNT(*) AS N FROM ${tableOf(ctx, E_RECORD_CHANGE)} ` +
            `WHERE EntityID = '${entity.ID}' AND UPPER(RecordID) = UPPER('${recordID}') ` +
            `AND Type = 'Update' AND ChangesJSON LIKE '%"${field}"%'`,
    );
    return Number(found.N);
}

/** Rows of ANY entity under one key — IS9's sibling is only known from metadata, so it gets no row type. */
async function rowsUnderKey(ctx: Ctx, entity: EntityInfo, id: string): Promise<number> {
    const found = await TxOne<{ N: number }>(
        ctx,
        `SELECT COUNT(*) AS N FROM [${entity.SchemaName}].[${entity.BaseTable}] ` +
            `WHERE [${entity.FirstPrimaryKey.Name}] = '${id}'`,
    );
    return Number(found.N);
}

// ─── Building and loading records ──────────────────────────────────────────────────────────────

async function saveOrFail(entity: BaseEntity, what: string): Promise<void> {
    Assert(await entity.Save(), `${what} failed — ${entity.LatestResult?.CompleteMessage ?? 'unknown error'}`);
}

/**
 * A NEW Sales Contact built through the CHILD, unsaved. The Person's columns are set ON THE CHILD: the
 * chain routes each one to the parent, which is the half of the contract IS1 turns on.
 */
async function newContact(ctx: Ctx, surname: string, firstName = 'Ada'): Promise<mjBizAppsSalesSalesContactEntity> {
    const contact = await ProviderOf(ctx).GetEntityObject<mjBizAppsSalesSalesContactEntity>(E_CONTACT, ctx.User);
    contact.NewRecord();
    contact.FirstName = firstName;
    contact.LastName = surname;
    contact.Email = emailFor(surname);
    return contact;
}

async function loadContact(ctx: Ctx, id: string): Promise<mjBizAppsSalesSalesContactEntity> {
    const contact = await ProviderOf(ctx).GetEntityObject<mjBizAppsSalesSalesContactEntity>(E_CONTACT, ctx.User);
    Assert(await contact.Load(id), `the Sales Contact ${id} could not be loaded`);
    return contact;
}

/** A Person created the PLAIN way, through People — no subtype, which is what a promotion starts from. */
async function newPlainPerson(ctx: Ctx, surname: string): Promise<mjBizAppsCommonPersonEntity> {
    const person = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonPersonEntity>(E_PERSON, ctx.User);
    person.NewRecord();
    person.FirstName = 'Grace';
    person.LastName = surname;
    person.Email = emailFor(surname);
    person.Title = 'Chief Engineer';
    await saveOrFail(person, 'setup: saving a plain Person through People');
    return person;
}

async function loadPerson(ctx: Ctx, id: string): Promise<mjBizAppsCommonPersonEntity> {
    const person = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonPersonEntity>(E_PERSON, ctx.User);
    Assert(await person.Load(id), `the Person ${id} could not be loaded through ${E_PERSON}`);
    return person;
}

async function newPlainOrganization(ctx: Ctx, name: string): Promise<mjBizAppsCommonOrganizationEntity> {
    const org = await ProviderOf(ctx).GetEntityObject<mjBizAppsCommonOrganizationEntity>(E_ORGANIZATION, ctx.User);
    org.NewRecord();
    org.Name = name;
    org.Email = emailFor(name);
    await saveOrFail(org, 'setup: saving a plain Organization through Organizations');
    return org;
}

/**
 * Awaits `work`, or fails after `ms` with a message naming what hung.
 *
 * WHY A RACE. MJ#4850 (fixed in MJ#4891): an IS-A delete handed to the leaf waited on its own pending
 * delete and never returned. A check that awaits such a delete plainly does not fail — it stalls every
 * bundle queued behind it, and the run reads as a hang with no cause. The race turns that into one red
 * check with a reason.
 */
async function settlesWithin<T>(work: Promise<T>, what: string, ms = DELETE_SETTLE_MS): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`${what} did not settle within ${ms / 1000}s — the IS-A delete chain is waiting on itself (MJ#4850)`)),
            ms,
        );
    });
    try {
        return await Promise.race([work, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

// ─── IS7's safety net ──────────────────────────────────────────────────────────────────────────

/**
 * Removes whatever IS7's refused save left under `id`. On a passing run there is nothing: the rollback
 * already removed it. It only finds work when IS7 has ALREADY FAILED, and then it keeps a failure of the
 * rollback from becoming a Person that outlives the run.
 *
 * Errors are logged with the key, never thrown: throwing from a `finally` would replace IS7's real
 * failure with a cleanup error that explains less.
 */
async function removeIS7Leftovers(ctx: Ctx, id: string): Promise<void> {
    try {
        const provider = ProviderOf(ctx);
        if ((await rowsUnderKey(ctx, provider.EntityByName(E_CONTACT)!, id)) > 0) {
            // Deleting the Sales Contact takes its Person with it — IS8's claim.
            const contact = await loadContact(ctx, id);
            if (!(await contact.Delete())) {
                LogError(`sales-isa.IS7 cleanup: Sales Contact ${id} is left behind — ${contact.LatestResult?.CompleteMessage}`);
            }
            return;
        }
        if ((await rowsUnderKey(ctx, provider.EntityByName(E_PERSON)!, id)) > 0) {
            const person = await loadPerson(ctx, id);
            if (!(await person.Delete())) {
                LogError(`sales-isa.IS7 cleanup: Person ${id} is left behind — ${person.LatestResult?.CompleteMessage}`);
            }
        }
    } catch (e) {
        LogError(`sales-isa.IS7 cleanup: could not check or remove rows under ${id}; delete them by hand. ${e instanceof Error ? e.message : String(e)}`);
    }
}

// ─── IS9's sibling: another app's subtype, discovered rather than named ────────────────────────

/**
 * Another subtype of People that this user may create, chosen from METADATA at run time.
 *
 * Sales cannot name one and must not: naming an ATS or membership entity here would be the coupling the
 * shared Person exists to avoid. Sorted by name so the choice is the same on every run of one host.
 */
function siblingSubtype(ctx: Ctx, people: EntityInfo): EntityInfo | null {
    const candidates = people.ChildEntities
        .filter((child) => !sameEntityName(child.Name, E_CONTACT))
        .filter((child) => child.AllowCreateAPI && child.GetUserPermisions(ctx.User)?.CanCreate === true)
        .sort((a, b) => a.Name.localeCompare(b.Name));
    return candidates[0] ?? null;
}

/**
 * The sibling's own columns a create must supply: NOT NULL, no default, and stored in ITS table.
 * `IsVirtual` excludes the Person's columns the sibling's view mirrors — the Person already has them.
 */
function requiredOwnFields(entity: EntityInfo): EntityFieldInfo[] {
    return entity.Fields.filter(
        (f) =>
            !f.AllowsNull &&
            !f.IsPrimaryKey &&
            !f.IsVirtual &&
            !f.IsSpecialDateField &&
            !f.AutoIncrement &&
            !f.IsComputed &&
            !(f.DefaultValue ?? '').trim(),
    );
}

/** An existing row's key for a required foreign key — a random value would fail the FK, not the check. */
async function existingKeyFor(ctx: Ctx, field: EntityFieldInfo): Promise<string | number> {
    const key = field.RelatedEntityFieldName || 'ID';
    const r = await new RunView().RunView<Record<string, string | number>>(
        { EntityName: field.RelatedEntity, Fields: [key], OrderBy: `${key} ASC`, MaxRows: 1, ResultType: 'simple' },
        ctx.User,
    );
    Assert(r.Success, `setup: reading ${field.RelatedEntity} for ${field.Entity}.${field.Name} failed — ${r.ErrorMessage}`);
    const value = (r.Results ?? [])[0]?.[key];
    Assert(value != null, `setup: ${field.Entity}.${field.Name} must reference a ${field.RelatedEntity} row, and this host has none`);
    return value!;
}

/**
 * A value that satisfies one required column of an entity this package has no class for. Deliberately
 * dull — the sibling's content is not under test, only that its row exists beside the Sales Contact.
 */
async function fillerFor(ctx: Ctx, field: EntityFieldInfo): Promise<string | number | boolean | Date> {
    if (field.RelatedEntity) {
        return existingKeyFor(ctx, field);
    }
    const listed = [...(field.EntityFieldValues ?? [])].sort((a, b) => a.Sequence - b.Sequence)[0];
    if (listed) {
        return listed.Value;
    }
    if (field.Type.trim().toLowerCase() === 'uniqueidentifier') {
        return randomUUID();
    }
    if (field.TSType === EntityFieldTSType.Number) {
        return 0;
    }
    if (field.TSType === EntityFieldTSType.Boolean) {
        return false;
    }
    if (field.TSType === EntityFieldTSType.Date) {
        return new Date();
    }
    return 'IS9';
}

/**
 * Adds a row of `sibling` under an EXISTING Person — by promotion, the only way a second subtype joins a
 * Person that already exists.
 *
 * `.Set()` BY NAME IS DELIBERATE HERE, and the one place in this bundle it appears. The sibling is found
 * in metadata at run time, so there is no generated class in this package to type it against — and
 * importing one would name another app, which `siblingSubtype` exists to avoid.
 */
async function addSiblingRow(ctx: Ctx, sibling: EntityInfo, personID: string): Promise<void> {
    const branch = await ProviderOf(ctx).GetEntityObject<BaseEntity>(sibling.Name, ctx.User);
    branch.NewRecord();
    Assert(
        await branch.AttachToParent(CompositeKey.FromID(personID)),
        `setup: ${sibling.Name}.AttachToParent found no Person ${personID} to extend`,
    );
    for (const field of requiredOwnFields(sibling)) {
        branch.Set(field.Name, await fillerFor(ctx, field));
    }
    await saveOrFail(
        branch,
        `setup: adding a ${sibling.Name} row beside the Sales Contact (its required columns are filled ` +
            'generically; a subtype with rules this cannot guess needs its own fixture)',
    );
}

export const SalesIsaChecks: NamedCheck[] = [
    {
        Id: 'sales-isa.IS1',
        Name: 'IS1: a Sales Contact built through the child writes Person + SalesContact under ONE key, the person columns in Person',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                overlappingParent(ctx, E_CONTACT, E_PERSON);
                const surname = uniqueSurname('IS1');
                const contact = await newContact(ctx, surname);
                contact.Seniority = 'Director';

                const parent = contact.ISAParent;
                Assert(!!parent, 'GetEntityObject on an IS-A child wires its parent before any data operation');
                Assert(
                    UUIDsEqual(parent!.PrimaryKey.Values(), contact.ID),
                    'NewRecord on the child starts ONE chain: the parent already holds the key the child reports',
                );
                const all: { FirstName?: string } = contact.GetAll();
                AssertEqual(all.FirstName, 'Ada', "GetAll() on the child includes the parent's fields");

                /**
                 * MJ#4870 (fixed in MJ#4891) made a DISJOINT parent that its child built link back to that
                 * child, so the parent's LeafEntity is the child. These two assertions keep that fix where it
                 * belongs: a parent that allows several subtypes keeps no single child. Were it linked, a save
                 * through People would be handed to whichever subtype happened to build it (MJ's own
                 * `baseEntity.isa.child.test.ts`: "a parent that allows several subtypes still returns itself
                 * as LeafEntity" — this is the same claim against a real chain).
                 */
                Assert(parent!.LeafEntity === parent, "the Person's LeafEntity is the Person, not the Sales Contact that built it");
                Assert(parent!.ISAChild === null, 'and it links no single child');

                await saveOrFail(contact, 'saving the new Sales Contact');

                const person = await personRow(ctx, contact.ID);
                AssertEqual(Number(person.N), 1, "a Person row exists under the Sales Contact's own ID");
                AssertEqual(person.FirstName, 'Ada', "the name set on the CHILD was written to the PARENT's table");
                AssertEqual(person.LastName, surname, 'the surname too');
                AssertEqual(person.Email, emailFor(surname), 'and the email');

                const own = await salesContactRow(ctx, contact.ID);
                AssertEqual(Number(own.N), 1, 'a SalesContact row exists under the SAME ID');
                AssertEqual(own.Seniority, 'Director', "the child's own column was written to the child's table");
            }),
    },
    {
        Id: 'sales-isa.IS2',
        Name: "IS2: a RunView on Sales Contacts filters and sorts on the Person's columns — the child view carries the parent",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * Every contact picker, grid and report in sales reads Sales Contacts by NAME, and the name
                 * lives only in Person. CodeGen joins Person into the child's view and mirrors its columns as
                 * virtual fields; if that join were missing or wrong, filtering on a name would fail — or,
                 * worse, silently match nothing, which a picker shows as "no contacts".
                 */
                overlappingParent(ctx, E_CONTACT, E_PERSON);
                const surname = uniqueSurname('IS2');
                const ada = await newContact(ctx, surname, 'Ada');
                ada.Seniority = 'Manager';
                await saveOrFail(ada, 'setup: saving the first Sales Contact');
                const zed = await newContact(ctx, surname, 'Zed');
                zed.Seniority = 'Director';
                await saveOrFail(zed, 'setup: saving the second Sales Contact');

                const r = await new RunView().RunView<ContactViewRow>(
                    {
                        EntityName: E_CONTACT,
                        ExtraFilter: `LastName = '${surname}'`,
                        OrderBy: 'FirstName DESC',
                        Fields: ['ID', 'FirstName', 'LastName', 'Email', 'Seniority'],
                        ResultType: 'simple',
                    },
                    ctx.User,
                );
                Assert(r.Success, `RunView on ${E_CONTACT} filtered on a Person column failed — ${r.ErrorMessage}`);
                const rows = r.Results ?? [];

                const adaAt = rows.findIndex((row) => UUIDsEqual(row.ID, ada.ID));
                const zedAt = rows.findIndex((row) => UUIDsEqual(row.ID, zed.ID));
                Assert(adaAt >= 0 && zedAt >= 0, 'both contacts are found by filtering on LastName, a column only Person stores');

                const adaRow = rows[adaAt];
                AssertEqual(adaRow.FirstName, 'Ada', "the Person's first name reads through the child's view");
                AssertEqual(adaRow.Email, emailFor(surname), 'and its email');
                AssertEqual(adaRow.Seniority, 'Manager', "with the child's own column beside them");
                Assert(zedAt < adaAt, 'ORDER BY FirstName DESC — a Person column — puts Zed before Ada');
            }),
    },
    {
        Id: 'sales-isa.IS3',
        Name: 'IS3: a Person loaded through People lists its subtypes — ISAChildren names Sales Contacts, ISAChild is null, LeafEntity is the Person',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                overlappingParent(ctx, E_CONTACT, E_PERSON);
                const contact = await newContact(ctx, uniqueSurname('IS3'));
                await saveOrFail(contact, 'setup: saving the Sales Contact');

                const person = await loadPerson(ctx, contact.ID);
                const listed = person.ISAChildren;
                Assert(Array.isArray(listed), 'loading an overlapping parent runs subtype discovery: ISAChildren is a list, not null');
                Assert(
                    (listed ?? []).some((c) => sameEntityName(c.entityName, E_CONTACT)),
                    `ISAChildren names ${E_CONTACT} for a Person with a SalesContact row — got ${JSON.stringify(listed)}`,
                );
                Assert(person.ISAChild === null, 'an overlapping parent links NO single child, whatever subtypes exist');
                Assert(person.LeafEntity === person, 'so LeafEntity is the Person itself — a save or delete on it has nothing to hand down');

                /**
                 * THE CONTROL. Without it, a discovery that listed Sales Contacts for EVERY Person — reading
                 * the metadata instead of the rows — would pass everything above.
                 */
                const plain = await newPlainPerson(ctx, uniqueSurname('IS3-plain'));
                const reloaded = await loadPerson(ctx, plain.ID);
                Assert(Array.isArray(reloaded.ISAChildren), 'discovery ran for the plain Person too');
                Assert(
                    !(reloaded.ISAChildren ?? []).some((c) => sameEntityName(c.entityName, E_CONTACT)),
                    'a Person with no SalesContact row does not list Sales Contacts — the list comes from rows, not metadata',
                );
            }),
    },
    {
        Id: 'sales-isa.IS4',
        Name: 'IS4: an EXISTING Person is promoted to a Sales Contact — AttachToParent binds it and the save adds only the SalesContact row',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * Promotion is the NORMAL case in a multi-app install: a Person usually exists before sales
                 * meets them — an applicant, a member, an email sender. Before `AttachToParent`, NewRecord
                 * always started a fresh chain, so "this Person is now a contact" inserted a SECOND Person.
                 * Nothing failed; the CRM simply grew a duplicate human.
                 */
                overlappingParent(ctx, E_CONTACT, E_PERSON);
                const surname = uniqueSurname('IS4');
                const person = await newPlainPerson(ctx, surname);

                const contact = await ProviderOf(ctx).GetEntityObject<mjBizAppsSalesSalesContactEntity>(E_CONTACT, ctx.User);
                contact.NewRecord();
                Assert(
                    await contact.AttachToParent(CompositeKey.FromID(person.ID)),
                    'AttachToParent returns true when the Person row exists',
                );
                Assert(UUIDsEqual(contact.ID, person.ID), 'the child adopted the EXISTING key, not the one NewRecord minted');
                AssertEqual(contact.FirstName, 'Grace', "the parent chain LOADED: the Person's values read through the child");

                contact.Seniority = 'VP';
                await saveOrFail(contact, 'saving the promoted Sales Contact');

                const people = await peopleWithEmail(ctx, emailFor(surname));
                AssertEqual(Number(people.N), 1, 'still ONE Person with this address — promotion must not insert a second');
                Assert(UUIDsEqual(people.ID, person.ID), 'and it is the ORIGINAL Person');

                const after = await personRow(ctx, person.ID);
                AssertEqual(after.FirstName, 'Grace', 'the Person kept its values');
                AssertEqual(after.Title, 'Chief Engineer', 'all of them');

                const own = await salesContactRow(ctx, person.ID);
                AssertEqual(Number(own.N), 1, "a SalesContact row now exists under the Person's ID");
                AssertEqual(own.Seniority, 'VP', "carrying the child's own column");
            }),
    },
    {
        Id: 'sales-isa.IS5',
        Name: 'IS5: an EXISTING Organization is promoted to a Sales Account — no second Organization, one SalesAccount row',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /** IS4's claim on the other IS-A extension. A company is even likelier to predate its account. */
                overlappingParent(ctx, E_ACCOUNT, E_ORGANIZATION);
                const name = uniqueSurname('IS5');
                const org = await newPlainOrganization(ctx, name);

                const account = await ProviderOf(ctx).GetEntityObject<mjBizAppsSalesSalesAccountEntity>(E_ACCOUNT, ctx.User);
                account.NewRecord();
                Assert(
                    await account.AttachToParent(CompositeKey.FromID(org.ID)),
                    'AttachToParent returns true when the Organization row exists',
                );
                Assert(UUIDsEqual(account.ID, org.ID), 'the child adopted the EXISTING key');
                AssertEqual(account.Name, name, "the Organization's values read through the child");

                account.Territory = 'IS5 territory';
                await saveOrFail(account, 'saving the promoted Sales Account');

                const orgs = await organizationsNamed(ctx, name);
                AssertEqual(Number(orgs.N), 1, 'still ONE Organization with this name — promotion must not insert a second');
                Assert(UUIDsEqual(orgs.ID, org.ID), 'and it is the ORIGINAL Organization');
                AssertEqual(orgs.Email, emailFor(name), 'with its values as they were');

                const own = await salesAccountRow(ctx, org.ID);
                AssertEqual(Number(own.N), 1, "a SalesAccount row now exists under the Organization's ID");
                AssertEqual(own.Territory, 'IS5 territory', "carrying the child's own column");
            }),
    },
    {
        Id: 'sales-isa.IS6',
        Name: 'IS6: saving the Person through People updates Person only — an overlapping parent does not hand its save to the Sales Contact',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * A DISJOINT parent with a linked child hands its save to the leaf, which saves the whole
                 * chain. An overlapping parent must not: it has several children, and whichever it picked
                 * would be pulled into an edit that never touched it — its permissions checked (a user who may
                 * edit People but not Sales Contacts would be refused), its validation and save hooks run.
                 * Other apps edit this Person through People every day; sales must not hear about each one.
                 */
                const people = overlappingParent(ctx, E_CONTACT, E_PERSON);
                const contactInfo = ProviderOf(ctx).EntityByName(E_CONTACT)!;
                Assert(
                    people.TrackRecordChanges === true && contactInfo.TrackRecordChanges === true,
                    `setup: ${E_PERSON} and ${E_CONTACT} both ship with TrackRecordChanges = 1; without it this ` +
                        'save leaves no history to tell a direct save from a delegated one',
                );
                const contact = await newContact(ctx, uniqueSurname('IS6'), 'Before');
                contact.Seniority = 'Director';
                await saveOrFail(contact, 'setup: saving the Sales Contact');
                const before = await salesContactRow(ctx, contact.ID);
                AssertEqual(Number(before.N), 1, 'setup: the SalesContact row exists');

                const person = await loadPerson(ctx, contact.ID);
                Assert(
                    person.ISAChild === null && person.LeafEntity === person,
                    'the loaded Person holds no single child, so its Save has nothing to delegate to',
                );
                person.FirstName = 'After';
                await saveOrFail(person, 'saving the Person through People');

                AssertEqual((await personRow(ctx, contact.ID)).FirstName, 'After', 'the Person row took the change');

                const after = await salesContactRow(ctx, contact.ID);
                AssertEqual(after.Seniority, 'Director', "the SalesContact's own column is untouched");
                AssertEqual(after.UpdatedAt, before.UpdatedAt, 'and its row was not rewritten — __mj_UpdatedAt is as it was');

                /**
                 * THE DISCRIMINATING HALF — and the row stamp above is NOT it, which is worth knowing before
                 * anyone leans on it. A save handed to the contact would write the Person first, find the
                 * contact clean afterwards and skip its SQL, so the SalesContact row would look untouched
                 * either way. What differs is the HISTORY. A save made directly on an overlapping parent
                 * writes its change into every subtype branch that has a row
                 * (`PropagateRecordChangesToSiblings`), because no branch initiated it; a save made through
                 * the contact names that branch as the initiator and skips it. One entry: a direct save.
                 * None: the save went through the child.
                 */
                AssertEqual(
                    await historyUpdatesMentioning(ctx, contactInfo, contact.ID, 'FirstName'),
                    1,
                    "the Person's change reached the Sales Contact's history exactly once, as a change made " +
                        'directly to the parent',
                );
            }),
    },
    {
        Id: 'sales-isa.IS7',
        Name: 'IS7: a SalesContact the DATABASE refuses after the Person was written fails the save and leaves NO Person row',
        RequiresMutation: true,
        Fn: async (ctx) => {
            /**
             * THE ATOMICITY CLAIM. The chain saves parent-first inside one transaction scope, so the Person
             * INSERT has already run when the SalesContact INSERT is refused. If the scope did not roll it
             * back, every failed contact save would leave a stray Person in the graph every app shares.
             *
             * THE REFUSAL COMES FROM THE DATABASE, on purpose. A random `BuyingRoleTypeID` passes MJ's
             * client-side validation — nothing there checks that a foreign key names a row — so the save
             * gets as far as `spCreateSalesContact` and FK_SalesContact_BuyingRoleType refuses it there,
             * after the Person INSERT. A validation failure would stop before any SQL and prove nothing.
             *
             * WHY THIS CHECK IS NOT INSIDE `InRolledBackTransaction`. There the chain's scope would be a
             * SAVEPOINT, and a statement error raised through the provider's INSERT ... EXEC can leave SQL
             * Server's transaction uncommittable. Rolling back to the savepoint then fails, the provider
             * abandons the whole physical transaction and refuses further work on it
             * (`HandleFailedSavepointRollback` → `DoomedTransactionError`) — so the reads below would throw
             * for a reason that is not the claim. With no ambient transaction the scope IS the physical
             * transaction, its rollback is a plain ROLLBACK, and the reads see committed state: exactly the
             * question "was anything left behind?". MJ's own `entity-graph.EG7` runs its rollback check the
             * same way. Nothing commits on a passing run; `removeIS7Leftovers` handles the failing one.
             */
            overlappingParent(ctx, E_CONTACT, E_PERSON);
            const contact = await newContact(ctx, uniqueSurname('IS7'));
            const id = contact.ID;
            contact.BuyingRoleTypeID = randomUUID();
            try {
                Assert(!(await contact.Save()), 'a Sales Contact whose own row the database refuses must not report success');

                const message = contact.LatestResult?.CompleteMessage ?? '';
                Assert(
                    message.includes('FK_SalesContact_BuyingRoleType'),
                    `the failure is the SalesContact's own write, refused by its foreign key — got: ${message}`,
                );
                /**
                 * PROOF THE PERSON WAS WRITTEN FIRST, or nothing here tests a rollback. The refusal above
                 * names the SalesContact's own foreign key, and the chain reaches the SalesContact INSERT
                 * only after the Person's save has returned true, so the Person INSERT had already run.
                 *
                 * The Person OBJECT is deliberately not asserted. After the rollback MJ still marks it saved
                 * under a key whose row no longer exists (nothing restores the parent's in-memory state when
                 * the chain's scope rolls back), so retrying the same object would fail. That is a defect to
                 * fix in MemberJunction, not a contract to pin here.
                 */
                Assert(!contact.IsSaved, 'the SalesContact object does not report itself saved');

                AssertEqual(Number((await personRow(ctx, id)).N), 0, 'the Person INSERT was rolled back with the refused SalesContact — no orphan');
                AssertEqual(Number((await salesContactRow(ctx, id)).N), 0, 'and no SalesContact row exists either');
            } finally {
                await removeIS7Leftovers(ctx, id);
            }
        },
    },
    {
        Id: 'sales-isa.IS8',
        Name: "IS8: deleting a Sales Contact that is its Person's ONLY subtype deletes the Person too",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * The contact deletes its own row first (the FK runs child → parent), then asks the database
                 * whether any OTHER subtype still holds the Person; with none, it deletes the Person.
                 *
                 * The race is insurance, and this delete cannot reproduce MJ#4850 itself: that hang needed a
                 * delete that STARTS on a disjoint parent and is handed to its leaf, and People never hands
                 * anything down. The call back up to the Person does take the bypass MJ#4891 added for it
                 * (`IsParentEntityDelete` skips the pending-delete debounce), and a regression there would
                 * otherwise stall every bundle after this one.
                 */
                const people = overlappingParent(ctx, E_CONTACT, E_PERSON);
                Assert(
                    people.GetUserPermisions(ctx.User)?.CanDelete === true,
                    `setup: the acting user may not delete ${E_PERSON} (bizapps-common grants that to the ` +
                        "Integration role only), so the contact's delete could not remove its Person",
                );
                const created = await newContact(ctx, uniqueSurname('IS8'));
                await saveOrFail(created, 'setup: saving the Sales Contact');

                // A FRESH load, the way any caller holding only an ID has it.
                const contact = await loadContact(ctx, created.ID);
                const deleted = await settlesWithin(contact.Delete(), 'deleting the Sales Contact');
                Assert(deleted, `deleting the Sales Contact failed — ${contact.LatestResult?.CompleteMessage ?? 'unknown error'}`);

                AssertEqual(Number((await salesContactRow(ctx, created.ID)).N), 0, 'the SalesContact row is gone');
                AssertEqual(
                    Number((await personRow(ctx, created.ID)).N),
                    0,
                    'and, with no other subtype holding it, so is the Person — it existed only to be this contact',
                );
            }),
    },
    {
        Id: 'sales-isa.IS9',
        Name: "IS9: deleting a Sales Contact leaves its Person while ANOTHER app's subtype still holds it",
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                /**
                 * THE REASON THE FLAG EXISTS. A human is routinely a sales contact AND an applicant AND a
                 * member; retiring them as a contact must not delete the person the other apps still hold.
                 * It is also the test that README.md's Identity section asks for: two children attached to
                 * one Person and both read back.
                 */
                const people = overlappingParent(ctx, E_CONTACT, E_PERSON);
                const sibling = siblingSubtype(ctx, people);
                if (!sibling) {
                    const children = people.ChildEntities.map((c) => c.Name).join(', ') || 'none';
                    console.warn(
                        `  ⚠ sales-isa.IS9 SKIPPED — nothing but ${E_CONTACT} extends ${E_PERSON} here that this user ` +
                            `may create (its subtypes: ${children}). Link another app that extends People — ` +
                            "bizapps-ats' Applicants does — to run it.",
                    );
                    return;
                }

                const contact = await newContact(ctx, uniqueSurname('IS9'));
                await saveOrFail(contact, 'setup: saving the Sales Contact');
                await addSiblingRow(ctx, sibling, contact.ID);

                const listed = (await loadPerson(ctx, contact.ID)).ISAChildren ?? [];
                for (const name of [E_CONTACT, sibling.Name]) {
                    Assert(
                        listed.some((c) => sameEntityName(c.entityName, name)),
                        `the Person lists BOTH subtypes before the delete — ${name} is missing from ${JSON.stringify(listed)}`,
                    );
                }

                const fresh = await loadContact(ctx, contact.ID);
                const deleted = await settlesWithin(fresh.Delete(), `deleting the Sales Contact beside a ${sibling.Name} row`);
                Assert(deleted, `deleting the Sales Contact failed — ${fresh.LatestResult?.CompleteMessage ?? 'unknown error'}`);

                AssertEqual(Number((await salesContactRow(ctx, contact.ID)).N), 0, 'the SalesContact row is gone');
                AssertEqual(
                    Number((await personRow(ctx, contact.ID)).N),
                    1,
                    `the Person STAYS — the ${sibling.Name} row still holds it`,
                );
                AssertEqual(await rowsUnderKey(ctx, sibling, contact.ID), 1, `and the ${sibling.Name} row is untouched`);
            }),
    },
];

for (const check of SalesIsaChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('sales-isa', {
    Setup: async () => {
        // Nothing to create: every check builds its own Person or Organization.
    },
    Teardown: async () => {
        // Nothing to sweep: IS1–IS6, IS8 and IS9 rolled back, and IS7 removes anything its failure left.
    },
});
