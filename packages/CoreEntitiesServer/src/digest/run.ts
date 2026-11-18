import { RunView, type UserInfo } from '@memberjunction/core';
import type { MJActionEntity } from '@memberjunction/core-entities';
import { ActionEngineServer } from '@memberjunction/actions';
import { ActionParam, RunActionParams } from '@memberjunction/actions-base';
import { BusinessTimeZoneEngine, type CalendarDay } from '@mj-biz-apps/common-entities';

import { SelectForAudience, type CompanyGroup, type DigestAudience } from './audience.js';
import { LoadLapsedDeals, type LapsedDealsResult } from './lapsed-deals.js';
import { LoadDigestRecipients, type DigestRecipient } from './recipients.js';
import { RenderDigest } from './render.js';
import { ReadSalesSetting, ResolveSender } from './sender.js';

const AUDIENCE_ENTITY = 'MJ_BizApps_Sales: Deal Digest Audience Types';
const ACTION_ENTITY = 'MJ: Actions';
/** The send action is found by the class that implements it, not by a display name an admin can edit. */
const SEND_ACTION_DRIVER_CLASS = '__SendSingleMessage';
const SEND_PROVIDER = 'Microsoft Graph';
const SEND_MESSAGE_TYPE = 'Email';

export interface DigestRunOptions {
    /** Render every email and report it; load no action and send nothing. */
    dryRun?: boolean;
    /** Return each rendered email in `RenderedEmails` on a real run too (a dry run always does). */
    captureRenderedEmails?: boolean;
    /** Send every email here instead of to its real recipient. Subjects and bodies are unchanged. */
    recipientOverride?: { name: string; email: string };
}

export interface RenderedEmail {
    To: string; From: string; Subject: string; BodyHtml: string; AudienceCode: string; CompanyName: string | null;
}

export interface DigestRunResult {
    Success: boolean; TotalLapsedDeals: number; Truncated: boolean;
    Sent: number; SkippedEmpty: number; Errors: string[];
    RenderedEmails: RenderedEmail[];
}

const lower = (id: string | null | undefined): string => (id ?? '').toLowerCase();
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function loadAudiences(contextUser: UserInfo): Promise<DigestAudience[]> {
    const r = await new RunView().RunView<DigestAudience>({
        EntityName: AUDIENCE_ENTITY, ExtraFilter: 'IsActive = 1', OrderBy: 'DisplayRank', ResultType: 'simple',
        Fields: ['ID', 'Code', 'Name', 'IsPortfolioWide', 'MinDaysLapsed', 'IncludeMissingCloseDate', 'SendWhenEmpty',
            'GroupByCompany', 'SubjectTemplate', 'IntroTemplate', 'EmptyMessage', 'DisplayRank'],
    }, contextUser);
    if (!r.Success) throw new Error(`Could not read the digest audiences: ${r.ErrorMessage}`);
    return [...(r.Results ?? [])].sort((a, b) => a.DisplayRank - b.DisplayRank);
}

/** Looks the send action up on first use, once; a run with nothing to send never reads it. */
class SendActionLoader {
    private action: Promise<MJActionEntity> | null = null;
    constructor(private readonly contextUser: UserInfo) {}

    get(): Promise<MJActionEntity> {
        if (!this.action) this.action = this.load();
        return this.action;
    }

    private async load(): Promise<MJActionEntity> {
        await ActionEngineServer.Instance.Config(false, this.contextUser);
        const r = await new RunView().RunView<MJActionEntity>({
            EntityName: ACTION_ENTITY, ExtraFilter: `DriverClass = '${SEND_ACTION_DRIVER_CLASS}' AND Status = 'Active'`,
            ResultType: 'entity_object', MaxRows: 1,
        }, this.contextUser);
        if (!r.Success) throw new Error(`Could not look up the send action (DriverClass ${SEND_ACTION_DRIVER_CLASS}): ${r.ErrorMessage}`);
        const action = r.Results?.[0];
        if (!action) throw new Error(`No active action with DriverClass ${SEND_ACTION_DRIVER_CLASS} exists, so nothing can be sent.`);
        return action;
    }
}

function actionParam(Name: string, Value: string): ActionParam {
    return Object.assign(new ActionParam(), { Name, Value, Type: 'Input' as const });
}

/**
 * One RunAction call, so the send lands a row in `MJ: Action Execution Logs`. `SkipActionLog` stays
 * unset on purpose: that log is how anyone later answers "did Monday's run actually send". `Filters` is
 * declared non-optional on RunActionParams although its comment says optional, so it is passed as [].
 */
