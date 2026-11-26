/**
 * @fileoverview `deal-proposal-artifact` — DPA1–DPA6. End-to-end MJ Docs (`MJ: Artifacts`)
 * integration for `Deal.ProposalArtifactID`, covering seeded deal density, legacy `NULL`
 * compatibility, batched `RunViews` resolution (`ResultType: 'simple'`), rolled-back CRUD +
 * FK enforcement, close-lock immutability, and adversarial permission boundaries across SQL Server
 * and PostgreSQL.
 *
 * @module @mj-biz-apps/sales-integration-tests
 */
import { BaseEntity, RunView, UserInfo, type IMetadataProvider, type IRunViewProvider, type RunViewParams } from '@memberjunction/core';
import { MJGlobal, UUIDsEqual } from '@memberjunction/global';
import {
    Assert,
    AssertEqual,
    IntegrationCheckRegistry,
    type NamedCheck,
} from '@memberjunction/testing-integration';
import {
    DealFieldLabel,
    IsDealFieldEditableWhileLocked,
    type DealEntity,
} from '@mj-biz-apps/sales-entities';
import { OrdersIsInstalled } from '@mj-biz-apps/sales-core-entities-server';

import { E_DEAL, E_STATUS_TYPE, InRolledBackTransaction, ProviderOf, SALES_SCHEMA } from '../fixture.js';

type Ctx = Parameters<NamedCheck['Fn']>[0];

const E_ARTIFACT = 'MJ: Artifacts';
const E_ARTIFACT_VERSION = 'MJ: Artifact Versions';
const E_ARTIFACT_PERMISSION = 'MJ: Artifact Permissions';
const E_ARTIFACT_GUEST_SHARE_LINK = 'MJ: Artifact Guest Share Links';
const E_USER = 'MJ: Users';
const E_USER_ROLE = 'MJ: User Roles';

const DEAL_ENTITY_ID = '79148DE5-7F99-44AC-ACD4-5EE7BA93D354';
const AUTHORIZED_OWNER_EMAIL = 'elena.rostova@apexcommercial.example';
const RESTRICTED_VIEWER_EMAIL = 'restricted.viewer@apexcommercial.example';

interface DealProposalRow {
    ID: string;
    DealNumber: string | null;
    Name: string;
    DealStatusTypeID: string | null;
    ProposalArtifactID: string | null;
    ProposalArtifact: string | null;
    ExpectedCloseDate: string | Date | null;
}

interface StatusFlagRow {
    ID: string;
    IsOpen: boolean;
    IsWon: boolean;
    IsLost: boolean;
    LocksDeal: boolean;
}

interface ArtifactRow {
    ID: string;
    Name: string;
    DelegateEntityID: string | null;
    DelegateRecordID: string | null;
}

interface ArtifactVersionRow {
    ID: string;
    ArtifactID: string;
    VersionNumber: number;
    Name: string | null;
    ContentHash: string | null;
}

interface ArtifactGuestShareLinkRow {
    ID: string;
    MagicLinkInviteID: string;
    ArtifactID: string;
    ArtifactVersionID: string;
    Label: string | null;
}

interface UserIdentityRow {
    ID: string;
    Name: string;
    Email: string | null;
    Type: string | null;
}

interface ArtifactPermissionRow {
    ID: string;
    ArtifactID: string;
    UserID: string;
    CanRead: boolean;
    CanEdit: boolean;
    CanShare: boolean;
}

interface UserRoleRow {
    ID: string;
    UserID: string;
    RoleID: string;
    Role: string;
}

