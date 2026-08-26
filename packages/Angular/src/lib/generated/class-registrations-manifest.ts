/**
 * Anti-tree-shaking manifest for the CLIENT bundle.
 *
 * HAND-AUTHORED STUB, not CodeGen output — despite living under generated/. It sits here because
 * that is where the sibling apps put theirs and because a future CodeGen target may well take it
 * over; until then, `npm run mj:codegen` does NOT rewrite this file.
 *
 * WHAT IT IS FOR: MJ's ClassFactory only knows a class whose `@RegisterClass` decorator has actually
 * RUN, and a decorator only runs if the module reached the bundle. A bundler that sees no direct
 * reference to a form component drops it, and the symptom is a blank tab or a generic form where a
 * custom one was expected — not an error. Naming the registrations in a static array that the
 * bootstrap touches is what keeps them alive.
 *
 * EMPTY IS CORRECT AT S1. Every form in this app is generated, and
 * `./generated-forms.module` already imports all nineteen of them by side effect, which is its own
 * anchor. This array starts earning its keep at S3, when the pipeline board, the deal workspace and
 * the account/contact 360 arrive as hand-written components with their own registrations.
 */
export const CLASS_REGISTRATIONS: ReadonlyArray<unknown> = [];
