/**
 * @fileoverview The help icon beside a field label, and the directive that places one beside a label
 * another component draws (golive #421).
 *
 * WHY THIS EXISTS. `mj-form-field` shows a field's label and nothing about what the field means: it
 * does not render `EntityField.Description`. A rep reading "Term start" or "Execution Date" had only
 * the label to go on. A native `title` would have been one attribute, and reaches neither a keyboard
 * nor a touch screen, so the help is a real button with a real tooltip.
 *
 * THE BUBBLE IS A `popover`, so it renders in the browser's top layer. The deal form's panels and the
 * line editor's dialog both clip their overflow, and the dialog is also transformed, which makes it
 * the containing block for anything `position: fixed` inside it. The top layer is outside both.
 */
import {
    ChangeDetectionStrategy, Component, ComponentRef, Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy, OnInit,
    ViewChild, ViewContainerRef, ViewEncapsulation, inject,
} from '@angular/core';
import { FieldHelpPosition } from './field-help-position';

/** Counts instances, so each tooltip has an id its button can name in `aria-describedby`. */
let fieldHelpInstances = 0;

/** How long the bubble waits before closing, so the pointer can travel from the icon onto it. */
const CLOSE_DELAY_MS = 120;

/** Whether this browser has the popover API. Without it the text falls back to a native `title`. */
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

