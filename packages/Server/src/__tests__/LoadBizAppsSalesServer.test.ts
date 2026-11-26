/**
 * The anchor is only half of the registration: `LoadLapsedCloseDateDigestAgent()` must be CALLED from
 * `LoadBizAppsSalesServer()`, or a bundler drops the agent module and `ClassFactory` silently returns a
 * base class (no build error).
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT. The agent module is replaced by a spy and every other import of
 * the bootstrap is stubbed, so this proves the call site only: the bootstrap invokes the anchor. It does
 * not prove the decorator registers under the right driver class, nor that a real bundler keeps the
 * module; those need MJ metadata and a bundle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAgent = vi.fn();
const loadSalesEngineBase = vi.fn();
vi.mock('../custom/lapsed-close-date-digest.agent.js', () => ({ LoadLapsedCloseDateDigestAgent: loadAgent }));
vi.mock('@mj-biz-apps/sales-entities', () => ({ LoadSalesDealEntities: vi.fn(), LoadSalesEngineBase: loadSalesEngineBase }));
vi.mock('@mj-biz-apps/sales-actions', () => ({}));
vi.mock('@mj-biz-apps/sales-core-entities-server', () => ({
    LoadDealLockOrderLineVeto: vi.fn(), LoadDealNotWonConfirmVeto: vi.fn(), LoadDealOrderLink: vi.fn(),
    LoadSalesCoreEntitiesServer: vi.fn(),
}));
vi.mock('../custom/forecast-snapshot.action.js', () => ({ LoadCaptureForecastSnapshotAction: vi.fn() }));
vi.mock('../custom/log-activity.action.js', () => ({ LoadLogActivityAction: vi.fn() }));
vi.mock('../custom/won-deal-order-detector.action.js', () => ({ LoadDetectWonDealsWithUnconfirmedOrdersAction: vi.fn() }));
vi.mock('../custom/contract-order-relink.action.js', () => ({ LoadRelinkWonDealOrdersToContractsAction: vi.fn() }));
vi.mock('../custom/link-default-pipeline.action.js', () => ({ LoadLinkDefaultPipelineToCompaniesAction: vi.fn() }));
vi.mock('../generated/generated.js', () => ({}));
vi.mock('../generated/class-registrations-manifest.js', () => ({ CLASS_REGISTRATIONS: [] }));

const { LoadBizAppsSalesServer } = await import('../index.js');

describe('LoadBizAppsSalesServer', () => {
    beforeEach(() => {
        loadAgent.mockClear();
        loadSalesEngineBase.mockClear();
    });

    it('calls the lapsed close date digest agent and SalesEngineBase anchors', () => {
        LoadBizAppsSalesServer();
        expect(loadAgent).toHaveBeenCalledTimes(1);
        expect(loadSalesEngineBase).toHaveBeenCalledTimes(1);
    });
});
