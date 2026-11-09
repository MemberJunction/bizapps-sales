/**
 * @fileoverview The Settings page: instance-wide Sales options an administrator turns on or off for
 * every user, today only "Hide pipelines".
 *
 * Each option is a row in MJ's Application Settings (`metadata/application-settings/`). This page is the
 * place to change it without opening Data Explorer, and it saves through `ApplicationSettingEngine`, so
 * MJAPI's cache takes the new value at once. The section lists the page only for users who may change
 * those rows (`SalesSettings.CanChange`).
 *
 * @module @mj-biz-apps/sales-ng
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MJSwitchComponent } from '@memberjunction/ng-ui-components';
import { SalesSettings } from '../data/sales-settings';

@Component({
    selector: 'mjs-sales-settings-page',
    standalone: true,
    imports: [CommonModule, FormsModule, MJSwitchComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div data-testid="sales-settings">
            <section class="setting">
                <div class="setting__text">
                    <label class="setting__name" for="sales-hide-pipelines">Hide pipelines</label>
                    <p class="setting__help">
                        Every deal runs on its company's default pipeline. The Pipeline field on the deal form, the
                        Pipeline filter and the Pipeline column are hidden; choosing a deal's company chooses its pipeline.
                    </p>
                </div>
                <mj-switch
                    id="sales-hide-pipelines"
                    data-testid="sales-settings-hide-pipelines"
                    [ngModel]="HidePipelines"
                    (ngModelChange)="SetHidePipelines($event)"
                    [Disabled]="Saving"
                    OnLabel="On"
                    OffLabel="Off"></mj-switch>
            </section>
            @if (Message) {
                <p class="setting__msg" [class.setting__msg--error]="IsError" role="status">{{ Message }}</p>
            }
        </div>
    `,
    styles: [
        `
            .setting {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: var(--mj-space-6, 24px);
                padding: var(--mj-space-4, 16px);
                border: 1px solid var(--mj-border-default);
                border-radius: var(--mj-radius-md, 8px);
                background: var(--mj-bg-surface);
                max-width: 720px;
            }
            .setting__name {
                font-weight: 600;
                color: var(--mj-text-primary);
            }
            .setting__help {
                margin: var(--mj-space-1, 4px) 0 0;
                color: var(--mj-text-secondary);
            }
            .setting__msg {
                margin-top: var(--mj-space-3, 12px);
                color: var(--mj-text-secondary);
            }
            .setting__msg--error {
                color: var(--mj-status-error-text);
            }
        `,
    ],
})
export class MJSSalesSettingsPageComponent {
    private readonly cdr = inject(ChangeDetectorRef);

    /** The current value, read by the section. */
    @Input() public HidePipelines = false;
    /** Emits the saved value, so the section re-reads the dashboard with it. */
    @Output() public readonly HidePipelinesChange = new EventEmitter<boolean>();

    public Saving = false;
    public Message = '';
    public IsError = false;

    public async SetHidePipelines(hide: boolean): Promise<void> {
        this.Saving = true;
        this.Message = '';
        this.cdr.markForCheck();
        let saved = false;
        try {
            saved = await SalesSettings.SetHidePipelines(hide);
        } catch (error) {
            console.error('Hide pipelines could not be saved.', error);
        }
        this.Saving = false;
        this.IsError = !saved;
        if (saved) {
            this.HidePipelines = hide;
            this.Message = hide
                ? 'Pipelines are hidden. Others see the change the next time they open Sales.'
                : 'Pipelines are shown. Others see the change the next time they open Sales.';
            this.HidePipelinesChange.emit(hide);
        } else {
            this.Message = 'The setting could not be saved. Check that you can edit Application Settings, then try again.';
        }
        this.cdr.markForCheck();
    }
}
