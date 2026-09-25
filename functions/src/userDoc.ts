import * as admin from "firebase-admin";

/**
 * The users document that holds a customer's wallet.
 *
 * Accounts from before the move to Firebase live under their old ids (74 of
 * the 75), and the storefront finds them by email (resolveUserDocId in
 * firebase-hooks). The functions only ever looked at users/{uid}, so for
 * nearly everyone the checkout saw a ₹0 balance, delivery credit found no
 * account and quietly paid nothing, and an admin refund failed. This is the
 * storefront's rule, on the server: users/{uid}, else the one with the
 * email.
 */
/** The sign-in's email, only if the provider proved it — the key to a legacy account. */
export const verifiedEmail = (context: any): string | null =>
  context?.auth?.token?.email_verified === true ? String(context.auth.token.email || "") : null;

export async function walletUserRef(
  db: admin.firestore.Firestore, uid: string | null | undefined, email?: string | null,
): Promise<admin.firestore.DocumentReference | null> {
  if (uid && !String(uid).startsWith("guest")) {
    const own = db.collection("users").doc(String(uid));
    if ((await own.get()).exists) return own;
  }
  const e = String(email || "").trim().toLowerCase();
  if (e) {
    const legacy = await db.collection("users").where("email", "==", e).limit(1).get();
    if (!legacy.empty) return legacy.docs[0].ref;
  }
  return null;
}

/**
 * Takes the wallet money an order used, once, when the order is confirmed.
 *
 * placeOrder took walletUsed off the total and nothing ever took it off the
 * balance, so a balance could be spent again on every order. Charged at
 * confirmation (paid, or COD placed) rather than at checkout, so an
 * abandoned payment costs the customer nothing.
 */
export async function debitWalletForOrder(db: admin.firestore.Firestore, orderRef: admin.firestore.DocumentReference) {
  const first = (await orderRef.get()).data() as any;
  const used = Number(first?.walletUsed) || 0;
  if (!(used > 0) || first?.walletDebited) return;
  const userRef = first.walletUserDocId
    ? db.collection("users").doc(String(first.walletUserDocId))
    : await walletUserRef(db, first.ownerUid || first.userId, first.email);
  if (!userRef) {
    await orderRef.update({ walletDebitProblem: "no account found", updatedAt: Date.now() });
    return;
  }
  const txRef = db.collection("walletTransactions").doc();
  await db.runTransaction(async (tx) => {
    const [o, u] = await tx.getAll(orderRef, userRef);
    const order = o.data() as any;
    if (!order || order.walletDebited || !u.exists) return;
    const before = Number((u.data() as any).walletBalance) || 0;
    const take = Math.min(before, Number(order.walletUsed) || 0);
    const after = Math.round((before - take) * 100) / 100;
    tx.update(userRef, { walletBalance: after });
    tx.set(txRef, {
      userId: userRef.id,
      ...(order.ownerUid ? { ownerUid: order.ownerUid } : {}),
      transactionType: "debit", type: "order_payment", source: "order_payment",
      amount: take, balanceBefore: before, balanceAfter: after,
      description: `Used on order ${order.orderNumber || ""}`.trim(),
      relatedOrderId: orderRef.id, createdAt: Date.now(),
    });
    tx.update(orderRef, {
      walletDebited: true, walletDebitedAmount: take, walletDebitedAt: Date.now(),
      ...(take < (Number(order.walletUsed) || 0) ? { walletDebitProblem: `balance was ₹${before}, order used ₹${order.walletUsed}` } : {}),
    });
  });
}
