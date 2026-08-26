/**
 * @fileoverview The activity vocabulary, and the one convention decision the whole feature turns on.
 *
 * Every union in this file is a CHECK constraint in `__mj_BizAppsCommon`, read off the live schema
 * rather than guessed. They are declared as union types, not enums, so the values cross a package
 * boundary as plain strings — and so a value the database would refuse cannot be constructed here.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */

/** `CK_Activity_Direction`. */
export type ActivityDirection = 'Inbound' | 'Outbound' | 'Internal';

/** `CK_Activity_Status`. */
export type ActivityStatus = 'Logged' | 'Scheduled' | 'Completed' | 'Cancelled' | 'Failed';

/** `CK_Activity_Source`. Sales writes `Manual` by hand and `Integration` from the ingest. */
export type ActivitySource = 'Manual' | 'System' | 'Integration';

/** `CK_Activity_Visibility`. */
export type ActivityVisibility = 'Internal' | 'Private';

/** `CK_Activity_Outcome`. Nullable — most activities have no outcome to state. */
export type ActivityOutcome =
    | 'Connected'
    | 'LeftVoicemail'
    | 'NoAnswer'
    | 'NoShow'
    | 'Bounced'
    | 'Interested'
    | 'NotInterested';

/** `CK_ActivityLink_Role`. */
export type ActivityLinkRole =
    | 'Regarding'
    | 'Participant'
    | 'From'
    | 'To'
    | 'Cc'
    | 'Bcc'
    | 'Organizer'
    | 'Attendee'
    | 'LoggedFor';

/** `CK_ActivityLink_IdentityKind` — the unresolved half of a link. */
export type ActivityIdentityKind = 'Email' | 'Phone' | 'ExternalUser';

/**
 * The seeded `ActivityType.Code` values.
 *
 * RESOLVED BY CODE, NEVER BY NAME. `Code` and `Name` happen to be identical strings in today's seed
 * (Call, Chat, Email, Meeting, Note, SMS), which is exactly why this must be explicit: a lookup written
 * against `Name` would pass every test today and break silently the first time somebody renames the
 * display label of a row whose code never changed. The vocabulary gate exists for this class of
 * mistake.
 */
export type ActivityTypeCode = 'Call' | 'Chat' | 'Email' | 'Meeting' | 'Note' | 'SMS';

/** Entity names. These strings are the whole dependency surface on the other two apps. */
export const E_ACTIVITY = 'MJ_BizApps_Common: Activities';
export const E_ACTIVITY_LINK = 'MJ_BizApps_Common: Activity Links';
export const E_ACTIVITY_TYPE = 'MJ_BizApps_Common: Activity Types';
export const E_ACTIVITY_SYNC_CONNECTION = 'MJ_BizApps_Common: Activity Sync Connections';
export const E_ACTIVITY_SYNC_RULE = 'MJ_BizApps_Common: Activity Sync Rules';
export const E_CONTACT_METHOD = 'MJ_BizApps_Common: Contact Methods';
export const E_DEAL = 'MJ_BizApps_Sales: Deals';
export const E_DEAL_STATUS_TYPE = 'MJ_BizApps_Sales: Deal Status Types';

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 *  THE LINK CONVENTION. Decided here, once, because nothing in the schema decides it.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * `SalesAccount.ID` IS `Organization.ID` and `SalesContact.ID` IS `Person.ID` — verified as real
 * foreign keys, `FK_SalesAccount_Organization` and `FK_SalesContact_Person`, both on the `ID` column.
 * Shared-primary-key IsA. So an `ActivityLink` to `Organizations/<id>` and one to
 * `Sales Accounts/<id>` name **the same human or company under two different `EntityID`s**, and
 * nothing anywhere normalizes between them.
 *
 * Left unpicked, that does not produce an error. It produces two half-timelines: the ingest writes
 * one convention, a person logging a call by hand writes the other, and each view shows the half it
 * happens to query. That is the failure this constant exists to prevent.
 *
 * ── THE PARTIES ARE LINKED UNDER COMMON'S ENTITIES ──
 *
 * Three reasons, in the order that decided it:
 *
 *   1. **The ingest resolves to common natively, and the alternative can fail.** A participant is
 *      identified by matching an email address against `ContactMethod`, whose columns are `PersonID`
 *      and `OrganizationID` — common's parents. Translating those to the sales children would be a
 *      second lookup that can come back EMPTY: a Person with no `SalesContact` row is an ordinary
 *      thing (any employee, any contact belonging to another app). Under a sales-child convention
 *      that link would have to be dropped or a stub created, and the common migration explicitly
 *      forbids auto-creating stub People. Under this convention it is simply written.
 *
 *   2. **The row is common's.** `Activity` lives in `__mj_BizAppsCommon`. An activity involving a
 *      person is a fact about the person, not about their sales-contact role — and when a second app
 *      extends `Person`, its activities point at the same rows and that human has one timeline
 *      instead of one per app.
 *
 *   3. **It survives KI-1.** `AllowMultipleSubtypes` is still false on `Person` and `Organization`,
 *      so the sales children are the only children today. A convention anchored on them would need
 *      rewriting the day that changes; one anchored on the parents would not.
 *
 * ── WHAT SALES KEEPS ──
 *
 * The DEAL is still linked as a sales record — `MJ_BizApps_Sales: Deals`, role `Regarding`. That is
 * the anchor every read starts from. So the split is clean rather than arbitrary: **sales owns the
 * deal link, common owns the party links.**
 *
 * ── AND THE COST IS ZERO, WHICH IS WHY THIS IS NOT A TRADE-OFF ──
 *
 * The one argument for the sales children was that `Deal.AccountID` and `Deal.PrimaryContactID`
 * already hold those IDs, so no translation is needed on the manual path. But because the PK is
 * SHARED, those very same values ARE the Organization and Person IDs. `Deal.AccountID` can be used
 * verbatim as a `RecordID` under `E_ORGANIZATION`. Nothing is converted in either direction.
 */
export const E_PERSON = 'MJ_BizApps_Common: People';
export const E_ORGANIZATION = 'MJ_BizApps_Common: Organizations';

/**
 * The source-system name stamped on every ingested row, and half of the dedupe key.
 *
 * `UQ_Activity_External` is unique on `(SourceSystem, ExternalID)` and filtered to
 * `WHERE ExternalID IS NOT NULL`, with `CK_Activity_External` requiring both or neither. So this
 * string is not a label — it is a namespace, and changing it would orphan every row already ingested
 * and re-import the lot.
 */
export const SOURCE_SYSTEM_M365 = 'Microsoft365';
