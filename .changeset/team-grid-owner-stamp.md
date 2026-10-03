---
'@mj-biz-apps/sales-core-entities-server': patch
---

Adding, changing or removing the Owner / AE row in the Deal form's Internal team grid now updates
the deal's owner (golive #291).

`stampOwnerFromTeam()` is guarded by `RosterDrivesThisSave`, which asks whether the team is part of
the save. The grid saves the `DealTeamMember` row and nothing else, so it was not — the grid showed
an owner while the Overview still said "No owner assigned." The server's own refusal for a hand-set
owner says *"Change the Owner role on the Internal team panel instead"*, and that panel was the one
path that did not update it.

A new `DealTeamMemberEntityServer` re-derives the stamp after a team row is saved or deleted. It does
not compute an owner: it loads the deal with its team and saves, which makes `RosterDrivesThisSave`
true and lets the existing derivation run, so there is one implementation rather than two that agree
until they do not. A row that moves between deals refreshes both. A re-stamp that fails is logged
rather than thrown, because the roster edit is already committed and the roster is the authority.

Closed deals need no special case: `checkCloseLock` freezes `OwnerEmployeeID` but keys on the field
being dirty, and the stamp is applied after it runs — which is what golive #206 item 2 requires, since
reassigning a rep on a closed deal is record-keeping.

No schema change.
