import { Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { ApplicationSettingEngine } from '@memberjunction/core-entities';
import { EscapeSQLString } from '@memberjunction/global';
import { DefaultSenderForCompany, type CompanySenderIdentityRow } from '@mj-biz-apps/common-entities';

const SENDER_IDENTITY_ENTITY = 'MJ_BizApps_Common: Company Sender Identities';
const SALES_APPLICATION_NAME = 'Sales';

export type SenderFromResolution = { From: string; FromName: string | null } | null;

/**
 * A Sales Application Setting, or null when it is not configured. The shipped rows carry an EMPTY
 * value, so "not configured" arrives as "", whitespace or undefined, and `"" ?? null` is "": all of
 * them mean unset. The value is returned trimmed.
 */
export async function ReadSalesSetting(name: string, contextUser: UserInfo): Promise<string | null> {
    const engine = ApplicationSettingEngine.Instance;
    await engine.Config(false, contextUser);
    const applicationID = new Metadata().Applications?.find((a) => a.Name === SALES_APPLICATION_NAME)?.ID;
    const value = (engine.GetSetting(name, applicationID) ?? '').trim();
    return value === '' ? null : value;
}

async function companyDefaultSender(companyID: string, contextUser: UserInfo): Promise<SenderFromResolution> {
    const r = await new RunView().RunView<CompanySenderIdentityRow>({
        EntityName: SENDER_IDENTITY_ENTITY,
        ExtraFilter: `CompanyID = '${EscapeSQLString(companyID)}'`,
        ResultType: 'simple',
        Fields: ['CompanyID', 'Kind', 'Address', 'DisplayName', 'IsDefault'],
    }, contextUser);
    if (!r.Success) throw new Error(`Could not read the sender identities of company ${companyID}: ${r.ErrorMessage}`);
    const found = DefaultSenderForCompany(companyID, r.Results ?? []);
    // `found` is { from, fromName }; this module's type is { From, FromName }. Mapped by name.
    return found ? { From: found.from, FromName: found.fromName } : null;
}

/**
 * Who the digest is sent as: the company's default Mailbox when there is a company, otherwise (or when
 * the company has none) the `DigestFromAddress` setting. Null when neither resolves; the caller reports
 * that as a failure. Throws when the identity read itself fails, rather than falling back past it.
 */
export async function ResolveSender(companyID: string | null, contextUser: UserInfo): Promise<SenderFromResolution> {
    if (companyID) {
        const fromCompany = await companyDefaultSender(companyID, contextUser);
        if (fromCompany) return fromCompany;
    }
    const configured = await ReadSalesSetting('DigestFromAddress', contextUser);
    return configured === null ? null : { From: configured, FromName: null };
}
