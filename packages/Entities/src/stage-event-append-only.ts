/**
 * @fileoverview The refusal a `DealStageEvent` edit or delete gets, in ONE place (#348).
 *
 * `DealStageEvent` is append-only: each row stamps what a deal looked like at a transition, and those
 * stamps are what make "what did we think the forecast was on the 1st" answerable once amounts move.
 * `DealStageEventEntityServer` refuses an update or a delete on the server, so an Action, an agent or a
 * raw `BaseEntity.Save()` hits the same wall the Explorer form does.
 *
 * It lives in `sales-entities` because that is the package both the entity server and the Angular form
 * depend on, so the server's refusal and the form's notice can say the same thing.
 *
 * @module @mj-biz-apps/sales-entities
 */

/** Why a stage event cannot be changed or deleted, and what to do instead. */
export const DEAL_STAGE_EVENT_APPEND_ONLY_MESSAGE =
    'Stage events are append-only. This row records what the deal looked like at a transition, and ' +
    'changing or deleting it would rewrite the history the forecast is checked against. To change the ' +
    'deal, change the deal — a new event will be recorded.';
