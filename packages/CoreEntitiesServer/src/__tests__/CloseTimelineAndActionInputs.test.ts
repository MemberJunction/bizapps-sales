import { describe, expect, it, vi } from 'vitest';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import { E_ACTIVITY, E_ACTIVITY_LINK, E_DEAL, E_ORGANIZATION, E_PERSON } from '@mj-biz-apps/sales-entities';
import { ActivityWriterService, type LogActivityInput } from '../activities/ActivityWriterService.js';
import { CaptureForecastSnapshotAction } from '../../../Server/src/custom/forecast-snapshot.action.js';

const USER = { ID: '00000000-0000-0000-0000-000000000001' } as unknown as UserInfo;

describe('ActivityWriterService deal existence check (#355 item 6)', () => {
    it('refuses when the deal read returns no row', async () => {
        const provider = {
            Entities: [
                { Name: E_ACTIVITY, ID: 'e-act' },
                { Name: E_ACTIVITY_LINK, ID: 'e-link' },
                { Name: E_DEAL, ID: 'e-deal' },
                { Name: E_ORGANIZATION, ID: 'e-org' },
                { Name: E_PERSON, ID: 'e-per' },
            ],
            RunView: vi.fn().mockImplementation(async (params: { EntityName: string }) => {
                if (params.EntityName === 'MJ_BizApps_Common: Activity Types') {
                    return { Success: true, Results: [{ ID: 'type-note' }] };
                }
                if (params.EntityName === E_DEAL) {
                    return { Success: true, Results: [] };
                }
                return { Success: true, Results: [] };
            }),
            BeginEntityTransaction: vi.fn(),
        } as unknown as IMetadataProvider;

        vi.spyOn(ActivityWriterService.prototype as unknown as {
            resolveTypeByCode: () => Promise<string | null>;
        }, 'resolveTypeByCode').mockResolvedValue('type-note');

        const out = await new ActivityWriterService().LogActivity(
            {
                DealID: '00000000-0000-0000-0000-000000000999',
                TypeCode: 'Note',
                Title: 'Should be refused',
                StartedAt: new Date('2026-10-01T00:00:00Z'),
            },
            provider,
            USER,
        );

        expect(out.Success).toBe(false);
        expect(out.Issues.join(' ')).toContain('was not found');
    });

    it('refuses when the deal read fails', async () => {
        const provider = {
            Entities: [
                { Name: E_ACTIVITY, ID: 'e-act' },
                { Name: E_ACTIVITY_LINK, ID: 'e-link' },
                { Name: E_DEAL, ID: 'e-deal' },
                { Name: E_ORGANIZATION, ID: 'e-org' },
                { Name: E_PERSON, ID: 'e-per' },
            ],
            RunView: vi.fn().mockImplementation(async (params: { EntityName: string }) => {
                if (params.EntityName === E_DEAL) {
                    return { Success: false, ErrorMessage: 'simulated read failure', Results: [] };
                }
                return { Success: true, Results: [{ ID: 'type-note' }] };
            }),
            BeginEntityTransaction: vi.fn(),
        } as unknown as IMetadataProvider;

        vi.spyOn(ActivityWriterService.prototype as unknown as {
            resolveTypeByCode: () => Promise<string | null>;
        }, 'resolveTypeByCode').mockResolvedValue('type-note');

        const out = await new ActivityWriterService().LogActivity(
            {
                DealID: '00000000-0000-0000-0000-000000000999',
                TypeCode: 'Note',
                Title: 'Should be refused',
                StartedAt: new Date('2026-10-01T00:00:00Z'),
            },
            provider,
            USER,
        );

        expect(out.Success).toBe(false);
        expect(out.Issues.join(' ')).toContain('could not be read');
    });
});

describe('CaptureForecastSnapshotAction date parsing (#355 item 7)', () => {
    it('refuses two unparseable dates naming PeriodStart instead of snapshotting the current month', async () => {
        const action = new CaptureForecastSnapshotAction();
        const res = await (action as unknown as {
            InternalRunAction(p: unknown): Promise<{ Success: boolean; ResultCode: string; Message: string }>;
        }).InternalRunAction({
            ContextUser: USER,
            Params: [
                { Name: 'PeriodStart', Value: '2026-13-01', Type: 'Input' },
                { Name: 'PeriodEnd', Value: 'garbage', Type: 'Input' },
            ],
        });

        expect(res.Success).toBe(false);
        expect(res.ResultCode).toBe('BAD_PERIOD');
        expect(res.Message).toContain('PeriodStart');
        expect(res.Message).toContain('2026-13-01');
    });

    it('refuses an unparseable PeriodEnd naming PeriodEnd', async () => {
        const action = new CaptureForecastSnapshotAction();
        const res = await (action as unknown as {
            InternalRunAction(p: unknown): Promise<{ Success: boolean; ResultCode: string; Message: string }>;
        }).InternalRunAction({
            ContextUser: USER,
            Params: [
                { Name: 'PeriodStart', Value: '2026-10-01', Type: 'Input' },
                { Name: 'PeriodEnd', Value: 'not-a-date', Type: 'Input' },
            ],
        });

        expect(res.Success).toBe(false);
        expect(res.ResultCode).toBe('BAD_PERIOD');
        expect(res.Message).toContain('PeriodEnd');
        expect(res.Message).toContain('not-a-date');
    });
});

