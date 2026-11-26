import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RunView, type IRunViewProvider, type RunViewParams, type RunViewResult } from '@memberjunction/core';
import {
    DealFieldLabel,
    IsDealFieldEditableWhileLocked,
    mjBizAppsSalesDealSchema,
    type mjBizAppsSalesDealEntityType,
} from '../index.js';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const MIGRATION_SQL_NAME = 'V202611261800__v6.35.x__Deal_ProposalArtifactID.sql';
const MIGRATION_PG_NAME = 'V202611261800__v6.35.x__Deal_ProposalArtifactID.pg.sql';

interface ProposalDealSimpleRow {
    ID: string;
    DealNumber: string | null;
    Name: string;
    ProposalArtifactID: string | null;
    ProposalArtifact: string | null;
}

interface ArtifactSummaryRow {
    ID: string;
    Name: string;
    DelegateEntityID: string | null;
    DelegateRecordID: string | null;
}

interface ArtifactVersionSummaryRow {
    ID: string;
    ArtifactID: string;
    VersionNumber: number;
    Name: string | null;
}

interface GuestShareLinkSummaryRow {
    ID: string;
    ArtifactID: string;
    ArtifactVersionID: string;
    Label: string | null;
}

interface EntityFieldMetadataEntry {
    fields: {
        DisplayName?: string;
        AutoUpdateDisplayName?: boolean;
        Description?: string;
    };
    primaryKey: {
        ID: string;
    };
    sync?: Record<string, string>;
}

interface RecordedRunViewsCall {
    paramsList: RunViewParams[];
}

function buildSampleDealPayload(proposalArtifactID: string | null, proposalArtifact: string | null): mjBizAppsSalesDealEntityType {
    const now = new Date('2026-11-26T18:00:00.000Z');
    return {
        ID: 'D0C50006-4B26-4E10-A800-000000000001',
        DealNumber: 'DEAL-DOC-001',
        Name: 'Northwind Clinical Data Hub Expansion',
        PipelineID: '90111111-0000-4000-A000-000000000001',
        PipelineStageID: '91111111-0000-4000-A000-000000000003',
        DealTypeID: '2B8D5F31-0001-4C21-8F42-6D9B8E3A7122',
        DealStatusTypeID: '1A7C4E20-0001-4B10-9E31-5C8A7D2F6011',
        AccountID: 'D0C50004-4B26-4E10-A800-000000000001',
        PrimaryContactID: 'D0C50005-4B26-4E10-A800-000000000001',
        BillingContactID: 'D0C50005-4B26-4E10-A800-000000000001',
        CompanyID: 'D0C50001-4B26-4E10-A800-000000000001',
        OwnerEmployeeID: 'D0C50002-4B26-4E10-A800-000000000001',
        Amount: 285000,
        AmountIsComputed: false,
        AmountComputedAt: null,
        AmountSourceHash: null,
        CurrencyID: null,
        MRR: null,
        ARR: null,
        TermMonths: 12,
        EstimatedProjectWeeks: null,
        ExecutionDate: null,
        StartDate: null,
        ExpectedCloseDate: new Date('2026-03-27T00:00:00.000Z'),
        ActualCloseDate: null,
        Probability: 60,
        ForecastCategoryTypeID: '4DAF7153-0003-4E43-A164-8F1DA05C9344',
        LossReasonID: null,
        LossNotes: null,
        LeadSourceTypeID: '6FC19375-0001-4065-C386-A113C27EB566',
        CampaignID: null,
        ContractID: null,
        RenewsContractID: null,
        AutoRenew: false,
        AnnualIncreasePctOverride: null,
        CancellationNoticeDaysOverride: null,
        PaymentMethod: 'ACH',
        StandardAgreementModified: false,
        ContractVariances: null,
        Description: 'Seeded enterprise proposal deal.',
        NextStep: 'Confirm CFO commercial review.',
        NextStepDate: null,
        ClosedAt: null,
        ClosedByUserID: null,
        OrderID: null,
        __mj_CreatedAt: now,
        __mj_UpdatedAt: now,
        PredictedWinProbability: null,
        PredictedWinRiskBand: null,
        PredictedWinScoredAt: null,
        LeadSourceDetail: null,
        CreationDate: now,
        ProposalArtifactID: proposalArtifactID,
        Pipeline: 'B2B',
        PipelineStage: 'Proposal',
        DealType: 'New',
        DealStatusType: 'Open',
        Account: 'Northwind Health Network',
        PrimaryContact: 'Claire Bennett',
        BillingContact: 'Claire Bennett',
        Company: 'Apex Commercial Solutions',
        OwnerEmployee: 'Elena Rostova',
        ForecastCategoryType: 'Best Case',
        LossReason: null,
        LeadSourceType: 'Referral',
        ClosedByUser: null,
        Order: null,
        ProposalArtifact: proposalArtifact,
        WinOutcome: null,
        DaysToExpectedClose: 74,
        HasPaymentSchedule: 0,
        TeamMemberCount: 2,
        HasPartnerInvolved: 0,
        IsEnterpriseTier: 1,
        AutoRenewFlag: 0,
        StandardAgreementModifiedFlag: 0,
    };
}

