/**
 * MemberJunction API Server (MJ minimal architecture).
 * All initialization logic lives in @memberjunction/server-bootstrap.
 */
import { createMJServer } from '@memberjunction/server-bootstrap';

// BizApps Common FIRST, so the Organization / Person / Address classes are registered before any
// Sales class resolves them. This ordering is load-bearing here in a way it is not for a soft
// reference: SalesAccount and SalesContact are IsA CHILDREN of Organization and Person (master plan
// §4.1), so their generated base views JOIN the parent and their entity metadata carries
// ParentID — the parent class has to exist in the ClassFactory by the time the child is asked for.
import { RESOLVER_PATHS as COMMON_RESOLVER_PATHS } from '@mj-biz-apps/common-server';

// The BizApps Sales server bootstrap (registers entities, actions, resolvers).
import { RESOLVER_PATHS as SALES_RESOLVER_PATHS } from '@mj-biz-apps/sales-server';

const RESOLVER_PATHS = [
    ...COMMON_RESOLVER_PATHS,
    ...SALES_RESOLVER_PATHS,
];

// Pre-built MJ class registrations manifest (covers all @memberjunction/* packages)
import '@memberjunction/server-bootstrap/mj-class-registrations';

// NOTE: accounting / orders / contracts are deliberately ABSENT. Sales references them only
// SOFTLY at this stage — DealLine.ProductID (orders catalog) and Deal.ContractID / RenewsContractID
// (contracts) are UUID columns with no foreign key, per DG-6, precisely so sales can stand up
// without those schemas present. They get wired in at S2, when the pricing bridge starts calling
// `Orders.PreviewOrder` and sales needs the real engine rather than a reference to it. Adding them
// before then buys a three-deep symlink chain and the module-identity hazards documented in
// .mj-links.json, for no capability.

createMJServer({ resolverPaths: RESOLVER_PATHS }).catch(console.error);
