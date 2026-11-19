import { RunView, type UserInfo } from '@memberjunction/core';
import type { MJCommunicationProviderMessageTypeEntity } from '@memberjunction/core-entities';
import { CommunicationEngine } from '@memberjunction/communication-engine';
import type { Message } from '@memberjunction/communication-types';
import { BusinessTimeZoneEngine, type CalendarDay } from '@mj-biz-apps/common-entities';

import { SelectForAudience, type DigestAudience } from './audience.js';
import { ReadCurrencyCodes } from './currency.js';
import { LoadLapsedDeals, MAX_DEALS_PER_RUN, type LapsedDealsResult } from './lapsed-deals.js';
import { LoadDigestRecipients, type DigestRecipient } from './recipients.js';
import { RenderDigest } from './render.js';
import { ReadSalesSetting, ResolveSender } from './sender.js';
import { AUDIENCE_ENTITY, CountDeals, lower } from './shared.js';

/**
 * The provider is a host's choice (Microsoft Graph, Gmail, SendGrid... any may be the active one), so it
 * is the `DigestProvider` Application Setting. The message type is not: `Email` is one of MJ's base
 * message types, and the one that carries an HTML body, so it is fixed.
 */
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
    To: string; From: string; Subject: string; BodyHtml: string; BodyText: string; AudienceCode: string; CompanyName: string | null;
}

export interface DigestRunResult {
    Success: boolean; TotalLapsedDeals: number; Truncated: boolean;
    Sent: number; SkippedEmpty: number; Errors: string[];
    RenderedEmails: RenderedEmail[];
}

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

/** What one send needs: the configured provider by name, and its `Email` message type. */
interface SendTarget { ProviderName: string; MessageType: MJCommunicationProviderMessageTypeEntity; }

/**
 * Resolves the provider and its message type on first use, once; a run with nothing to send never
 * reads them.
 *
 * WHY NOT MJ's `__SendSingleMessage` ACTION. That action accepts a plain-text `Body` and nothing
 * else: its class maps four params onto the message and declares no HTML parameter, so an HTML body
 * passed to it arrives as `Message.Body`, leaves `ProcessedHTMLBody` empty, and every provider then
 * picks `contentType: 'Text'` — the reader sees raw markup. Filed as MJ#6761; until that ships there
 * is no parameter spelling that would work, so this calls the Communication engine directly.
 *
 * The audit trail does not change. `CommunicationEngine.SendSingleMessage` writes the
 * `MJ: Communication Logs` row itself (`BaseEngine.StartLog`), before the provider is called and
 * refusing to send if the row cannot be saved, then writes the outcome back to it. That row records
 * To, From, Subject and both bodies — strictly more than the one `SUCCESS` row the action path left
 * in `MJ: Action Execution Logs`.
 */
class SendTargetLoader {
    private target: Promise<SendTarget> | null = null;
    constructor(private readonly contextUser: UserInfo, private readonly provider: string | null) {}

    get(): Promise<SendTarget> {
        if (!this.target) this.target = this.load();
        return this.target;
    }

    private async load(): Promise<SendTarget> {
        const name = requireProvider(this.provider);
        await CommunicationEngine.Instance.Config(false, this.contextUser);
        const provider = CommunicationEngine.Instance.Providers.find((p) => lower(p.Name) === lower(name));
        if (!provider) {
            const known = CommunicationEngine.Instance.Providers.map((p) => p.Name).join(', ') || 'none are configured';
            throw new Error(`the DigestProvider setting names '${name}', which is not a communication provider (${known})`);
        }
        const messageType = provider.MessageTypes.find((mt) => lower(mt.Name) === lower(SEND_MESSAGE_TYPE));
        if (!messageType) {
            throw new Error(`the '${provider.Name}' provider has no '${SEND_MESSAGE_TYPE}' message type, so an email cannot be sent through it`);
        }
        // The provider's own name, not the setting's spelling of it, so the engine's lookup matches this one.
        return { ProviderName: provider.Name, MessageType: messageType };
    }
}

/**
 * One send, with both parts of the message. `HTMLBody` carries the digest — that is the whole point of
 * calling the engine directly (see SendTargetLoader) — and `Body` carries the text rendition of the
 * same deals, NOT the markup: SendGrid (`text:` + `html:`) and Gmail build a real multipart/alternative
 * from the pair, while Microsoft Graph takes one content type and sends the HTML. Never assign the HTML
 * to `Body`; that is what delivered raw markup to readers in the first place.
 */
async function sendOne(target: SendTarget, contextUser: UserInfo, email: RenderedEmail): Promise<string | null> {
    const message: Message = {
        MessageType: target.MessageType,
        From: email.From,
        To: email.To,
        Subject: email.Subject,
        HTMLBody: email.BodyHtml,
        Body: email.BodyText,
    };
    // `MessageResult.Error` is the failure text; `MessageResult.Message` is the processed message object.
    const result = await CommunicationEngine.Instance.SendSingleMessage(
        target.ProviderName, SEND_MESSAGE_TYPE, message, undefined, false, undefined, contextUser,
    );
    return result.Success ? null : (result.Error || 'the provider reported failure with no message');
}

interface RunState {
    contextUser: UserInfo; options: DigestRunOptions; today: CalendarDay; deals: LapsedDealsResult;
    explorerBaseUrl: string | null; provider: string | null; currencyCodes: ReadonlyMap<string, string>; sendTarget: SendTargetLoader; result: DigestRunResult;
}