describe('CloseDealOperation and ReopenDealOperation timeline activity (#381)', () => {
    it('writes a Deal closed Activity with outcome and reason after commit', async () => {
        const logged: LogActivityInput[] = [];
        vi.spyOn(ActivityWriterService.prototype, 'LogActivity').mockImplementation(async (input) => {
            logged.push(input);
            return {
                Success: true,
                ActivityID: 'act-1',
                LinkCount: 3,
                AlreadyPresent: false,
                Issues: [],
            };
        });

        const { CloseDealOperation, ReopenDealOperation } = await import('../CloseDealOperation.js');
        const dealStub = {
            ID: 'deal-1',
            Name: 'Timeline Deal',
            DealNumber: 'DEAL-1',
            PipelineID: 'pipe-1',
            PipelineStageID: 'stage-1',
            DealTypeID: 'type-1',
            DealStatusTypeID: 'status-open',
            CompanyID: 'comp-1',
            AccountID: 'acc-1',
            PrimaryContactID: 'per-1',
            OrderID: null,
            OrderID_Object: null,
            ContractID: null,
            ClosedAt: null as Date | null,
            ClosedByUserID: null as string | null,
            ActualCloseDate: null as Date | null,
            LossReasonID: null as string | null,
            LossReason: 'Budget',
            LossNotes: null as string | null,
            Probability: 50 as number | null,
            ForecastCategoryTypeID: 'fc-1' as string | null,
            OrderStatusWarnings: [] as string[],
            LastStageEventID: 'evt-1',
            DeclareTransition: vi.fn(),
            BeginClose: async (fn: () => Promise<boolean>) => fn(),
            BeginReopen: async (fn: () => Promise<boolean>) => fn(),
            Save: vi.fn().mockResolvedValue(true),
            Load: vi.fn().mockResolvedValue(true),
        };

        const provider = {
            Entities: [{ Name: E_ACTIVITY, ID: 'e-act' }],
            BeginTransaction: vi.fn().mockResolvedValue(undefined),
            CommitTransaction: vi.fn().mockResolvedValue(undefined),
            RollbackTransaction: vi.fn().mockResolvedValue(undefined),
            GetEntityObject: vi.fn().mockResolvedValue(dealStub),
            RunView: vi.fn().mockImplementation(async (params: { EntityName: string; ExtraFilter?: string }) => {
                if (params.EntityName === 'MJ_BizApps_Sales: Deal Status Types') {
                    if (params.ExtraFilter?.includes('status-lost')) {
                        return {
                            Success: true,
                            Results: [{ ID: 'status-lost', IsWon: false, IsLost: true, IsClosed: true, LocksDeal: true }],
                        };
                    }
                    return {
                        Success: true,
                        Results: [{ ID: 'status-open', IsWon: false, IsLost: false, IsClosed: false, LocksDeal: false }],
                    };
                }
                if (params.EntityName === 'MJ_BizApps_Sales: Loss Reasons') {
                    return {
                        Success: true,
                        Results: [{ ID: 'lr-1', Name: 'Budget', IsActive: true, RequiresNotes: false }],
                    };
                }
                return { Success: true, Results: [] };
            }),
        } as unknown as IMetadataProvider;

        const closeOp = new CloseDealOperation() as unknown as {
            InternalExecute(i: unknown, p: IMetadataProvider, u: UserInfo): Promise<{ Success: boolean }>;
        };
        const closeOut = await closeOp.InternalExecute(
            {
                DealID: 'deal-1',
                DealStatusTypeID: 'status-lost',
                LossReasonID: 'lr-1',
                Notes: 'Customer deferred budget',
            },
            provider,
            USER,
        );
        expect(closeOut.Success).toBe(true);
        expect(logged).toHaveLength(1);
        expect(logged[0].Title).toBe('Deal closed');
        expect(logged[0].Source).toBe('System');
        expect(logged[0].IncludeDealParties).toBe(true);
        expect(logged[0].Description).toContain('Outcome: Lost.');
        expect(logged[0].Description).toContain('Lost: Budget.');

        const reopenOp = new ReopenDealOperation() as unknown as {
            InternalExecute(i: unknown, p: IMetadataProvider, u: UserInfo): Promise<{ Success: boolean }>;
        };
        const reopenOut = await reopenOp.InternalExecute(
            {
                DealID: 'deal-1',
                Reason: 'Budget approved in Q4',
            },
            provider,
            USER,
        );
        expect(reopenOut.Success).toBe(true);
        expect(logged).toHaveLength(2);
        expect(logged[1].Title).toBe('Deal reopened');
        expect(logged[1].Description).toContain('Reason: Budget approved in Q4');
    });
});
