/**
 * @fileoverview The user Sales' order vetoes read Deals as.
 *
 * Orders asks Sales, through its confirm and line-edit seams, whether a deal stands in the way. Those
 * reads ran as the caller, and a caller who may confirm orders but cannot read Deals (an Orders-only
 * finance role) got a failed read, which the seam turns into a refusal. Every confirm on that host was
 * refused, including orders no deal points at (#423).
 *
 * The question is not the caller's to answer: it is a rule enforced on the server, the same for every
 * caller, so it reads as the system user. The caller is the fallback only when the user cache holds no
 * system user (a host still starting, or a unit test), which keeps the old behaviour there.
 *
 * @module @mj-biz-apps/sales-core-entities-server
 */
import { Metadata, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/sqlserver-dataprovider';

/** The system user when the cache has one, else the caller. */
export function VetoReader(contextUser: UserInfo | null | undefined): UserInfo | undefined {
    let system: UserInfo | undefined;
    try {
        system = UserCache.Instance.GetSystemUser() ?? undefined;
    } catch {
        system = undefined;
    }
    return system ?? contextUser ?? undefined;
}

/**
 * Whether the caller may read Deals. The vetoes read as the system user, so a refusal shown to a caller
 * without that grant must not carry what the read found, such as a deal number. No caller (a system
 * context) counts as able to read; an entity or permission that cannot be resolved counts as not.
 */
export function CallerCanReadDeals(contextUser: UserInfo | null | undefined): boolean {
    if (!contextUser) return true;
    try {
        return new Metadata().EntityByName('MJ_BizApps_Sales: Deals')?.GetUserPermisions(contextUser)?.CanRead === true;
    } catch {
        return false;
    }
}