async function resolvePersonaUser(ctx: Ctx, email: string): Promise<UserInfo> {
    const rv = runViewFor(ctx);
    const userRes = await rv.RunView<UserIdentityRow>(
        {
            EntityName: E_USER,
            ExtraFilter: `Email = '${email.replace(/'/g, "''")}'`,
            ResultType: 'simple',
            Fields: ['ID', 'Name', 'Email', 'Type'],
        },
        ctx.User,
    );
    Assert(userRes.Success && (userRes.Results?.length ?? 0) === 1, `missing seeded persona ${email}`);
    const row = userRes.Results[0];
    const rolesRes = await rv.RunView<UserRoleRow>(
        {
            EntityName: E_USER_ROLE,
            ExtraFilter: `UserID = '${row.ID.replace(/'/g, "''")}'`,
            ResultType: 'simple',
            Fields: ['ID', 'UserID', 'RoleID', 'Role'],
        },
        ctx.User,
    );
    Assert(rolesRes.Success, `failed loading roles for ${email}`);
    const roles = (rolesRes.Results ?? []).map((r) => ({
        ID: r.ID,
        UserID: r.UserID,
        RoleID: r.RoleID,
        Role: r.Role,
        RoleName: r.Role,
    }));
    return new UserInfo(ProviderOf(ctx), {
        ID: row.ID,
        Name: row.Name,
        Email: row.Email ?? email,
        Type: row.Type ?? 'User',
        UserRoles: roles,
    });
}

interface SqlCapableProvider {
    PlatformKey: string;
    ExecuteSQL(
        query: string,
        params?: Array<string | number | boolean | null>,
        options?: { isMutation?: boolean; description?: string },
        contextUser?: UserInfo,
    ): Promise<Array<Record<string, string | number | boolean | null>>>;
}

function isRunViewCapable(provider: IMetadataProvider): provider is IMetadataProvider & IRunViewProvider {
    return typeof (provider as IMetadataProvider & Partial<IRunViewProvider>).RunViews === 'function';
}

function isSqlCapableProvider(provider: IMetadataProvider): provider is IMetadataProvider & SqlCapableProvider {
    return typeof (provider as IMetadataProvider & Partial<SqlCapableProvider>).ExecuteSQL === 'function';
}

function runViewFor(ctx: Ctx): RunView {
    const provider = ProviderOf(ctx);
    if (isRunViewCapable(provider)) {
        return new RunView(provider);
    }
    return new RunView();
}

function sqlUuidInList(ids: readonly string[]): string {
    return ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
}

async function loadSeededDeals(ctx: Ctx): Promise<DealProposalRow[]> {
    const rv = runViewFor(ctx);
    const res = await rv.RunView<DealProposalRow>(
        {
            EntityName: E_DEAL,
            ExtraFilter: "DealNumber LIKE 'DEAL-DOC-%'",
            OrderBy: 'DealNumber ASC',
            ResultType: 'simple',
            Fields: [
                'ID',
                'DealNumber',
                'Name',
                'DealStatusTypeID',
                'ProposalArtifactID',
                'ProposalArtifact',
                'ExpectedCloseDate',
            ],
        },
        ctx.User,
    );
    Assert(res.Success, `loading seeded DEAL-DOC-* deals failed: ${res.ErrorMessage ?? 'error'}`);
    return res.Results ?? [];
}

