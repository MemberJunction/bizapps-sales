---
'@mj-biz-apps/sales-ng': patch
---

A background re-read of the Deals section (after a deal save or a board drag) that takes longer than 30 seconds no longer replaces the board with a Retry panel. The board stays up and takes the new data when the slow reply lands. An explicit refresh still shows the Retry.
