# CodeGen: a cross-schema entity import resolves to the generating package itself

**Component:** `@memberjunction/codegen-lib` — `resolveEntityPackageName`, entity-subclass generation
**Affects:** any OpenApp whose schema references an entity owned by another installed app
**Observed on:** MJ `6.1.0-edge.2`
**Severity:** high — generated code does not compile, and the correction is destroyed by the next run

---

## Consequence first

**A regenerated `entity_subclasses.ts` does not build.** It imports a class from the package it is
itself part of, so the app cannot compile until somebody hand-edits generated output — and the next
CodeGen run overwrites the edit. There is no configuration that produces both a correct import and
local artifacts for that entity, which is the actual gap: the two available settings each fix one
half.

In our workspace this cost a full diagnosis cycle, and the hand-correction now lives permanently
uncommitted in a working tree, where it is one `git checkout` away from being lost.

## What happens

`bizapps-orders` has a schema that references `Address`, an entity owned by `bizapps-common`. Its
config uses the string form:

```js
// bizapps-orders/mj.config.cjs
entityPackageName: '@mj-biz-apps/orders-entities',
```

`resolveEntityPackageName` returns that one package for **every non-core schema**, with no regard for
which app owns the schema:

```ts
// CodeGenLib/src/Config/config.ts
export function resolveEntityPackageName(schemaName: string, config?: ConfigInfo): string {
  const cfg = config ?? configInfo;
  const epn = cfg.entityPackageName;
  if (typeof epn === 'string') {
    return epn || 'mj_generatedentities';   // ← every non-core schema, including other apps'
  }
  …
}
```

So the `Address` entity — schema `__mj_BizAppsCommon`, owned by `@mj-biz-apps/common-entities` —
resolves to `@mj-biz-apps/orders-entities`, and generation emits:

```ts
import { mjBizAppsCommonAddressEntity } from '@mj-biz-apps/orders-entities';
```

into `packages/Entities/src/generated/entity_subclasses.ts` — **which is the source of
`@mj-biz-apps/orders-entities`.** The file imports a symbol from itself. It does not compile, and the
symbol is not there to import in the first place.

The correct line is `from '@mj-biz-apps/common-entities'`, and that is what the working tree carries
today, by hand.

## The map form fixes the import and removes the artifacts

`entityPackageName` also accepts a schema-to-package map, which is the documented answer for OpenApp
projects with multiple installed apps:

```js
entityPackageName: {
  '__mj_BizAppsCommon': '@mj-biz-apps/common-entities',
  '__mj_BizAppsOrders': '@mj-biz-apps/orders-entities',
},
```

That resolves the import correctly. It also makes `getExternalEntitySchemas` return every mapped
schema, and `runCodeGen.ts` then filters those schemas out of the entity list that feeds **three**
generators:

```ts
const externalSchemas = getExternalEntitySchemas().map(s => s.toLowerCase());
const localNonCoreEntities = externalSchemas.length > 0
  ? nonCoreEntities.filter(e => !externalSchemas.includes(e.SchemaName.toLowerCase()))
  : nonCoreEntities;
```

- GraphQL resolvers (`generateGraphQLServerCode(localNonCoreEntities, …)`)
- entity subclasses (`generateAllEntitySubClasses(conn, localNonCoreEntities, …)`)
- Angular components (`generateAngularCode(localNonCoreEntities, …)`)

For entity subclasses and resolvers this is right, and the in-code comment explains why: two packages
emitting an ObjectType for the same entity makes graphql-js reject the unified schema at boot with
*"Schema must contain uniquely named types…"*, and the API crash-loops. **We are not asking for that
to change.**

The gap is that it is all-or-nothing per schema. An app that needs a generated Angular form for a
cross-app entity, or any other local artifact, has no way to get one — mapping the schema removes the
whole schema from generation, and not mapping it produces an import that cannot compile.

## Suggested fix

`resolveEntityPackageName`'s string form should not claim ownership of schemas the app does not own.
Two shapes, in preference order:

1. **Resolve by schema ownership rather than by config shape.** `SchemaInfo` already records which
   schemas exist and MJ knows which package installed each OpenApp. A string `entityPackageName` could
   mean *"the package for MY schemas"* rather than *"the package for all non-core schemas"*, with
   other apps' schemas resolved from their own registration. This removes the self-import without
   anyone writing a map.

2. **Failing that, make the self-import an error rather than output.** Generation already knows the
   package it is emitting into; if a resolved import equals that package, that is never valid and
   should stop the run with a message naming the schema and the two packages involved. A build failure
   in generated code is a much worse signal than a CodeGen error that says what is wrong.

Separately, and independently useful: **decoupling the three generators' exclusion from the import
map** would let an app import an entity from another package while still emitting its own Angular
artifacts for it. That is the part that currently has no answer at all.

## Notes for whoever picks this up

- Both behaviours are deterministic and reproducible from config alone; no database state involved.
- The string form is the default and what every template ships with, so an app hits this the first time
  its schema references another app's entity — typically well after the project is established.
- The failure surfaces as a TypeScript compile error in a file marked "do not edit by hand", which
  points a reader away from configuration and toward the generator, then toward their own code.
