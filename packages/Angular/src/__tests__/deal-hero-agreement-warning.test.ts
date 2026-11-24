import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { RunView, type RunViewParams } from '@memberjunction/core';
import { MJSDealHeroPanel } from '../lib/form-panels/deal-hero.panel';
import {
    ContractLookupParams,
    ContractLookupResult,
    NoExecutedAgreementWarning,
    type OrderContractRow,
} from '../lib/form-panels/executed-agreement-warning';
import { MJS_FOREIGN_ENTITIES } from '../lib/data/entity-names';

/**
 * bc-aidp-next-golive#490: a won deal whose contract has no executed agreement says so in its header,
 * with a button to the contract. g490.2 A: the button opens the contract. g490.3 B: only the
 * executed-agreement case; a deal with no contract gets no warning. g490.4 A: warn only.
 *
 * The rule and the contract lookup are the order header's (#443), moved into one module so the two
 * surfaces cannot disagree. `RunView.prototype` is patched rather than the module mocked, so the
 * hero's own read and wiring stay real.
 */

const DEAL = 'D1B0F0A6-0000-4000-8000-000000000001';
const CONTRACT = 'C0000000-0000-4000-8000-000000000001';
const ACTIVE: OrderContractRow = { ID: CONTRACT, ContractNumber: 'CTR-000123', State: 'Active', IsAwaitingDocument: false };
const AWAITING: OrderContractRow = { ...ACTIVE, State: 'Draft', IsAwaitingDocument: true };
const won = { DealID: DEAL, DealIsWon: true, ContractRead: true };

describe('the deal surface of NoExecutedAgreementWarning', () => {
    it('warns for a won deal whose contract awaits its executed agreement', () => {
        const warning = NoExecutedAgreementWarning({ ...won, Contract: AWAITING }, 'deal');
        expect(warning?.Label).toBe('No executed agreement');
        expect(warning?.Detail).toMatch(/upload and mark/);
        expect(warning?.Detail).not.toContain('Invoices');
    });

    it('does not warn when the deal has no contract (g490.3 B), though the order does', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: null }, 'deal')).toBeNull();
        expect(NoExecutedAgreementWarning({ ...won, Contract: null })?.Label).toBe('No executed agreement');
    });

    it('says nothing when the agreement is marked, the deal is not won, or the lookup did not answer', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: ACTIVE }, 'deal')).toBeNull();
        expect(NoExecutedAgreementWarning({ ...won, DealIsWon: false, Contract: AWAITING }, 'deal')).toBeNull();
        expect(NoExecutedAgreementWarning({ DealID: DEAL, DealIsWon: true, Contract: AWAITING }, 'deal')).toBeNull();
    });

    it('defaults to the order surface, so the order header is unchanged', () => {
        expect(NoExecutedAgreementWarning({ ...won, Contract: AWAITING })?.Detail).toContain('Invoices still send');
    });
});

describe('the shared contract lookup', () => {
    it('reads the contract by Deal.ContractID, newest first, with the columns the warning needs', () => {
        const p = ContractLookupParams({ DealID: DEAL, ContractID: CONTRACT })!;
        expect(p.EntityName).toBe(MJS_FOREIGN_ENTITIES.Contract);
        expect(p.ExtraFilter).toBe(`ID = '${CONTRACT}'`);
        expect(p.Fields).toEqual(['ID', 'ContractNumber', 'State', 'IsAwaitingDocument']);
        expect(p.OrderBy).toBe('__mj_CreatedAt DESC');
    });

    it('falls back to the close provenance, and reads nothing without a deal', () => {
        expect(ContractLookupParams({ DealID: DEAL })!.ExtraFilter).toContain(`CreatingRecordID = '${DEAL}'`);
        expect(ContractLookupParams({})).toBeNull();
    });

    it('treats a refused read as unknown, never as "no contract"', () => {
        expect(ContractLookupResult({ Success: false, Results: [] } as never)).toEqual({ Contract: null, ContractRead: false });
        expect(ContractLookupResult({ Success: true, Results: [] } as never)).toEqual({ Contract: null, ContractRead: true });
        expect(ContractLookupResult(null)).toEqual({ Contract: null, ContractRead: false });
    });

    it('is the read the order header makes too', () => {
        const orderPanel = readFileSync(fileURLToPath(new URL('../lib/form-panels/order-related.panel.ts', import.meta.url)), 'utf8');
        expect(orderPanel).toContain('const lookup = ContractLookupParams(state);');
        expect(orderPanel).toContain('...ContractLookupResult(contracts),');
    });
});