async function sendOne(action: MJActionEntity, contextUser: UserInfo, email: RenderedEmail): Promise<string | null> {
    const params = new RunActionParams();
    params.Action = action;
    params.ContextUser = contextUser;
    params.Filters = [];
    params.Params = [
        actionParam('To', email.To), actionParam('From', email.From), actionParam('Subject', email.Subject),
        actionParam('Body', email.BodyHtml), actionParam('Provider', SEND_PROVIDER), actionParam('MessageType', SEND_MESSAGE_TYPE),
    ];
    const result = await ActionEngineServer.Instance.RunAction(params);
    return result.Success ? null : (result.Message || 'the send action reported failure with no message');
}

interface RunState {
    contextUser: UserInfo; options: DigestRunOptions; today: CalendarDay; deals: LapsedDealsResult;
    explorerBaseUrl: string | null; sendAction: SendActionLoader; result: DigestRunResult;
}

const countDeals = (groups: readonly CompanyGroup[]): number => groups.reduce((n, g) => n + g.Deals.length, 0);

/** Who the override stands in for is the recipient; everything else about the email is the real one's. */
function withOverride(recipient: DigestRecipient, override: DigestRunOptions['recipientOverride']): DigestRecipient {
    return override ? { ...recipient, Email: override.email, FirstName: override.name, FullName: override.name } : recipient;
}

/** Selects, renders and (unless dry) sends one recipient's email. Failures are recorded, never thrown. */
async function deliverOne(state: RunState, audience: DigestAudience, recipient: DigestRecipient): Promise<void> {
    const { result, options } = state;
    const label = `${audience.Code} digest for ${recipient.Email}`;
    try {
        const groups = SelectForAudience(state.deals.Deals, audience, recipient.CompanyID);
        if (groups.length === 0 && !audience.SendWhenEmpty) { result.SkippedEmpty++; return; }

        const sender = await ResolveSender(audience.IsPortfolioWide ? null : recipient.CompanyID, state.contextUser);
        if (!sender) {
            result.Errors.push(`${label} was not sent: no From address resolved (the company has no default Mailbox sender identity, `
                + 'and the DigestFromAddress setting is empty).');
            return;
        }

        const target = withOverride(recipient, options.recipientOverride);
        const { Subject, BodyHtml } = RenderDigest({
            audience, recipient: target, groups, today: state.today, explorerBaseUrl: state.explorerBaseUrl,
            totalDeals: countDeals(groups), truncated: state.deals.Truncated,
        });
        const email: RenderedEmail = {
            To: target.Email, From: sender.From, Subject, BodyHtml, AudienceCode: audience.Code,
            CompanyName: !audience.IsPortfolioWide && groups.length === 1 ? groups[0].CompanyName : null,
        };
        if (options.dryRun || options.captureRenderedEmails) result.RenderedEmails.push(email);
        if (options.dryRun) return;

        const failure = await sendOne(await state.sendAction.get(), state.contextUser, email);
        if (failure) result.Errors.push(`${label} failed to send: ${failure}`);
        else result.Sent++;
    } catch (err) {
        result.Errors.push(`${label} failed: ${messageOf(err)}`);
    }
}

/**
 * The Monday run: read the lapsed deals once, then for each audience in DisplayRank order and each
 * (deduplicated) recipient, select, render and send. One failed email never stops the others; the run
 * reports `Success: false` with every failure in `Errors`.
 *
 * "Today" is one business day for the whole run (`BusinessTimeZoneEngine.Today()`, no company), the
 * same day `DealEntityServer` and `CloseDealOperation` use.
 */
export async function RunLapsedCloseDateDigest(contextUser: UserInfo, options: DigestRunOptions = {}): Promise<DigestRunResult> {
    const result: DigestRunResult = {
        Success: false, TotalLapsedDeals: 0, Truncated: false, Sent: 0, SkippedEmpty: 0, Errors: [], RenderedEmails: [],
    };
    try {
        await BusinessTimeZoneEngine.Instance.Config(false, contextUser);
        const today = BusinessTimeZoneEngine.Instance.Today();
        const deals = await LoadLapsedDeals(contextUser, today);
        result.TotalLapsedDeals = deals.Deals.length;
        result.Truncated = deals.Truncated;

        const audiences = await loadAudiences(contextUser);
        const recipients = await LoadDigestRecipients(contextUser);
        const state: RunState = {
            contextUser, options, today, deals, result, sendAction: new SendActionLoader(contextUser),
            explorerBaseUrl: await ReadSalesSetting('ExplorerBaseUrl', contextUser),
        };
        for (const audience of audiences) {
            for (const recipient of recipients.filter((r) => lower(r.AudienceTypeID) === lower(audience.ID))) {
                await deliverOne(state, audience, recipient);
            }
        }
    } catch (err) {
        result.Errors.push(`The digest run stopped: ${messageOf(err)}`);
    }
    result.Success = result.Errors.length === 0;
    return result;
}