describe('Deal.ProposalArtifactID schema typing, nullability & close-lock contract', () => {
    it('accepts a linked ProposalArtifactID UUID and virtual ProposalArtifact name in mjBizAppsSalesDealSchema', () => {
        const linked = buildSampleDealPayload(
            'D0C50007-4B26-4E10-A800-000000000001',
            'Customer Proposal: Northwind Clinical Data Hub Expansion',
        );
        const parsed = mjBizAppsSalesDealSchema.parse(linked);
        expect(parsed.ProposalArtifactID).toBe('D0C50007-4B26-4E10-A800-000000000001');
        expect(parsed.ProposalArtifact).toBe('Customer Proposal: Northwind Clinical Data Hub Expansion');
    });

    it('accepts null ProposalArtifactID and null ProposalArtifact for legacy deals', () => {
        const legacy = buildSampleDealPayload(null, null);
        const parsed = mjBizAppsSalesDealSchema.parse(legacy);
        expect(parsed.ProposalArtifactID).toBeNull();
        expect(parsed.ProposalArtifact).toBeNull();
    });

    it('rejects non-string non-null values for ProposalArtifactID', () => {
        const invalid = {
            ...buildSampleDealPayload(null, null),
            ProposalArtifactID: 12345,
        };
        const result = mjBizAppsSalesDealSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it('derives Proposal Artifact label and freezes ProposalArtifactID on locked deals', () => {
        expect(DealFieldLabel('ProposalArtifactID')).toBe('Proposal Artifact');
        expect(IsDealFieldEditableWhileLocked('ProposalArtifactID', false)).toBe(false);
        expect(IsDealFieldEditableWhileLocked('ProposalArtifactID', true)).toBe(false);
    });
});

describe('Batched RunViews (ResultType: simple + ID IN) for Deal Proposal Artifacts', () => {
    it('resolves linked artifacts, pinned versions, and guest share links in a single RunViews batch', async () => {
        const calls: RecordedRunViewsCall[] = [];
        const deals: ProposalDealSimpleRow[] = [
            {
                ID: 'D0C50006-4B26-4E10-A800-000000000001',
                DealNumber: 'DEAL-DOC-001',
                Name: 'Northwind Clinical Data Hub Expansion',
                ProposalArtifactID: 'D0C50007-4B26-4E10-A800-000000000001',
                ProposalArtifact: 'Customer Proposal: Northwind Clinical Data Hub Expansion',
            },
            {
                ID: 'D0C50006-4B26-4E10-A800-000000000015',
                DealNumber: 'DEAL-DOC-015',
                Name: 'Lumina Storefront Self-Serve Starter',
                ProposalArtifactID: null,
                ProposalArtifact: null,
            },
        ];

        const provider: IRunViewProvider = {
            RunView: async <T>(params: RunViewParams): Promise<RunViewResult<T>> => ({
                Success: true,
                Results: [] as T[],
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 1,
                ErrorMessage: '',
                UserViewRunID: '',
                EntityName: params.EntityName ?? '',
            }),
            RunViews: async (paramsList: RunViewParams[]): Promise<RunViewResult[]> => {
                calls.push({ paramsList });
                return paramsList.map((p): RunViewResult => {
                    if (p.EntityName === 'MJ: Artifacts') {
                        const rows: ArtifactSummaryRow[] = [
                            {
                                ID: 'D0C50007-4B26-4E10-A800-000000000001',
                                Name: 'Customer Proposal: Northwind Clinical Data Hub Expansion',
                                DelegateEntityID: '79148DE5-7F99-44AC-ACD4-5EE7BA93D354',
                                DelegateRecordID: 'D0C50006-4B26-4E10-A800-000000000001',
                            },
                        ];
                        return {
                            Success: true,
                            Results: rows,
                            RowCount: rows.length,
                            TotalRowCount: rows.length,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                            UserViewRunID: '',
                        };
                    }
                    if (p.EntityName === 'MJ: Artifact Versions') {
                        const rows: ArtifactVersionSummaryRow[] = [
                            {
                                ID: 'D0C50008-4B26-4E10-A800-000000000002',
                                ArtifactID: 'D0C50007-4B26-4E10-A800-000000000001',
                                VersionNumber: 2,
                                Name: 'Customer Proposal: Northwind Clinical Data Hub Expansion — v2',
                            },
                        ];
                        return {
                            Success: true,
                            Results: rows,
                            RowCount: rows.length,
                            TotalRowCount: rows.length,
                            ExecutionTime: 1,
                            ErrorMessage: '',
                            UserViewRunID: '',
                        };
                    }
                    const shares: GuestShareLinkSummaryRow[] = [
                        {
                            ID: 'D0C50011-4B26-4E10-A800-000000000001',
                            ArtifactID: 'D0C50007-4B26-4E10-A800-000000000001',
                            ArtifactVersionID: 'D0C50008-4B26-4E10-A800-000000000002',
                            Label: 'CFO & CIO Commercial Review',
                        },
                    ];
                    return {
                        Success: true,
                        Results: shares,
                        RowCount: shares.length,
                        TotalRowCount: shares.length,
                        ExecutionTime: 1,
                        ErrorMessage: '',
                        UserViewRunID: '',
                    };
                });
            },
        };

        const linkedIds = deals
            .map((d) => d.ProposalArtifactID)
            .filter((id): id is string => id !== null);
        expect(linkedIds).toEqual(['D0C50007-4B26-4E10-A800-000000000001']);

        const inFilter = linkedIds.map((id) => `'${id}'`).join(', ');
        const rv = new RunView(provider);
        const [artifactsRes, versionsRes, sharesRes] = await rv.RunViews([
            {
                EntityName: 'MJ: Artifacts',
                ExtraFilter: `ID IN (${inFilter})`,
                ResultType: 'simple',
                Fields: ['ID', 'Name', 'DelegateEntityID', 'DelegateRecordID'],
            },
            {
                EntityName: 'MJ: Artifact Versions',
                ExtraFilter: `ArtifactID IN (${inFilter})`,
                OrderBy: 'VersionNumber DESC',
                ResultType: 'simple',
                Fields: ['ID', 'ArtifactID', 'VersionNumber', 'Name'],
            },
            {
                EntityName: 'MJ: Artifact Guest Share Links',
                ExtraFilter: `ArtifactID IN (${inFilter})`,
                ResultType: 'simple',
                Fields: ['ID', 'ArtifactID', 'ArtifactVersionID', 'Label'],
            },
        ]);

        expect(calls).toHaveLength(1);
        expect(calls[0].paramsList.every((p) => p.ResultType === 'simple')).toBe(true);
        expect(calls[0].paramsList[0].ExtraFilter).toContain('ID IN (');
        expect(artifactsRes.Success).toBe(true);
        expect(versionsRes.Success).toBe(true);
        expect(sharesRes.Success).toBe(true);
        expect(artifactsRes.Results).toHaveLength(1);
        expect(versionsRes.Results).toHaveLength(1);
        expect(sharesRes.Results).toHaveLength(1);
    });
});

describe('Metadata & additive dual-DBMS migration hygiene for Deal.ProposalArtifactID', () => {
    it('declares ProposalArtifact and ProposalArtifactID field metadata cleanly with no sync block and EntityIDFieldName compliance', () => {
        const metaPath = `${REPO_ROOT}metadata/entity-fields/.deal-proposal-artifact.json`;
        expect(existsSync(metaPath)).toBe(true);
        const entries = JSON.parse(readFileSync(metaPath, 'utf8')) as EntityFieldMetadataEntry[];
        expect(entries.length).toBe(2);

        for (const entry of entries) {
            expect(entry.sync).toBeUndefined();
            expect(entry.primaryKey.ID).toMatch(/^@lookup:MJ: Entity Fields\.Entity=MJ_BizApps_Sales: Deals&Name=ProposalArtifact(ID)?$/);
            expect(entry.fields.DisplayName).toBe(DealFieldLabel('ProposalArtifactID'));
            expect(entry.fields.AutoUpdateDisplayName).toBe(false);
        }

        // Verify metadata/entities/.entities.json has no EntityIDFieldName drift (uses EntityID lookups cleanly)
        const entitiesJson = readFileSync(`${REPO_ROOT}metadata/entities/.entities.json`, 'utf8');
        expect(entitiesJson).not.toContain('EntityIDFieldName": ""');
    });

    it('ships strictly additive 4-part T-SQL migration paired with split-bake v1 PostgreSQL counterpart', () => {
        const sqlPath = `${REPO_ROOT}migrations/${MIGRATION_SQL_NAME}`;
        const pgPath = `${REPO_ROOT}migrations-pg/${MIGRATION_PG_NAME}`;
        expect(existsSync(sqlPath)).toBe(true);
        expect(existsSync(pgPath)).toBe(true);

        const sqlText = readFileSync(sqlPath, 'utf8');
        const pgText = readFileSync(pgPath, 'utf8');

        // Additive only (PUBLISH_NO_BREAK_POLICY)
        expect(sqlText).not.toMatch(/\bDROP\s+TABLE\b/i);
        expect(sqlText).not.toMatch(/\bDROP\s+COLUMN\b/i);
        expect(sqlText).not.toMatch(/\bALTER\s+COLUMN\b/i);
        expect(sqlText).toContain('ProposalArtifactID');
        expect(sqlText).toContain('FK_Deal_ProposalArtifact');
        expect(sqlText).toContain('IX_Deal_ProposalArtifactID');

        // 4-part format: >= 50 blank lines before CodeGen banner
        const bannerMatch = sqlText.match(/\n(\n{50,})-- =+\n-- CODEGEN OUTPUT/);
        expect(bannerMatch).not.toBeNull();

        // Line 1 provenance stamp on .pg.sql with matching SHA-256 of T-SQL source
        const firstLine = pgText.split(/\r?\n/, 1)[0];
        const expectedSha = createHash('sha256').update(sqlText, 'utf8').digest('hex');
        expect(firstLine).toMatch(/^-- @mj-pg-provenance: split-bake v1 /);
        expect(firstLine).toContain(`source=${MIGRATION_SQL_NAME}`);
        expect(firstLine).toContain(`source-sha256=${expectedSha}`);
    });
});