const originalRunView = RunView.prototype.RunView;
afterEach(() => {
    RunView.prototype.RunView = originalRunView;
});

/** The hero with just what `resolveAgreementWarning` reads. `Object.create` skips field initialisers. */
function hero(record: { ID: string; IsSaved: boolean; ContractID: string | null }, isWon: boolean): MJSDealHeroPanel {
    const p = Object.create(MJSDealHeroPanel.prototype) as MJSDealHeroPanel;
    Object.defineProperty(p, 'FormComponent', { value: { ProviderToUse: { CurrentUser: {} } } });
    Object.defineProperty(p, 'Record', { value: record });
    Object.assign(p, { IsWon: isWon, AgreementWarning: null, AgreementContractID: null, agreementGeneration: 0 });
    return p;
}

async function resolve(p: MJSDealHeroPanel): Promise<void> {
    await (p as unknown as { resolveAgreementWarning(): Promise<void> }).resolveAgreementWarning();
}

function stubContract(result: { Success: boolean; Results: unknown[] }, seen: RunViewParams[] = []): RunViewParams[] {
    RunView.prototype.RunView = (async (params: RunViewParams) => {
        seen.push(params);
        return result;
    }) as unknown as typeof RunView.prototype.RunView;
    return seen;
}

describe('the deal hero feeds the warning', () => {
    it('shows the chip and the contract to open for a won deal whose contract is awaiting', async () => {
        stubContract({ Success: true, Results: [AWAITING] });
        const p = hero({ ID: DEAL, IsSaved: true, ContractID: CONTRACT }, true);
        await resolve(p);
        expect(p.AgreementWarning?.Label).toBe('No executed agreement');
        expect(p.AgreementContractID).toBe(CONTRACT);
    });

    it('reads nothing for a deal that is not won', async () => {
        const seen = stubContract({ Success: true, Results: [AWAITING] });
        const p = hero({ ID: DEAL, IsSaved: true, ContractID: CONTRACT }, false);
        await resolve(p);
        expect(seen).toHaveLength(0);
        expect(p.AgreementWarning).toBeNull();
    });

    it('says nothing when the read is refused or the agreement is marked', async () => {
        stubContract({ Success: false, Results: [] });
        const refused = hero({ ID: DEAL, IsSaved: true, ContractID: CONTRACT }, true);
        await resolve(refused);
        expect(refused.AgreementWarning).toBeNull();

        stubContract({ Success: true, Results: [ACTIVE] });
        const marked = hero({ ID: DEAL, IsSaved: true, ContractID: CONTRACT }, true);
        await resolve(marked);
        expect(marked.AgreementWarning).toBeNull();
        expect(marked.AgreementContractID).toBeNull();
    });

    it('says nothing for a won deal with no contract', async () => {
        stubContract({ Success: true, Results: [] });
        const p = hero({ ID: DEAL, IsSaved: true, ContractID: null }, true);
        await resolve(p);
        expect(p.AgreementWarning).toBeNull();
    });

    it('renders the chip and an Open contract button in the header', () => {
        const src = readFileSync(fileURLToPath(new URL('../lib/form-panels/deal-hero.panel.ts', import.meta.url)), 'utf8');
        expect(src).toContain('@if (AgreementWarning; as warning)');
        expect(src).toContain('data-testid="deal-hero-no-agreement"');
        expect(src).toContain('(click)="OpenAgreementContract($event)"');
        expect(src).toContain('this.open(event, MJS_FOREIGN_ENTITIES.Contract, this.AgreementContractID);');
    });
});
