/**
 * @fileoverview Refuses a digest recipient row that would silently never receive mail.
 *
 * The digest's premise is that an administrator can see a wrong recipient in Explorer and fix it, so a
 * row that can never be delivered is refused when it is saved, with a message saying what to change:
 * a company-scoped audience with no company, a PORTFOLIO-WIDE audience that names one, an employee
 * with no email address, an employee who is inactive. `LoadDigestRecipients` also drops an employee
 * deactivated after the row was saved, and clears the company on a portfolio-wide row that predates
 * the refusal below; the two layers answer different moments.
 *
 * A refusal returns false and registers a failed result, as `DealStageEventEntityServer` does; it does
 * not throw, because every caller reads `LatestResult`.
 *
 * Saving a row as inactive is never refused: it is how an administrator retires a row whose employee
 * has since left.
 */
import {
    BaseEntity,
    BaseEntityResult,
    type EntitySaveOptions,
    type IRunViewProvider,
    LogError,
} from '@memberjunction/core';
import { EscapeSQLString, RegisterClass } from '@memberjunction/global';
import { mjBizAppsSalesDealDigestRecipientEntity } from '@mj-biz-apps/sales-entities';

import { AUDIENCE_ENTITY, EMPLOYEE_ENTITY, RECIPIENT_ENTITY } from './digest/shared.js';

const quote = (id: string): string => `'${EscapeSQLString(String(id))}'`;

@RegisterClass(BaseEntity, RECIPIENT_ENTITY)
export class DealDigestRecipientEntityServer extends mjBizAppsSalesDealDigestRecipientEntity {
    public override async Save(options?: EntitySaveOptions): Promise<boolean> {
        if (this.IsActive) {
            const reason = await this.findRefusal();
            if (reason !== null) {
                return this.refuse(reason);
            }
        }
        return super.Save(options);
    }

    /** The reason this row cannot be saved, or null when it can. */
    private async findRefusal(): Promise<string | null> {
        const view = this.ProviderToUse as unknown as IRunViewProvider;

        const audRead = await view.RunView<{ Name: string; IsPortfolioWide: boolean }>({
            EntityName: AUDIENCE_ENTITY,
            ExtraFilter: `ID = ${quote(this.DealDigestAudienceTypeID)}`,
            ResultType: 'simple',
            Fields: ['Name', 'IsPortfolioWide'],
        }, this.ContextCurrentUser);
        if (!audRead.Success) {
            return `The audience could not be read (${audRead.ErrorMessage}), so the row was not checked. Nothing was changed. Try again.`;
        }
        const audience = (audRead.Results ?? [])[0];
        if (!audience) {
            return 'The audience this row names no longer exists. Nothing was changed. Choose an audience that is in the list.';
        }
        if (!audience.IsPortfolioWide && !this.CompanyID) {
            return `The "${audience.Name}" audience is sent one company at a time, and this row has no company, so it would never receive mail. Nothing was changed. Choose the company this recipient covers.`;
        }
        // The converse, and the reason it is a refusal rather than a shrug: a portfolio-wide digest does
        // not depend on a company, so (CEO, NULL, E1) and (CEO, CompanyA, E1) are the SAME digest. They
        // do not collide on UQ_DealDigestRecipient, because CompanyID differs, and `LoadDigestRecipients`
        // now clears the company before the dedupe, so a row like this is harmless at run time — but it
        // is still a row an administrator would read as "the CEO digest for Company A", which is not a
        // thing. Refuse it here so the table says what it means.
        if (audience.IsPortfolioWide && this.CompanyID) {
            return `The "${audience.Name}" audience covers the whole portfolio in one email, so this row must not name a company: a company on it says this recipient gets a digest for that company alone, which this audience does not send. Nothing was changed. Clear the company on this row.`;
        }

        const empRead = await view.RunView<{ FirstName: string; LastName: string; Email: string; Active: boolean }>({
            EntityName: EMPLOYEE_ENTITY,
            ExtraFilter: `ID = ${quote(this.EmployeeID)}`,
            ResultType: 'simple',
            Fields: ['FirstName', 'LastName', 'Email', 'Active'],
        }, this.ContextCurrentUser);
        if (!empRead.Success) {
            return `The employee could not be read (${empRead.ErrorMessage}), so the row was not checked. Nothing was changed. Try again.`;
        }
        const employee = (empRead.Results ?? [])[0];
        if (!employee) {
            return 'The employee this row names no longer exists. Nothing was changed. Choose an employee that is in the list.';
        }
        const name = `${employee.FirstName} ${employee.LastName}`.trim();
        // Email is NOT NULL on Employees, so a missing address is a blank one.
        if (!employee.Email || employee.Email.trim() === '') {
            return `${name} has no email address, so the digest could not reach them. Nothing was changed. Add an email address to their employee record, then save this row again.`;
        }
        if (!employee.Active) {
            return `${name} is inactive, so the digest would never be sent to them. Nothing was changed. Choose an active employee, or reactivate this one first.`;
        }
        return null;
    }

    /** Mirrors `DealStageEventEntityServer.refuse`: log it, register a failed result, return false. */
    private refuse(message: string): false {
        LogError(`DealDigestRecipientEntityServer refused a save: ${message}`);
        const failed = new BaseEntityResult();
        failed.Success = false;
        failed.Type = this.IsSaved ? 'update' : 'create';
        failed.Message = message;
        failed.StartedAt = new Date();
        failed.EndedAt = new Date();
        failed.OriginalValues = this.Fields.map((f) => ({ FieldName: f.CodeName, Value: f.OldValue }));
        this.RegisterResultHistoryEntry(failed);
        return false;
    }
}
