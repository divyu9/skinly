/**
 * Who MSG91 mails come from, in one place.
 *
 * Two streams so Gmail can tell them apart and a marketing mail's reputation
 * never drags an order mail into Promotions: transactional (orders, wallet,
 * model requests, referrals, the admin alert) and marketing (abandoned carts,
 * back in stock). Set MAIL_FROM_TRANSACTIONAL / MAIL_FROM_MARKETING in
 * functions/.env to switch (e.g. orders@mail.goskinly.com); both default to
 * the address that has always been used.
 */
const DEFAULT = "noreply@mail.goskinly.com";
export const transactionalFrom = (name = "GoSkinly") => ({ email: process.env.MAIL_FROM_TRANSACTIONAL || DEFAULT, name });
export const marketingFrom = (name = "GoSkinly") => ({ email: process.env.MAIL_FROM_MARKETING || DEFAULT, name });
