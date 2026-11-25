// @vitest-environment jsdom
import '@angular/compiler';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';
import { DealWorkspaceService } from '../lib/workspace/deal-workspace.service';

/**
 * THE DESCRIPTION BOX KEEPS WHAT THE REP TYPED WHILE THEY ARE TYPING.
 *
 * The stored description is one trimmed line. When it was stored on every key, backspacing
 * "Support X" to "Support " stored "Support", and the binding wrote that back into the box: the space
 * was gone and the next key gave "SupportY". The text is now stored when the field loses focus.
 *
 * This mounts the editor's real template, because the fault was between the textarea and the binding
 * and calling `SetDescription` directly cannot show it.
 */

/** The description, plus the one read the rest of the dialog makes of a line with nothing else set. */
type Line = { Description: string | null; GetFieldByName(name: string): null };

beforeAll(() => {
    TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
});

async function mount(description: string | null) {
    const line: Line = { Description: description, GetFieldByName: () => null };
    // The load reads the order from the server; the subject here is the loaded dialog.
    vi.spyOn(MJSDealLineEditorComponent.prototype, 'ngOnInit').mockImplementation(async function (this: MJSDealLineEditorComponent) {
        Object.assign(this, { Working: line, Loading: false });
    });
    TestBed.configureTestingModule({
        imports: [MJSDealLineEditorComponent],
        providers: [{ provide: DealWorkspaceService, useValue: {} }],
    });
    // The price picker, the focus trap and the help icon are left as unknown elements.
    TestBed.overrideComponent(MJSDealLineEditorComponent, {
        set: { imports: [CommonModule, FormsModule], schemas: [CUSTOM_ELEMENTS_SCHEMA], styles: [] },
    });
    const fixture = TestBed.createComponent(MJSDealLineEditorComponent);
    await settle(fixture);
    const box = fixture.nativeElement.querySelector('[data-testid="line-description"]') as HTMLTextAreaElement;
    expect(box, 'the description box is rendered').toBeTruthy();
    return { fixture, line, box };
}

/** NgModel writes to the box a microtask after the binding changes. */
async function settle(fixture: ComponentFixture<MJSDealLineEditorComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
}

async function type(fixture: ComponentFixture<MJSDealLineEditorComponent>, box: HTMLTextAreaElement, text: string): Promise<void> {
    box.value = text;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);
}

async function leave(fixture: ComponentFixture<MJSDealLineEditorComponent>, box: HTMLTextAreaElement): Promise<void> {
    box.dispatchEvent(new Event('blur'));
    await settle(fixture);
}

describe('typing in the deal line description', () => {
    it('keeps the space when the rep backspaces to the end of a word', async () => {
        const { fixture, line, box } = await mount('Support X');
        expect(box.value).toBe('Support X');

        await type(fixture, box, 'Support ');
        expect(box.value).toBe('Support ');

        await type(fixture, box, 'Support Y');
        expect(box.value).toBe('Support Y');

        await leave(fixture, box);
        expect(line.Description).toBe('Support Y');
    });

    it('keeps a line break and a trailing space in the box until the field loses focus', async () => {
        const { fixture, line, box } = await mount('Support');

        await type(fixture, box, 'Support,\nNovember 2026 ');
        expect(box.value).toBe('Support,\nNovember 2026 ');
        expect(line.Description).toBe('Support');

        await leave(fixture, box);
        expect(line.Description).toBe('Support, November 2026');
        expect(box.value).toBe('Support, November 2026');
    });
});
