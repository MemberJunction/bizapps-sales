export * from './generated/entity_subclasses';

/**
 * The typed, CLIENT-SAFE contract for every `Sales.*` remote operation, plus the input/output shapes.
 * Exported from here deliberately: the browser must be able to import an operation and call it without
 * pulling the server engine in behind it.
 */
export * from './generated/remote_operations';

/**
 * `DealDraft` — the client-side model of a deal being composed, and the only way a browser can save a
 * deal together with its lines and payment schedule atomically. Read the file header before using it;
 * the short version is that the client holds the GENERATED entity, not the server subclass, so
 * transient child collections cannot cross the entity-save boundary as scalars.
 */
export * from './deal-draft';

/**
 * Forces the generated entity subclasses to be loaded. Without an explicit
 * import + call, tree-shaking drops the generated entities because they are not
 * directly referenced. Import and call this from the app bootstrap so the
 * @RegisterClass decorators fire and MJ's class factory can resolve them.
 */
export function LoadGeneratedEntities(): void {
}
