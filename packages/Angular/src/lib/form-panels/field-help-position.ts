/**
 * @fileoverview Where a field's help bubble goes on screen. Apart from the component so it can be
 * tested without Angular.
 */

/** Space kept between the bubble and the icon, and between the bubble and the viewport edge. */
const GAP_PX = 6;
const EDGE_PX = 8;

/**
 * Where the bubble goes: under the icon, moved left as far as the viewport needs, and above the icon
 * when there is no room beneath it. Pure, so the arithmetic can be read without a browser.
 */
export function FieldHelpPosition(
    anchor: { top: number; bottom: number; left: number },
    bubble: { width: number; height: number },
    viewport: { width: number; height: number },
): { top: number; left: number } {
    const maxLeft = Math.max(EDGE_PX, viewport.width - bubble.width - EDGE_PX);
    const left = Math.min(Math.max(EDGE_PX, anchor.left), maxLeft);
    const below = anchor.bottom + GAP_PX;
    const fitsBelow = below + bubble.height + EDGE_PX <= viewport.height;
    const above = anchor.top - GAP_PX - bubble.height;
    const top = fitsBelow || above < EDGE_PX ? below : above;
    return { top, left };
}
