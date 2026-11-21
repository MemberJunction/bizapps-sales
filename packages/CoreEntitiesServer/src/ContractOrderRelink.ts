/**
 * Daily relink of won deals' orders to their contracts (contracts#77).
 *
 * A Won close links the deal's order to its contract as it commits (`LinkOrderToContract`). Two cases
 * leave a won deal without that link, and both are repaired here:
 *
 *   - the installed contracts release is older than the link, so the close could only report it as
 *     pending. Every deal closed in that window is linked on the first run after the upgrade;
 *   - the link save was refused at close time. The close still committed, so nothing else retries it.
 *
 * Until contracts has the `Contract Orders` entity the run skips and succeeds: that is the expected
 * state of an older contracts release, not a fault.
 *
 * Won is read from `DealStatusType.IsWon`, never a status name.
 */
import {
    LogStatus,
    Metadata,
    RunView,
    type BaseEntity,
    type IMetadataProvider,
    type RunViewParams,
    type UserInfo,
} from '@memberjunction/core';
import { NormalizeUUID } from '@memberjunction/global';

const E_DEAL = 'MJ_BizApps_Sales: Deals';
const E_DEAL_STATUS = 'MJ_BizApps_Sales: Deal Status Types';
const E_CONTRACT_ORDER = 'MJ_BizApps_Contracts: Contract Orders';
/** Keeps each link lookup's IN list well inside SQL Server's parameter and statement limits. */
const LOOKUP_CHUNK = 500;

export type ContractOrderRelinkOutcome = 'LINKED' | 'NONE_MISSING' | 'SKIPPED' | 'QUERY_FAILED' | 'LINK_FAILED';

export interface ContractOrderRelinkResult {
    Success: boolean;
    Outcome: ContractOrderRelinkOutcome;
    /** Won deals carrying both a contract and an order. */
    Found: number;
    /** Of those deals, the ones whose pair was linked before this run. */
    AlreadyLinked: number;
    /** Links this run created. */
    Linked: number;
    /** Links this run tried and could not save. */
    Failed: number;
    Issues: string[];
}

/** One won deal's contract and order. */
interface ContractOrderPair {
    DealID: string;
    ContractID: string;
    OrderID: string;
}

function result(outcome: ContractOrderRelinkOutcome, success: boolean, issues: string[] = []): ContractOrderRelinkResult {
    return { Success: success, Outcome: outcome, Found: 0, AlreadyLinked: 0, Linked: 0, Failed: 0, Issues: issues };
}

function pairKey(contractID: string, orderID: string): string {
    return `${NormalizeUUID(contractID)}|${NormalizeUUID(orderID)}`;
}

/** Strips anything that is not a GUID character, so an ID can sit inside an ExtraFilter safely. */
function safeID(id: string): string {
    return id.replace(/[^0-9A-Fa-f-]/g, '');
}

