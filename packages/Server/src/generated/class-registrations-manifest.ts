/**
 * Anti-tree-shaking manifest for the SERVER bundle.
 *
 * HAND-AUTHORED STUB, not CodeGen output — despite living under generated/. `npm run mj:codegen`
 * does not rewrite this file; it is kept here to match the sibling apps' layout.
 *
 * See the client-side counterpart in packages/Angular for the full account of why a manifest is
 * needed at all. The server-side stakes are higher: a tree-shaken server class does not merely
 * render the wrong component, it makes the ClassFactory fall back to a base implementation that
 * declines the operation — so "nobody registered a driver" reads as "the operation refused", and
 * the bug is hunted in the wrong place entirely.
 *
 * EMPTY IS CORRECT AT S1, because there are no server-side subclasses yet. The named anchors this
 * app will need are already listed in sales-core-entities-server's index: `DealEntityServer` (the
 * close lock, L-17, and the OwnerEmployeeID stamp) and `DealLineEntityServer` (the refusal to do
 * local arithmetic). They arrive at S4 and are anchored by explicit `Load*()` calls from
 * `LoadBizAppsSalesServer()`, which is the pattern this array supplements rather than replaces.
 */
export const CLASS_REGISTRATIONS: ReadonlyArray<unknown> = [];
