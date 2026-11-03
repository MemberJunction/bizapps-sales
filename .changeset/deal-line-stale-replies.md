---
"@mj-biz-apps/sales-ng": patch
---

Deal line editor: a slower earlier reply from orders no longer overwrites a newer one for the line's price, its named prices or the existing-subscription prompt; a failed subscription read hides the prompt; changing the product clears the previous product's prompt. Save now waits for a pending reprice, so a discount that a quantity or price change pushed past its concession asks for a reason instead of saving without one.
