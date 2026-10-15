import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ValidationResult } from '@memberjunction/core';
import {
    DealTeamMemberEntity,
    TEAM_MEMBER_BOTH_MESSAGE,
    TEAM_MEMBER_NEITHER_MESSAGE,
} from '../deal-team-member-entity';
import { mjBizAppsSalesDealTeamMemberEntity } from '../generated/entity_subclasses';

/**
 * A TEAM MEMBER IS AN EMPLOYEE OR A PERSON, NEVER BOTH.
 *
 * The table's CHECK constraint allows exactly one of EmployeeID / PersonID. Changing an Owner row's
 * employee while its Person was filled reached SQL and came back as a raw constraint error. These pin
 * both halves of the fix: `Set()` clears the other field, and `Validate()` refuses what got past it.
 *
 * `Object.create` holds the entity without standing up metadata. The generated class's `Set`,
 * `Validate` and `Get` are shadowed on its prototype, because the overrides call through `super`, which
 * reads the prototype and not the instance.
 */

const EMPLOYEE = 'eeeeeeee-0000-4000-8000-000000000001';
const OTHER_EMPLOYEE = 'eeeeeeee-0000-4000-8000-000000000002';
const PERSON = 'pppppppp-0000-4000-8000-000000000001';

const generated = mjBizAppsSalesDealTeamMemberEntity.prototype as unknown as Record<string, unknown>;
const shadowed = ['Set', 'Get', 'Validate'] as const;
let values: Map<string, unknown>;

function member(initial: { EmployeeID?: string | null; PersonID?: string | null }): DealTeamMemberEntity {
    values = new Map(Object.entries(initial));
    return Object.create(DealTeamMemberEntity.prototype) as DealTeamMemberEntity;
}

beforeEach(() => {
    values = new Map();
    Object.defineProperty(generated, 'Set', {
        value: (name: string, value: unknown) => values.set(name, value),
        configurable: true,
        writable: true,
    });
    Object.defineProperty(generated, 'Get', {
        value: (name: string) => values.get(name) ?? null,
        configurable: true,
        writable: true,
    });
    Object.defineProperty(generated, 'Validate', {
        value: () => {
            const result = new ValidationResult();
            result.Success = true;
            return result;
        },
        configurable: true,
        writable: true,
    });
});

afterEach(() => {
    for (const name of shadowed) {
        delete generated[name];
    }
});

describe('picking one identity clears the other', () => {
    it('clears Person when an employee is picked on a row that had a Person', () => {
        const row = member({ EmployeeID: null, PersonID: PERSON });
        row.EmployeeID = EMPLOYEE;
        expect(values.get('EmployeeID')).toBe(EMPLOYEE);
        expect(values.get('PersonID')).toBeNull();
    });

    it('clears Employee when a person is picked on a row that had an employee', () => {
        const row = member({ EmployeeID: EMPLOYEE, PersonID: null });
        row.PersonID = PERSON;
        expect(values.get('PersonID')).toBe(PERSON);
        expect(values.get('EmployeeID')).toBeNull();
    });

    it('goes through Set() by name too, which is how a form field writes', () => {
        const row = member({ EmployeeID: null, PersonID: PERSON });
        row.Set('EmployeeID', OTHER_EMPLOYEE);
        expect(values.get('PersonID')).toBeNull();
    });

    it('does not empty the partner when a field is emptied', () => {
        const row = member({ EmployeeID: EMPLOYEE, PersonID: null });
        row.PersonID = null;
        expect(values.get('EmployeeID')).toBe(EMPLOYEE);
        row.PersonID = '';
        expect(values.get('EmployeeID')).toBe(EMPLOYEE);
    });

    it('leaves other fields alone', () => {
        const row = member({ EmployeeID: EMPLOYEE, PersonID: null });
        row.Set('Notes', 'reassigned');
        expect(values.get('EmployeeID')).toBe(EMPLOYEE);
    });
});

describe('Validate refuses both or neither', () => {
    it('refuses a row with both set, on PersonID, with a message a user can act on', () => {
        const row = member({ EmployeeID: EMPLOYEE, PersonID: PERSON });
        const result = row.Validate();
        expect(result.Success).toBe(false);
        const error = result.Errors.find((e) => e.Source === 'PersonID');
        expect(error?.Message).toBe(TEAM_MEMBER_BOTH_MESSAGE);
    });

    it('refuses a row with neither set, on EmployeeID', () => {
        const row = member({ EmployeeID: null, PersonID: null });
        const result = row.Validate();
        expect(result.Success).toBe(false);
        const error = result.Errors.find((e) => e.Source === 'EmployeeID');
        expect(error?.Message).toBe(TEAM_MEMBER_NEITHER_MESSAGE);
    });

    it('accepts an employee alone and a person alone', () => {
        expect(member({ EmployeeID: EMPLOYEE, PersonID: null }).Validate().Success).toBe(true);
        expect(member({ EmployeeID: null, PersonID: PERSON }).Validate().Success).toBe(true);
    });
});
