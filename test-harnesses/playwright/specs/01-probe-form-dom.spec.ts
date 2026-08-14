/**
 * DOM PROBE — throwaway-by-intent diagnostic that prints the markup around a couple of fields on the
 * generated Deal form, so the CRUD spec's label->input selectors are written from observed structure
 * rather than guessed. Kept in the repo because it is the fastest way to re-derive those selectors
 * after a CodeGen or MJ template change breaks them.
 *
 * Skipped by default (PW_PROBE=1 to run) so it does not add time to every regression run.
 */
import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_DIR } from '../lib/env';
import { openAllEntities, openSalesApp } from '../lib/explorer';

test.skip(process.env.PW_PROBE !== '1', 'diagnostic only — set PW_PROBE=1');

test('probe: dump generated-form DOM around known field labels', async ({ page }) => {
  await openSalesApp(page);
  await openAllEntities(page);

  await page.getByText(/^\s*Deals\s*$/i).first().click();
  await page.waitForTimeout(5000);
  await page.getByRole('button', { name: /^\s*\+?\s*New\s*$/i }).first().click();
  await page.waitForTimeout(6000);

  const out: Record<string, unknown> = {};

  for (const label of ['Name', 'Deal Number', 'Amount', 'Pipeline', 'Company', 'Probability']) {
    const info = await page
      .evaluate((lbl) => {
        const all = Array.from(document.querySelectorAll('label, .field-label, .k-label, span, div'));
        const el = all.find((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim() === lbl);
        if (!el) return { found: false };
        // Climb until we find an ancestor that contains an input/textarea/kendo control.
        let node: HTMLElement | null = el as HTMLElement;
        for (let i = 0; i < 6 && node; i++) {
          const ctl = node.querySelector('input, textarea, select, kendo-combobox, kendo-dropdownlist');
          if (ctl) {
            return {
              found: true,
              climbedLevels: i,
              labelTag: (el as HTMLElement).tagName.toLowerCase(),
              labelClass: (el as HTMLElement).className,
              containerTag: node.tagName.toLowerCase(),
              containerClass: node.className,
              controlTag: ctl.tagName.toLowerCase(),
              controlType: (ctl as HTMLInputElement).type ?? '',
              controlClass: (ctl as HTMLElement).className,
              containerHtml: node.outerHTML.slice(0, 1200),
            };
          }
          node = node.parentElement;
        }
        return { found: true, climbedLevels: -1, note: 'label found but no control within 6 ancestors' };
      }, label)
      .catch((e) => ({ found: false, error: (e as Error).message }));
    out[label] = info;
    console.log(`\n--- ${label} ---\n${JSON.stringify(info, null, 1).slice(0, 1600)}`);
  }

  writeFileSync(path.join(AUTH_DIR, 'recon-form-dom.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(`\nfull dump -> ${path.join(AUTH_DIR, 'recon-form-dom.json')}\n`);
});
