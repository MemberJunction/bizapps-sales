/**
 * The bridge fails loud when accounting's operations are not registered.
 *
 * No fake is registered in this file, so both contract keys are unregistered. The first check pins
 * why a null check is not enough: `CreateInstance` hands back a hollow base instance for such a key.
 */
import { describe, expect, it } from 'vitest';
import { BaseRemotableOperation } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';

import {
    GetFinanceExceptionTypes,
    OP_GET_FINANCE_EXCEPTION_TYPES,
    OP_RAISE_FINANCE_EXCEPTIONS,
    RaiseFinanceExceptions,
} from '../finance-exceptions/FinanceExceptionBridge.js';

const USER = { ID: 'user-1' } as never;
const PROVIDER = {} as never;

describe('an unregistered accounting operation', () => {
    it('does not resolve, although CreateInstance would still return an instance', () => {
        const res = MJGlobal.Instance.ClassFactory.TryCreateInstance(BaseRemotableOperation, OP_RAISE_FINANCE_EXCEPTIONS);
        expect(res.Resolved).toBe(false);
        expect(MJGlobal.Instance.ClassFactory.CreateInstance(BaseRemotableOperation, OP_RAISE_FINANCE_EXCEPTIONS)).not.toBeNull();
    });

    it('makes reading the types throw the not-registered error', async () => {
        await expect(GetFinanceExceptionTypes({ Codes: ['X'] }, PROVIDER, USER)).rejects.toThrow(
            `The '${OP_GET_FINANCE_EXCEPTION_TYPES}' operation is not registered.`,
        );
    });

    it('makes raising throw the not-registered error', async () => {
        await expect(RaiseFinanceExceptions({ Exceptions: [] }, PROVIDER, USER)).rejects.toThrow(
            `The '${OP_RAISE_FINANCE_EXCEPTIONS}' operation is not registered.`,
        );
    });
});
