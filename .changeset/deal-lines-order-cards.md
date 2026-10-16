---
'@mj-biz-apps/sales-ng': minor
---

The deal form's "What's being sold" panel lists each order line as a card laid out like the order form's line cards: product with SKU and type, quantity, unit price with its named price, an overridden or discount pill, line total, untaxable and other-company chips, and a subscription's term start. Add a product and each line's edit control open the restricted line editor as before; a closed deal shows the cards with neither. `MJSDealLinesPanel.EditLine` now takes the line ID instead of a grid double-click event, and the panel no longer exposes `Params` or `OnDataLoad`.