export const DealProposalArtifactChecks: NamedCheck[] = [
    {
        Id: 'deal-proposal-artifact.DPA1',
        Name: 'DPA1: seeded world provides >=20 deals with linked MJ: Artifacts and virtual ProposalArtifact join',
        RequiresMutation: false,
        Fn: async (ctx) => {
            const deals = await loadSeededDeals(ctx);
            Assert(
                deals.length >= 20,
                `expected >= 20 seeded DEAL-DOC-* deals (run scripts/seed-sales-deals.{sql,pg.sql}), found ${deals.length}`,
            );

            const linked = deals.filter((d) => d.ProposalArtifactID !== null);
            const unlinked = deals.filter((d) => d.ProposalArtifactID === null);
            Assert(linked.length >= 10, `expected >= 10 deals with ProposalArtifactID populated, found ${linked.length}`);
            Assert(unlinked.length >= 5, `expected >= 5 legacy deals with ProposalArtifactID IS NULL, found ${unlinked.length}`);

            for (const row of linked) {
                Assert(
                    typeof row.ProposalArtifact === 'string' && row.ProposalArtifact.trim().length > 0,
                    `linked deal ${row.DealNumber ?? row.ID} must project non-empty virtual ProposalArtifact name`,
                );
            }
        },
    },
    {
        Id: 'deal-proposal-artifact.DPA2',
        Name: 'DPA2: legacy deals with ProposalArtifactID IS NULL load cleanly and pass validation',
        RequiresMutation: false,
        Fn: async (ctx) => {
            const deals = await loadSeededDeals(ctx);
            const legacy = deals.find((d) => d.ProposalArtifactID === null);
            Assert(legacy !== undefined, 'expected at least one seeded deal with ProposalArtifactID IS NULL');

            const entity = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
            const loaded = await entity.Load(legacy.ID);
            Assert(loaded, `failed to load legacy deal ${legacy.ID}`);
            AssertEqual(entity.ProposalArtifactID, null, 'legacy deal ProposalArtifactID must remain null');
            AssertEqual(entity.ProposalArtifact, null, 'legacy deal virtual ProposalArtifact must remain null');
        },
    },
    {
        Id: 'deal-proposal-artifact.DPA3',
        Name: 'DPA3: single batched RunViews (ResultType simple + ID IN) resolves Artifacts, pinned Versions, and GuestShareLinks',
        RequiresMutation: false,
        Fn: async (ctx) => {
            const deals = await loadSeededDeals(ctx);
            const linked = deals.filter((d) => d.ProposalArtifactID !== null);
            Assert(linked.length >= 10, `expected >= 10 linked deals, found ${linked.length}`);

            const artifactIds = linked
                .map((d) => d.ProposalArtifactID)
                .filter((id): id is string => id !== null);
            const inClause = sqlUuidInList(artifactIds);

            const rv = runViewFor(ctx);
            const batchParams: RunViewParams[] = [
                {
                    EntityName: E_ARTIFACT,
                    ExtraFilter: `ID IN (${inClause})`,
                    ResultType: 'simple',
                    Fields: ['ID', 'Name', 'DelegateEntityID', 'DelegateRecordID'],
                },
                {
                    EntityName: E_ARTIFACT_VERSION,
                    ExtraFilter: `ArtifactID IN (${inClause})`,
                    OrderBy: 'ArtifactID ASC, VersionNumber DESC',
                    ResultType: 'simple',
                    Fields: ['ID', 'ArtifactID', 'VersionNumber', 'Name', 'ContentHash'],
                },
                {
                    EntityName: E_ARTIFACT_GUEST_SHARE_LINK,
                    ExtraFilter: `ArtifactID IN (${inClause})`,
                    ResultType: 'simple',
                    Fields: ['ID', 'MagicLinkInviteID', 'ArtifactID', 'ArtifactVersionID', 'Label'],
                },
            ];

            const ownerUser = await resolvePersonaUser(ctx, AUTHORIZED_OWNER_EMAIL);
            const [artifactsRes, versionsRes, sharesRes] = await rv.RunViews(batchParams, ownerUser);
            Assert(artifactsRes.Success, `batched Artifacts read failed: ${artifactsRes.ErrorMessage ?? 'error'}`);
            Assert(versionsRes.Success, `batched ArtifactVersions read failed: ${versionsRes.ErrorMessage ?? 'error'}`);
            Assert(sharesRes.Success, `batched ArtifactGuestShareLinks read failed: ${sharesRes.ErrorMessage ?? 'error'}`);

            const artifacts = (artifactsRes.Results ?? []) as ArtifactRow[];
            const versions = (versionsRes.Results ?? []) as ArtifactVersionRow[];
            const shares = (sharesRes.Results ?? []) as ArtifactGuestShareLinkRow[];

            AssertEqual(artifacts.length, artifactIds.length, 'every linked ProposalArtifactID resolves to an MJ: Artifacts row');
            Assert(versions.length >= artifacts.length, `expected >= ${artifacts.length} pinned ArtifactVersions, found ${versions.length}`);
            Assert(shares.length >= 4, `expected >= 4 ArtifactGuestShareLinks, found ${shares.length}`);

            for (const artifact of artifacts) {
                Assert(
                    artifact.DelegateEntityID !== null && UUIDsEqual(artifact.DelegateEntityID, DEAL_ENTITY_ID),
                    `artifact ${artifact.ID} must delegate permissions to MJ_BizApps_Sales: Deals`,
                );
                Assert(
                    typeof artifact.DelegateRecordID === 'string' && artifact.DelegateRecordID.length > 0,
                    `artifact ${artifact.ID} must bind DelegateRecordID to its host Deal`,
                );
            }

            const versionIds = new Set(versions.map((v) => v.ID.toLowerCase()));
            for (const share of shares) {
                Assert(
                    versionIds.has(share.ArtifactVersionID.toLowerCase()),
                    `guest share link ${share.ID} must pin an existing ArtifactVersion`,
                );
            }
        },
    },
    {
        Id: 'deal-proposal-artifact.DPA4',
        Name: 'DPA4: rolled-back CRUD links, updates, clears ProposalArtifactID and rejects bogus FK UUID',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                const rv = runViewFor(ctx);
                const [dealsRes, statusesRes] = await rv.RunViews(
                    [
                        {
                            EntityName: E_DEAL,
                            ExtraFilter: "DealNumber LIKE 'DEAL-DOC-%'",
                            OrderBy: 'DealNumber ASC',
                            ResultType: 'simple',
                            Fields: ['ID', 'DealNumber', 'DealStatusTypeID', 'ProposalArtifactID', 'ProposalArtifact'],
                        },
                        {
                            EntityName: E_STATUS_TYPE,
                            ExtraFilter: 'IsActive = 1',
                            ResultType: 'simple',
                            Fields: ['ID', 'IsOpen', 'IsWon', 'IsLost', 'LocksDeal'],
                        },
                    ],
                    ctx.User,
                );
                Assert(dealsRes.Success && statusesRes.Success, 'failed loading deals/statuses for DPA4');

                const deals = (dealsRes.Results ?? []) as DealProposalRow[];
                const statuses = (statusesRes.Results ?? []) as StatusFlagRow[];
                const unlockedIds = new Set(statuses.filter((s) => !s.LocksDeal).map((s) => s.ID.toLowerCase()));

                const targetOpenLegacy = deals.find(
                    (d) => d.ProposalArtifactID === null && d.DealStatusTypeID !== null && unlockedIds.has(d.DealStatusTypeID.toLowerCase()),
                );
                const sampleLinked = deals.filter((d) => d.ProposalArtifactID !== null);
                Assert(targetOpenLegacy !== undefined, 'DPA4 requires an unlocked legacy deal with ProposalArtifactID IS NULL');
                Assert(sampleLinked.length >= 2, 'DPA4 requires at least two seeded linked proposal artifacts');

                const firstArtifactId = sampleLinked[0].ProposalArtifactID as string;
                const secondArtifactId = sampleLinked[1].ProposalArtifactID as string;

                const orderServerReg = MJGlobal.Instance.ClassFactory.GetRegistration(
                    BaseEntity,
                    'MJ_BizApps_Orders: Order Headers',
                );
                const ordersServerReady = OrdersIsInstalled() && orderServerReg?.SubClass?.name === 'OrderEntityServer';

                if (ordersServerReady) {
                    const deal = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                    Assert(await deal.Load(targetOpenLegacy.ID), 'failed loading target open deal');

                    // Link to first artifact
                    deal.ProposalArtifactID = firstArtifactId;
                    Assert(await deal.Save(), `linking ProposalArtifactID failed: ${deal.LatestResult?.CompleteMessage ?? 'error'}`);

                    const reloaded1 = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                    Assert(await reloaded1.Load(targetOpenLegacy.ID), 'reload after link failed');
                    Assert(
                        reloaded1.ProposalArtifactID !== null && UUIDsEqual(reloaded1.ProposalArtifactID, firstArtifactId),
                        'persisted ProposalArtifactID must match linked artifact',
                    );

                    // Re-link to second artifact
                    reloaded1.ProposalArtifactID = secondArtifactId;
                    Assert(await reloaded1.Save(), `updating ProposalArtifactID failed: ${reloaded1.LatestResult?.CompleteMessage ?? 'error'}`);

                    // Unlink back to null
                    reloaded1.ProposalArtifactID = null;
                    Assert(await reloaded1.Save(), `clearing ProposalArtifactID to null failed: ${reloaded1.LatestResult?.CompleteMessage ?? 'error'}`);

                    const reloadedNull = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                    Assert(await reloadedNull.Load(targetOpenLegacy.ID), 'reload after unlink failed');
                    AssertEqual(reloadedNull.ProposalArtifactID, null, 'cleared ProposalArtifactID must persist as null');

                    // Adversarial invalid FK: non-existent Artifact UUID must fail cleanly
                    reloadedNull.ProposalArtifactID = '00000000-0000-4000-8000-00000000DEAD';
                    const bogusSaved = await reloadedNull.Save();
                    Assert(!bogusSaved, 'saving a non-existent ProposalArtifactID must fail FK_Deal_ProposalArtifact');
                } else {
                    const provider = ProviderOf(ctx);
                    if (!isSqlCapableProvider(provider)) {
                        throw new Error('DPA4 requires a SQL-capable database provider');
                    }
                    const db: SqlCapableProvider = provider;
                    const isPg = db.PlatformKey === 'postgresql';
                    const dealTable = isPg ? `"${SALES_SCHEMA}"."Deal"` : `[${SALES_SCHEMA}].[Deal]`;
                    const colId = isPg ? '"ID"' : '[ID]';
                    const colProp = isPg ? '"ProposalArtifactID"' : '[ProposalArtifactID]';

                    await db.ExecuteSQL(
                        `UPDATE ${dealTable} SET ${colProp} = '${firstArtifactId}' WHERE ${colId} = '${targetOpenLegacy.ID}'`,
                        undefined,
                        { isMutation: true, description: 'DPA4 link ProposalArtifactID' },
                        ctx.User,
                    );
                    const reloaded1 = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                    Assert(await reloaded1.Load(targetOpenLegacy.ID), 'reload after link failed');
                    Assert(
                        reloaded1.ProposalArtifactID !== null && UUIDsEqual(reloaded1.ProposalArtifactID, firstArtifactId),
                        'persisted ProposalArtifactID must match linked artifact',
                    );
                    Assert(
                        typeof reloaded1.ProposalArtifact === 'string' && reloaded1.ProposalArtifact.length > 0,
                        'virtual ProposalArtifact join must resolve linked artifact name',
                    );

                    await db.ExecuteSQL(
                        `UPDATE ${dealTable} SET ${colProp} = '${secondArtifactId}' WHERE ${colId} = '${targetOpenLegacy.ID}'`,
                        undefined,
                        { isMutation: true, description: 'DPA4 update ProposalArtifactID' },
                        ctx.User,
                    );
                    await db.ExecuteSQL(
                        `UPDATE ${dealTable} SET ${colProp} = NULL WHERE ${colId} = '${targetOpenLegacy.ID}'`,
                        undefined,
                        { isMutation: true, description: 'DPA4 clear ProposalArtifactID' },
                        ctx.User,
                    );
                    const reloadedNull = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                    Assert(await reloadedNull.Load(targetOpenLegacy.ID), 'reload after unlink failed');
                    AssertEqual(reloadedNull.ProposalArtifactID, null, 'cleared ProposalArtifactID must persist as null');

                    if (isPg) {
                        await db.ExecuteSQL('SAVEPOINT dpa4_bogus_fk', undefined, { isMutation: true, description: 'DPA4 savepoint' }, ctx.User);
                    }
                    let fkRejected = false;
                    try {
                        await db.ExecuteSQL(
                            `UPDATE ${dealTable} SET ${colProp} = '00000000-0000-4000-8000-00000000DEAD' WHERE ${colId} = '${targetOpenLegacy.ID}'`,
                            undefined,
                            { isMutation: true, description: 'DPA4 bogus FK probe' },
                            ctx.User,
                        );
                    } catch {
                        fkRejected = true;
                        if (isPg) {
                            await db.ExecuteSQL('ROLLBACK TO SAVEPOINT dpa4_bogus_fk', undefined, { isMutation: true, description: 'DPA4 rollback savepoint' }, ctx.User);
                        }
                    }
                    Assert(fkRejected, 'bogus ProposalArtifactID must be rejected by FK_Deal_ProposalArtifact');
                }
            }),
    },
    {
        Id: 'deal-proposal-artifact.DPA5',
        Name: 'DPA5: ProposalArtifactID obeys close-lock immutability and DealFieldLabel contract',
        RequiresMutation: true,
        Fn: async (ctx) =>
            InRolledBackTransaction(ctx, async () => {
                AssertEqual(DealFieldLabel('ProposalArtifactID'), 'Proposal Artifact', 'DealFieldLabel matches metadata');
                AssertEqual(IsDealFieldEditableWhileLocked('ProposalArtifactID', false), false, 'frozen on won locked deal');
                AssertEqual(IsDealFieldEditableWhileLocked('ProposalArtifactID', true), false, 'frozen on lost locked deal');

                const rv = runViewFor(ctx);
                const [dealsRes, statusesRes] = await rv.RunViews(
                    [
                        {
                            EntityName: E_DEAL,
                            ExtraFilter: "DealNumber LIKE 'DEAL-DOC-%'",
                            OrderBy: 'DealNumber ASC',
                            ResultType: 'simple',
                            Fields: ['ID', 'DealNumber', 'DealStatusTypeID', 'ProposalArtifactID'],
                        },
                        {
                            EntityName: E_STATUS_TYPE,
                            ExtraFilter: 'LocksDeal = 1',
                            ResultType: 'simple',
                            Fields: ['ID', 'LocksDeal'],
                        },
                    ],
                    ctx.User,
                );
                Assert(dealsRes.Success && statusesRes.Success, 'failed loading locked deals for DPA5');

                const lockingIds = new Set(((statusesRes.Results ?? []) as StatusFlagRow[]).map((s) => s.ID.toLowerCase()));
                const deals = (dealsRes.Results ?? []) as DealProposalRow[];
                const lockedLinked = deals.find(
                    (d) => d.ProposalArtifactID !== null && d.DealStatusTypeID !== null && lockingIds.has(d.DealStatusTypeID.toLowerCase()),
                );
                Assert(lockedLinked !== undefined, 'DPA5 requires a seeded locked deal with ProposalArtifactID populated');

                const entity = await ProviderOf(ctx).GetEntityObject<DealEntity>(E_DEAL, ctx.User);
                Assert(await entity.Load(lockedLinked.ID), 'failed loading locked deal');

                entity.ProposalArtifactID = null;
                const saved = await entity.Save();
                Assert(!saved, 'DealEntityServer must refuse unlinking ProposalArtifactID on a locked deal');
            }),
    },
    {
        Id: 'deal-proposal-artifact.DPA6',
        Name: 'DPA6: adversarial permission boundary denies unauthorized user access to delegated deal proposal artifacts',
        RequiresMutation: false,
        Fn: async (ctx) => {
            const rv = runViewFor(ctx);
            const ownerUser = await resolvePersonaUser(ctx, AUTHORIZED_OWNER_EMAIL);
            const restrictedUser = await resolvePersonaUser(ctx, RESTRICTED_VIEWER_EMAIL);

            const dealsRes = await rv.RunView<DealProposalRow>(
                {
                    EntityName: E_DEAL,
                    ExtraFilter: "DealNumber LIKE 'DEAL-DOC-%' AND ProposalArtifactID IS NOT NULL",
                    ResultType: 'simple',
                    Fields: ['ID', 'ProposalArtifactID'],
                },
                ctx.User,
            );
            Assert(dealsRes.Success, 'DPA6 failed loading seeded deals');

            const linkedArtifactIds = (dealsRes.Results ?? [])
                .map((d) => d.ProposalArtifactID)
                .filter((id): id is string => id !== null);
            Assert(linkedArtifactIds.length >= 10, 'DPA6 requires >= 10 linked proposal artifacts');

            const inArtifacts = sqlUuidInList(linkedArtifactIds);
            const [ownerArtifactsRes, ownerPermsRes] = await rv.RunViews(
                [
                    {
                        EntityName: E_ARTIFACT,
                        ExtraFilter: `ID IN (${inArtifacts})`,
                        ResultType: 'simple',
                        Fields: ['ID', 'Name', 'DelegateEntityID', 'DelegateRecordID'],
                    },
                    {
                        EntityName: E_ARTIFACT_PERMISSION,
                        ExtraFilter: `UserID = '${ownerUser.ID}' AND ArtifactID IN (${inArtifacts})`,
                        ResultType: 'simple',
                        Fields: ['ID', 'ArtifactID', 'UserID', 'CanRead', 'CanEdit', 'CanShare'],
                    },
                ],
                ownerUser,
            );
            Assert(ownerArtifactsRes.Success && ownerPermsRes.Success, 'DPA6 authorized owner queries failed');

            const [restrictedPermsRes, restrictedRolesRes] = await rv.RunViews(
                [
                    {
                        EntityName: E_ARTIFACT_PERMISSION,
                        ExtraFilter: `UserID = '${restrictedUser.ID}' AND ArtifactID IN (${inArtifacts})`,
                        ResultType: 'simple',
                        Fields: ['ID', 'ArtifactID', 'UserID', 'CanRead', 'CanEdit', 'CanShare'],
                    },
                    {
                        EntityName: E_USER_ROLE,
                        ExtraFilter: `UserID = '${restrictedUser.ID}'`,
                        ResultType: 'simple',
                        Fields: ['ID', 'UserID', 'RoleID'],
                    },
                ],
                ctx.User,
            );
            // Also probe MJ: Artifacts directly under the restricted user's own security context
            const restrictedSelfProbeRes = await rv.RunView<ArtifactRow>(
                {
                    EntityName: E_ARTIFACT,
                    ExtraFilter: `ID IN (${inArtifacts})`,
                    ResultType: 'simple',
                    Fields: ['ID', 'Name'],
                },
                restrictedUser,
            );

            const ownerArtifacts = (ownerArtifactsRes.Results ?? []) as ArtifactRow[];
            const ownerPerms = (ownerPermsRes.Results ?? []) as ArtifactPermissionRow[];
            const restrictedPerms = (restrictedPermsRes.Results ?? []) as ArtifactPermissionRow[];
            const restrictedRoles = (restrictedRolesRes.Results ?? []) as UserRoleRow[];
            const restrictedSelfArtifacts = restrictedSelfProbeRes.Success ? (restrictedSelfProbeRes.Results ?? []) : [];

            AssertEqual(ownerArtifacts.length, linkedArtifactIds.length, 'authorized owner reads all linked proposal artifacts');
            AssertEqual(ownerPerms.length, linkedArtifactIds.length, 'authorized owner holds explicit permission on every linked proposal artifact');
            Assert(ownerPerms.every((p) => p.CanRead && p.CanEdit && p.CanShare), 'authorized owner holds Read/Edit/Share');
            AssertEqual(restrictedPerms.length, 0, 'restricted adversarial user must hold ZERO ArtifactPermission grants');
            AssertEqual(restrictedRoles.length, 0, 'restricted adversarial user must hold ZERO privileged UserRole bindings');
            AssertEqual(restrictedSelfArtifacts.length, 0, 'restricted adversarial user must be denied reading any linked proposal artifact under its own context');
        },
    },
];

for (const check of DealProposalArtifactChecks) {
    IntegrationCheckRegistry.Instance.Register(check);
}

IntegrationCheckRegistry.Instance.RegisterLifecycle('deal-proposal-artifact', {
    Setup: async () => {
        // Discovers seeded world rows from scripts/seed-sales-deals.{sql,pg.sql}.
    },
    Teardown: async () => {
        // Mutating checks roll back via InRolledBackTransaction.
    },
});

/** Referenced by index.ts so the registration side effect cannot be tree-shaken away. */
export function LoadDealProposalArtifactChecks(): void {
    void DealProposalArtifactChecks;
}
