---
'@mj-biz-apps/sales-entities': minor
'@mj-biz-apps/sales-ng': minor
---

Deal form: reach the order and the contract from a won deal's header, and stop offering the draft order on an open one (golive#226).

A tester closed a deal as Won and could not get from it to either the order or the contract. The header carried Account, Owner, Stage and Amount and nothing else; the Motion panel showed **Contract ID** and **Renews Contract ID** as raw GUIDs in text boxes; and the one order link on the form appeared on **open** deals too, where the order is still a draft nobody should be editing directly.

**The header row is not ours.** It is `bizapps-related-chips` from `@mj-biz-apps/common-ng` (golive#225), which is the row contracts and orders use as well. All this app decides is which relationships a deal has — Order and Contract on a won deal, the renewed contract at any status, because a rep needs to see what a renewal is renegotiating precisely while the deal is still open. Reading each record's name, and deciding when a chip must not be drawn at all (the sibling app is not installed, the record is not there, the user may not read it), belongs to the shared component and is tested there. That rule lives in `deal-related-links.ts` rather than in the panel, so a test can reach it without standing up DI.

**The GUIDs were structural, not cosmetic.** `Deal.ContractID` and `Deal.RenewsContractID` are deliberately soft references — the link points down the dependency graph and contracts knows nothing about sales — so there is no FK, `EntityField.RelatedEntity` was unset, and `mj-form-field` had no name to show and nowhere to go. They now ship as MJ **soft foreign keys**: declarative metadata under `metadata/entity-fields/`, plus a matching declaration in `codegen-schema-info.json` so a rebuild-from-zero re-applies them instead of silently regressing the form to GUIDs. No constraint, no cascade, nothing to violate — the database is untouched. Both fields now render the contract number as a link, and `RenewsContractID` gains an FK search in edit mode instead of asking a rep to paste a UUID.

**The order link came off the Motion panel entirely.** The header chip is the only route to the order now, and it is gated on the win, which is what item 4 asks for. Worth saying plainly in case it is ever read as more than it is: this is discoverability, not a lock. The draft order is still reachable by search, and anything that must actually refuse belongs in the entity server.

`ResolveDealLockState` gained `IsWon`, read off the same status row it already fetches, by flag — a deployment may call its winning status "Signed". It is the one member of that shape **not** gated on `LocksDeal`: the rest answer "what may still be edited", a question only a locked deal has, while this answers "did we win", and tying a header decision to a field-editing one would drop the chips on a won deal whose status does not freeze it, with nothing on screen to explain the absence.

20 tests. The one that matters most is a negative — no order chip on an open deal that holds an `OrderID` — because a rule that quietly started emitting it would look completely normal on the won deal everyone tests. Lost deals are asserted separately from open ones for the same reason: a future edit that gated on `IsLocked` instead of `IsWon` would pass every open-deal case and light both chips up on every lost deal.
