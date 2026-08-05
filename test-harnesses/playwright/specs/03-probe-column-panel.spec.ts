/**
 * PROBE the view-settings / column panel, so the demo-setup spec can drive it from observed structure
 * rather than guesses. Skipped unless PW_PROBE=1.
 *
 * Recon already told us the toolbar has a `vs-icon-btn` with `fa-sliders-h` titled
 * "Configure view settings (columns, filters, sorting)", and that opening something yields many
 * `action-btn show-btn` buttons labelled "Show column" plus Hide/Move-up/Move-down. What is NOT known is
 * how a "Show column" button is associated with its COLUMN NAME — that is what this dumps.
 */
import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { AUTH_DIR } from '../lib/env';
import { openAllEntities, openSalesApp, shot } from '../lib/explorer';

test.skip(process.env.PW_PROBE !== '1', 'diagnostic only — set PW_PROBE=1');

test('probe: the column / view-settings panel', async ({ page }) => {
  const report: Record<string, unknown> = {};

  await openSalesApp(page);
  await openAllEntities(page);
  await page.getByText(/^\s*Deals\s*$/i).first().click();
  await page.waitForTimeout(5000);
  await shot(page, '40-probe-before-gear');

  // The gear: "Configure view settings (columns, filters, sorting)"
  const gear = page.locator('button[title*="Configure view settings" i], .vs-icon-btn:has(i.fa-sliders-h)').first();
  report.gearFound = (await gear.count()) > 0;
  if (report.gearFound) {
    await gear.click().catch(() => undefined);
    await page.waitForTimeout(3000);
    await shot(page, '41-probe-panel-open');
  }

  // Everything in the opened panel, with geometry so we can tell what is actually on screen.
  report.panelControls = await page
    .locator('button, [role="tab"], [role="button"], .action-btn, .k-checkbox, input[type="checkbox"]')
    .evaluateAll((els) =>
      els
        .map((e) => {
          const el = e as HTMLElement;
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
            title: el.getAttribute('title') ?? '',
            cls: (el.className?.toString() ?? '').slice(0, 70),
            x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
            visible: r.width > 0 && r.height > 0 && el.offsetParent !== null,
          };
        })
        .filter((c) => c.visible && c.x > 900),   // the panel sits on the right
    )
    .catch(() => []);

  /**
   * THE KEY QUESTION: how does a "Show column" button relate to its column name? Walk up from each
   * such button and capture the nearest ancestor text — that is the row label.
   */
  report.showColumnRows = await page
    .evaluate(() => {
      const out: Array<{ label: string; html: string }> = [];
      const btns = Array.from(document.querySelectorAll('button')).filter(
        (b) => (b.getAttribute('title') ?? '').toLowerCase().includes('show column'),
      );
      for (const b of btns.slice(0, 30)) {
        let node: HTMLElement | null = b as HTMLElement;
        for (let i = 0; i < 5 && node; i++) {
          const txt = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (txt && txt.length > 2 && txt.length < 60) {
            out.push({ label: txt, html: node.outerHTML.slice(0, 260) });
            break;
          }
          node = node.parentElement;
        }
      }
      return out;
    })
    .catch(() => []);

  report.panelText = (await page.locator('body').innerText().catch(() => '')).slice(0, 3000);

  writeFileSync(path.join(AUTH_DIR, 'recon-columns.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('\n=== COLUMN PANEL PROBE ===');
  console.log('gear found:', report.gearFound);
  console.log('\n-- show-column rows (label -> the button that reveals it) --');
  for (const r of (report.showColumnRows as Array<{ label: string }>).slice(0, 25)) console.log('   ' + r.label);
  console.log('\n-- panel controls (right side) --');
  for (const c of (report.panelControls as Array<Record<string, unknown>>).slice(0, 30)) {
    console.log(`   ${c.tag} "${c.text}" title="${c.title}" @${c.x},${c.y}`);
  }
  console.log(`\nfull dump -> ${path.join(AUTH_DIR, 'recon-columns.json')}\n`);
});
