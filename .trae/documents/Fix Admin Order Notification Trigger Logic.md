I will modify the order creation and payment update logic to ensure the `admin_new_order` notification is only sent when the order is confirmed and paid.

### **Analysis of Current Logic:**
Currently, the `admin_new_order` notification is triggered inside the `createOrder` mutation (lines 412-477 of `convex/orders.ts`). This happens immediately after the order record is created, regardless of the payment status (which defaults to "pending" for online payments). This explains why admins receive notifications for pending/unpaid orders.

### **Plan:**

1.  **Modify `createOrder` mutation in `convex/orders.ts`**:
    *   I will wrap the admin notification logic in a conditional check.
    *   **Condition:** Only send the notification if:
        *   The payment method is "cod" (Cash on Delivery).
        *   OR the order is fully paid by wallet (`walletAmountUsed >= originalTotal`).
    *   For online payments (PhonePe), I will **remove** the notification trigger from `createOrder` because the payment is not yet successful.

2.  **Modify `updatePaymentStatus` mutation in `convex/orders.ts`**:
    *   I will add the admin notification trigger here.
    *   **Condition:** When `args.paymentStatus` transitions to `"success"`.
    *   This ensures that for online payments, the admin is notified only after the payment gateway confirms success.

### **Summary of Changes:**
*   **`createOrder`**: Restrict admin notification to COD or Wallet-paid orders.
*   **`updatePaymentStatus`**: Add admin notification for successful online payments.

This aligns perfectly with your requirement: "admin has to receive the msg only when an order is confirmed, paid".