@Component({
    selector: 'mjs-field-help',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (Text) {
            <button #trigger type="button" class="mjs-help__btn" data-testid="field-help"
                    [attr.aria-label]="Label ? 'About ' + Label : 'About this field'"
                    [attr.aria-describedby]="TipId" [attr.title]="NativeTitle"
                    (mouseenter)="Show()" (mouseleave)="HideSoon()" (focus)="Show()" (blur)="Hide()"
                    (click)="OnClick($event)" (keydown.escape)="OnEscape($event)">
                <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
            </button>
            <span #tip class="mjs-help__tip" role="tooltip" popover="manual" data-testid="field-help-text" [id]="TipId"
                  (mouseenter)="Show()" (mouseleave)="HideSoon()">{{ Text }}</span>
        }
    `,
    styles: [`
        mjs-field-help { display: inline-flex; align-items: center; vertical-align: middle; }
        .mjs-help__btn {
            display: inline-flex; align-items: center; justify-content: center;
            width: 18px; height: 18px; padding: 0; margin: 0 0 0 4px;
            border: 0; border-radius: 50%; background: transparent; cursor: help;
            color: var(--mj-text-muted); font-size: 12px; line-height: 1;
        }
        .mjs-help__btn:hover, .mjs-help__btn.is-open { color: var(--mj-brand-primary); }
        .mjs-help__btn:focus-visible { outline: 2px solid var(--mj-brand-primary); outline-offset: 1px; }
        /* Hidden unless open, stated here and not left to the browser: one without the popover API
           has no rule that hides a popover, and would print every field's help on the page. It drops
           the second rule as unparseable and keeps the first. */
        .mjs-help__tip { display: none; }
        .mjs-help__tip:popover-open { display: block; }
        .mjs-help__tip {
            position: fixed; inset: auto; margin: 0; width: max-content; max-width: min(320px, calc(100vw - 16px));
            padding: var(--mj-space-2) var(--mj-space-3);
            border: 1px solid var(--mj-border-default); border-radius: var(--mj-radius-md);
            background: var(--mj-bg-surface-elevated); color: var(--mj-text-primary);
            box-shadow: var(--mj-shadow-md);
            font-size: 0.8rem; font-weight: 400; line-height: 1.45; letter-spacing: normal;
            text-transform: none; text-align: left; white-space: normal;
        }
    `],
})
export class MJSFieldHelpComponent implements OnDestroy {
    /** The help text. Nothing renders while it is empty, so a field with no help has no icon. */
    @Input() public Text: string | null = null;
    /** The field's label, for the button's accessible name. */
    @Input() public Label: string | null = null;

    public readonly TipId = `mjs-field-help-${++fieldHelpInstances}`;

    /** The text as a native tooltip, only where the browser cannot show the bubble. */
    public get NativeTitle(): string | null {
        return SUPPORTS_POPOVER ? null : this.Text;
    }

    @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
    @ViewChild('tip') private tip?: ElementRef<HTMLElement>;

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly zone = inject(NgZone);
    private closeTimer: ReturnType<typeof setTimeout> | null = null;

    /** A tap anywhere else closes it: a touch screen sends no mouseleave, and Safari no blur. */
    private readonly onOutsideClick = (event: Event): void => {
        if (!this.host.nativeElement.contains(event.target as Node | null)) this.Hide();
    };
    /** The bubble is placed once, when it opens, so it closes when anything moves under it. */
    private readonly onMove = (): void => this.Hide();

    public Show(): void {
        this.cancelClose();
        const tip = this.tip?.nativeElement;
        const trigger = this.trigger?.nativeElement;
        if (!SUPPORTS_POPOVER || !tip || !trigger || this.isOpen()) return;
        tip.showPopover();
        const place = FieldHelpPosition(
            trigger.getBoundingClientRect(),
            tip.getBoundingClientRect(),
            { width: window.innerWidth, height: window.innerHeight },
        );
        tip.style.top = `${place.top}px`;
        tip.style.left = `${place.left}px`;
        trigger.classList.add('is-open');
        this.listen(true);
    }

    public Hide(): void {
        this.cancelClose();
        this.listen(false);
        this.trigger?.nativeElement.classList.remove('is-open');
        if (this.isOpen()) this.tip?.nativeElement.hidePopover();
    }

    /** Close after a moment, unless the pointer arrives on the bubble first. */
    public HideSoon(): void {
        this.cancelClose();
        this.closeTimer = setTimeout(() => this.Hide(), CLOSE_DELAY_MS);
    }

    /**
     * A tap opens it. The click must not reach an enclosing `<label>`, which would pass it on to the
     * field's control.
     */
    public OnClick(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        this.Show();
    }

    /** Escape closes the bubble only. Left to bubble, it would also cancel the dialog the field is in. */
    public OnEscape(event: Event): void {
        if (!this.isOpen()) return;
        event.stopPropagation();
        this.Hide();
    }

    public ngOnDestroy(): void {
        this.Hide();
    }

    /**
     * Asked of the browser, not kept in a flag. The browser closes a popover whose element leaves
     * the document, which happens whenever the form redraws the field this icon sits beside, and a
     * flag would go on saying it was open.
     */
    private isOpen(): boolean {
        return SUPPORTS_POPOVER && !!this.tip?.nativeElement.matches(':popover-open');
    }

    /**
     * Listen for the things that close an open bubble, and only while one is open. A deal form has
     * some forty of these icons, and a listener each on every click in the application would be forty
     * handlers for a bubble that is almost never showing. Outside Angular's zone, because closing
     * changes nothing Angular renders.
     *
     * Scroll is caught in the capture phase: the form scrolls inside its own container, and a scroll
     * event does not bubble up to the window.
     */
    private listen(on: boolean): void {
        this.zone.runOutsideAngular(() => {
            const change = on ? 'addEventListener' : 'removeEventListener';
            document[change]('click', this.onOutsideClick, true);
            document[change]('scroll', this.onMove, true);
            window[change]('resize', this.onMove);
        });
    }

    private cancelClose(): void {
        if (this.closeTimer !== null) clearTimeout(this.closeTimer);
        this.closeTimer = null;
    }
}

/** The labels `mj-form-field` and common's `bizapps-party-field` draw. */
const LABEL_SELECTOR = '.mj-forms-field-label, .bizapps-party-field-label';

/**
 * Puts a help icon beside the label of a field another component draws.
 *
 * Set on the element that wraps the field. `mj-form-field` owns its label and offers no slot beside
 * it, and it rebuilds the label whenever the form changes between reading and editing, so the icon is
 * placed by watching the wrapper and putting it back each time a label appears without one. The icon
 * is one component for the directive's whole life: only its place in the DOM moves.
 *
 * THE ICON IS THE LABEL'S NEXT SIBLING, never its child and never a new wrapper around it. The label
 * keeps its text and its parent, which is what the Explorer harness finds a field by, and a button
 * inside a label would add its own name to the name of the control the label is for. Sharing a line
 * with the label is left to the stylesheet of whichever form uses this.
 */
@Directive({
    selector: '[mjsFieldHelp]',
    standalone: true,
})
export class MJSFieldHelpDirective implements OnInit, OnChanges, OnDestroy {
    /** The help text. Empty removes the icon. */
    @Input('mjsFieldHelp') public Text: string | null = null;

    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly views = inject(ViewContainerRef);
    private readonly zone = inject(NgZone);
    private help: ComponentRef<MJSFieldHelpComponent> | null = null;
    private observer: MutationObserver | null = null;

    /**
     * Watched outside Angular's zone. A field's DOM changes on every keystroke in a lookup, and inside
     * the zone each change would run change detection for the whole application to move one icon.
     */
    public ngOnInit(): void {
        this.zone.runOutsideAngular(() => {
            this.observer = new MutationObserver(() => this.place());
            this.observer.observe(this.host.nativeElement, { childList: true, subtree: true });
        });
        this.place();
    }

    public ngOnChanges(): void {
        this.place();
    }

    public ngOnDestroy(): void {
        this.observer?.disconnect();
        this.help?.destroy();
    }

    /**
     * Put the icon beside the wrapper's label, or take it out when there is no label or no text.
     *
     * A field that is empty while reading draws nothing at all, label included, and then there is
     * nothing to explain: the icon leaves with the label and returns with it.
     */
    private place(): void {
        const label = this.host.nativeElement.querySelector<HTMLElement>(LABEL_SELECTOR);
        if (!label || !this.Text) {
            this.help?.location.nativeElement.remove();
            return;
        }
        this.help ??= this.views.createComponent(MJSFieldHelpComponent);
        this.help.setInput('Text', this.Text);
        this.help.setInput('Label', (label.textContent ?? '').trim());
        this.help.changeDetectorRef.detectChanges();
        const icon = this.help.location.nativeElement as HTMLElement;
        if (icon.previousElementSibling !== label) label.after(icon);
    }
}
