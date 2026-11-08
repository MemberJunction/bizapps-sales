# MJ_CORE_VERSION during the 6.1.0-edge prereleases (August 2026)

Moved from `CLAUDE.md` on 2026-10-11. It covers the `6.1.0-edge.x` prereleases, which this repo no
longer uses: the packages require `^6.1.5` and `mj-app.json` declares `>=6.1.5 <7.0.0` (`CLAUDE.md`,
"MemberJunction versions"). The rule it served is still in force: `MJ_CORE_VERSION` must satisfy
`mjVersionRange` and match what `@memberjunction/*` resolved to.

## Closed on 2026-08-25

`.env` and `docs/QA-GUIDE.md` were set to `v6.1.0-edge.3`, matching the packages. Measured before
changing anything: upgrading a database from edge.2 to edge.3 applied **14 migrations in 54 seconds** and
left sales untouched: 20 entities, 338 EntityFields, **0 unregistered columns**, all five sales
migrations still green, `spCreateDeal` still taking `@OrderID`. It was an incremental migration, not a
rebuild.

It had to close because the first registry publish was imminent and every dependency sales declared was
already published, including `@memberjunction/core@6.1.0-edge.3`. A tester installing published sales
packages would otherwise have run edge.3 code against an edge.2 database.

## The original note (2026-08-24)

The package pins said `6.1.0-edge.3` (52 of them, across 7 manifests) while `.env` still read
`MJ_CORE_VERSION=v6.1.0-edge.2`. The bump was needed because published `edge.2` does not contain
`DeclareEmbeddedRecord`, so sales could not build against it from a registry; `edge.3` does.

The mismatch was inert for resolution: the tree resolved `@memberjunction/*` through symlinks to the
local MJ checkout, so a range in a manifest moved nothing until someone installed from a registry.
`mjVersionRange` (`>=6.0.0 <7.0.0`) was satisfied either way. What the `.env` value drives is the
database level, so closing the gap meant a migration, the right change at the wrong moment while another
session was using the shared host. The note said to close it before the first registry install.
