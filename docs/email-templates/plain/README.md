# Plain transactional email templates

Same variables as the designed versions one folder up (the server already sends
them), so swapping is a paste in MSG91 — no code change.

Why plain: Gmail files the designed ones (big images, coloured blocks, picks,
"Why Skinly") under Promotions. These look like what they are — a receipt or a
shipping notice: little design, one small photo, one button, no offers.

| Template (MSG91 usecase) | Subject |
|---|---|
| order_confirmed | Your GoSkinly order {{orderNumber}} is confirmed |
| order_dispatched | Order {{orderNumber}} has shipped |
| order_delivered | Order {{orderNumber}} was delivered |
| wallet_credited | {{amountText}} added to your GoSkinly wallet |
| wallet_refund | Refund for order {{orderNumber}} |
| admin_new_order | New order {{orderNumber}} — {{amountText}} |

Also in MSG91 → Domain configuration: Open tracking OFF, Unsubscribe link OFF.
