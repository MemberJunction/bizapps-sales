import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MJSDealLineEditorComponent } from '../lib/form-panels/deal-line-editor.component';

/**
 * #380: the line editor took a failed catalogue read as an empty catalogue, so a rep could not tell
 * "nothing to sell" from "the load failed". The editor now shows why, and still opens.
 */
const EDITOR = readFileSync(join(__dirname, '..', 'lib', 'form-panels', 'deal-line-editor.component.ts'), 'utf8');

function editor(load: () => Promise<unknown[]>) {
    const e = Object.create(MJSDealLineEditorComponent.prototype) as MJSDealLineEditorComponent & {
        loadProducts(): Promise<void>;
    };
    Object.defineProperty(e, 'service', { value: { LoadProducts: load }, configurable: true });
    e.Products = [];
    e.ProductLoadError = null;
    return e;
}

describe('the product picker when the catalogue cannot be read', () => {
    it("shows the read's reason and leaves the picker empty", async () => {
        const e = editor(async () => { throw new Error('The product catalogue could not be loaded: permission denied'); });
        await e.loadProducts();
        expect(e.Products).toEqual([]);
        expect(e.ProductLoadError).toContain('The product catalogue could not be loaded: permission denied.');
        expect(e.ProductLoadError).toContain('Reload the page');
    });

    it('shows nothing when the catalogue loads', async () => {
        const e = editor(async () => [{ ID: 'p1', Name: 'Widget' }]);
        await e.loadProducts();
        expect(e.Products).toHaveLength(1);
        expect(e.ProductLoadError).toBeNull();
    });

    it('renders the message under the product box', () => {
        const at = EDITOR.indexOf('data-testid="line-product"');
        const label = EDITOR.slice(at, EDITOR.indexOf('<div class="mjs-le__row">', at));
        expect(label).toMatch(/@if \(ProductLoadError\)[\s\S]*data-testid="line-product-error"[\s\S]*\{\{ ProductLoadError \}\}/);
    });
});
