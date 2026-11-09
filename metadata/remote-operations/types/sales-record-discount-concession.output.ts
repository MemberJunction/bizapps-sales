/**
 * What orders decided about a discount concession, or why it refused to record one. NO `import`
 * statements in this file (see `sales-close-deal.input.ts`).
 */
export interface SalesRecordDiscountConcessionOutput {
    /** The concession was recorded. False when sales or orders refused it; `Message` says why. */
    Success: boolean;
    /** The recorded concession, when there is one. */
    ConcessionID?: string | null;
    /**
     * Recorded but not decided: the discount is outside the requester's Sales Authority and waits for
     * the approving role. Read from whether orders stamped a decider, never from the status's name.
     */
    AwaitingApproval: boolean;
    /** Orders' or sales' refusal, verbatim, when `Success` is false. */
    Message?: string | null;
}