/**
 * The provider, narrowed to a string. The setting is `string | null`, and `strict` is off, so nothing
 * but this check ties a send to the up-front guard in RunLapsedCloseDateDigest; if that guard ever moves,
 * this fails loudly instead of resolving a provider named `null`.
 */
function requireProvider(provider: string | null): string {
    if (provider === null || provider === undefined) {
        throw new Error('the DigestProvider setting is empty, so there is nothing to send with');
    }
    return provider;
}

/** Who the override stands in for is the recipient; everything else about the email is the real one's. */
function withOverride(recipient: DigestRecipient, override: DigestRunOptions['recipientOverride']): DigestRecipient {
    return override ? { ...recipient, Email: override.email, FirstName: override.name, FullName: override.name } : recipient;
}

/** Selects, renders and (unless dry) sends one recipient's email. Failures are recorded, never thrown. */
async function deliverOne(state: RunState, audience: DigestAudience, recipient: DigestRecipient): Promise<void> {
    const { result, options } = state;
    // One person can hold a leader row at several companies (dedupe keys on audience AND company), so
    // for a company audience the label names the company, or two failures would read identically.
    const base = `${audience.Code} digest for ${recipient.Email}`;
    let label = base;
    let companyName: string | null = null;
    try {
        const groups = SelectForAudience(state.deals.Deals, audience, recipient.CompanyID);
        if (!audience.IsPortfolioWide) {
            companyName = groups[0]?.CompanyName || recipient.CompanyID;
            label = `${base} (company ${companyName})`;
        }
        if (groups.length === 0 && !audience.SendWhenEmpty) { result.SkippedEmpty++; return; }

        const sender = await ResolveSender(audience.IsPortfolioWide ? null : recipient.CompanyID, state.contextUser);
        if (!sender) {
            result.Errors.push(`${label} was not sent: no From address resolved (`
                + `${companyName === null ? 'this audience has no company' : `company ${companyName} has no default Mailbox sender identity`}, `
                + 'and the DigestFromAddress setting is empty).');
            return;
        }

        const target = withOverride(recipient, options.recipientOverride);
        const { Subject, BodyHtml, BodyText } = RenderDigest({
            audience, recipient: target, groups, today: state.today, explorerBaseUrl: state.explorerBaseUrl,
            dealsShown: CountDeals(groups), truncated: state.deals.Truncated, currencyCodes: state.currencyCodes,
        });
        const email: RenderedEmail = {
            To: target.Email, From: sender.From, Subject, BodyHtml, BodyText, AudienceCode: audience.Code,
            CompanyName: !audience.IsPortfolioWide && groups.length === 1 ? groups[0].CompanyName : null,
        };
        if (options.dryRun || options.captureRenderedEmails) result.RenderedEmails.push(email);
        if (options.dryRun) return;

        const failure = await sendOne(await state.sendTarget.get(), state.contextUser, email);
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
        if (deals.Truncated) {
            // Loud on purpose. The read is ordered by company, so a cut drops later companies WHOLESALE, and
            // their leaders then look exactly like a company with nothing lapsed (counted in SkippedEmpty).
            result.Errors.push(`The lapsed-deal read hit its cap (${MAX_DEALS_PER_RUN} deals requested, or fewer returned because the `
                + 'entity caps its views), so the list is incomplete. It is ordered by company, so companies later in the '
                + 'alphabet may be missing entirely, and their company-leader recipients will have been skipped as '
                + 'having nothing lapsed rather than mailed. Treat this run as unreliable.');
        }

        const audiences = await loadAudiences(contextUser);
        const recipients = await LoadDigestRecipients(contextUser);
        const provider = await ReadSalesSetting('DigestProvider', contextUser);
        const state: RunState = {
            contextUser, options, today, deals, result, sendTarget: new SendTargetLoader(contextUser, provider),
            explorerBaseUrl: await ReadSalesSetting('ExplorerBaseUrl', contextUser),
            provider,
            // Read once per run; never throws (see ReadCurrencyCodes), so it cannot stop the digest.
            currencyCodes: await ReadCurrencyCodes(contextUser),
        };
        if (!options.dryRun && state.provider === null) {
            // Once, up front: otherwise every send fails separately with the provider's own "not found".
            result.Errors.push('Nothing was sent: the DigestProvider setting is empty. Set it to the name of the active '
                + 'communication provider (for example the one named in MJ: Communication Providers) and run again.');
            return finish(result);
        }
        for (const audience of audiences) {
            for (const recipient of recipients.filter((r) => lower(r.AudienceTypeID) === lower(audience.ID))) {
                await deliverOne(state, audience, recipient);
            }
        }
    } catch (err) {
        result.Errors.push(`The digest run stopped: ${messageOf(err)}`);
    }
    return finish(result);
}

function finish(result: DigestRunResult): DigestRunResult {
    // A truncated run cannot claim "these are your lapsed deals", so it never reports success. The
    // truncation error pushed in RunLapsedCloseDateDigest and the `!Truncated` clause below are two
    // halves of one guarantee: today the error alone already makes Errors non-empty, so the clause looks
    // dead, but if the notice ever moves out of Errors (say, into a warnings field) this clause is what
    // still holds Success false. That error and this clause are two halves of one decision; change
    // neither alone.
    result.Success = result.Errors.length === 0 && !result.Truncated;
    return result;
}