export async function RelinkWonDealOrdersToContracts(
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<ContractOrderRelinkResult> {
    if (!new Metadata().Entities.some((e) => e.Name === E_CONTRACT_ORDER)) {
        return result('SKIPPED', true, [
            'The installed Contracts app cannot link orders to contracts yet, so there is nothing to link until it is upgraded.',
        ]);
    }
    const pairs = await readWonDealPairs(user);
    if (typeof pairs === 'string') {
        return result('QUERY_FAILED', false, [pairs]);
    }
    const existing = await readExistingLinks(pairs, user);
    if (typeof existing === 'string') {
        return result('QUERY_FAILED', false, [existing]);
    }
    const missing = uniqueMissing(pairs, existing);
    const out = await createLinks(missing, provider, user);
    out.Found = pairs.length;
    out.AlreadyLinked = pairs.filter((p) => existing.has(pairKey(p.ContractID, p.OrderID))).length;
    LogStatus(
        `Contract order relink: ${out.Found} won deal(s) with a contract and an order, ` +
            `${out.AlreadyLinked} already linked, ${out.Linked} linked, ${out.Failed} failed.`,
    );
    return out;
}

/** Won deals with both IDs set, or the error message when either read fails. */
async function readWonDealPairs(user: UserInfo): Promise<ContractOrderPair[] | string> {
    const statuses = await new RunView().RunView<{ ID: string }>(
        { EntityName: E_DEAL_STATUS, ExtraFilter: 'IsWon = 1', Fields: ['ID'], ResultType: 'simple' },
        user,
    );
    if (!statuses.Success) {
        return `Could not read the deal statuses: ${statuses.ErrorMessage ?? 'unknown error'}`;
    }
    const wonIDs = (statuses.Results ?? []).map((s) => `'${safeID(s.ID)}'`);
    if (wonIDs.length === 0) {
        return [];
    }
    const deals = await new RunView().RunView<{ ID: string; ContractID: string; OrderID: string }>(
        {
            EntityName: E_DEAL,
            ExtraFilter: `ContractID IS NOT NULL AND OrderID IS NOT NULL AND DealStatusTypeID IN (${wonIDs.join(',')})`,
            Fields: ['ID', 'ContractID', 'OrderID'],
            OrderBy: 'ID',
            ResultType: 'simple',
        },
        user,
    );
    if (!deals.Success) {
        return `Could not read the won deals: ${deals.ErrorMessage ?? 'unknown error'}`;
    }
    return (deals.Results ?? []).map((d) => ({ DealID: d.ID, ContractID: d.ContractID, OrderID: d.OrderID }));
}

/** The contract/order pairs already linked, keyed by `pairKey`, or the error message on a failed read. */
async function readExistingLinks(pairs: ContractOrderPair[], user: UserInfo): Promise<Set<string> | string> {
    const contractIDs = [...new Set(pairs.map((p) => safeID(p.ContractID)))];
    const views: RunViewParams[] = [];
    for (let i = 0; i < contractIDs.length; i += LOOKUP_CHUNK) {
        const chunk = contractIDs.slice(i, i + LOOKUP_CHUNK).map((id) => `'${id}'`);
        views.push({
            EntityName: E_CONTRACT_ORDER,
            ExtraFilter: `ContractID IN (${chunk.join(',')})`,
            Fields: ['ContractID', 'OrderID'],
            ResultType: 'simple',
        });
    }
    const linked = new Set<string>();
    if (views.length === 0) {
        return linked;
    }
    const results = await new RunView().RunViews<{ ContractID: string; OrderID: string }>(views, user);
    for (const links of results) {
        if (!links.Success) {
            return `Could not read the existing contract order links: ${links.ErrorMessage ?? 'unknown error'}`;
        }
        for (const link of links.Results ?? []) {
            linked.add(pairKey(link.ContractID, link.OrderID));
        }
    }
    return linked;
}

/** Pairs with no link yet, one per contract/order pair even when two deals share it. */
function uniqueMissing(pairs: ContractOrderPair[], existing: Set<string>): ContractOrderPair[] {
    const seen = new Set<string>();
    return pairs.filter((p) => {
        const key = pairKey(p.ContractID, p.OrderID);
        if (existing.has(key) || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/** Saves one link per pair. Each saves on its own, so one refusal does not stop the rest. */
async function createLinks(
    missing: ContractOrderPair[],
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<ContractOrderRelinkResult> {
    const out = result('NONE_MISSING', true);
    for (const pair of missing) {
        const link = await provider.GetEntityObject<BaseEntity>(E_CONTRACT_ORDER, user);
        link.NewRecord();
        link.Set('ContractID', pair.ContractID);
        link.Set('OrderID', pair.OrderID);
        if (await link.Save()) {
            out.Linked++;
        } else {
            out.Failed++;
            out.Issues.push(`Deal ${pair.DealID}: ${link.LatestResult?.CompleteMessage ?? 'unknown error'}`);
        }
    }
    if (out.Failed > 0) {
        out.Success = false;
        out.Outcome = 'LINK_FAILED';
    } else if (out.Linked > 0) {
        out.Outcome = 'LINKED';
    }
    return out;
}
