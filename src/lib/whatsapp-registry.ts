/**
 * Every WhatsApp message the code sends, and exactly what its Authkey template
 * must declare: the variable order is fixed by the code that queues it, so the
 * admin only pastes the template ID (Admin › WhatsApp). Keep in step with
 * docs/whatsapp-templates.md, whose text these templates were created from.
 */
export interface WhatsAppMessageSpec {
  key: string;            // whatsappUsecases.usecaseKey
  label: string;
  when: string;
  group: "Orders" | "Customer" | "Recovery" | "Model requests" | "Admin";
  /** {{1}}, {{2}}… in order: the names the code fills. */
  vars: string[];
  /** Created in Authkey with an image header ("Media" in its template list). */
  photo: boolean;
  sample: Record<string, string>;
}

const SITE = "https://goskinly.com";

export const WHATSAPP_MESSAGES: WhatsAppMessageSpec[] = [
  {
    key: "order_received", label: "Order confirmed", group: "Orders", photo: true,
    when: "To the customer the moment an order is confirmed (COD placed, or online paid).",
    vars: ["customer_name", "order_number", "product_name", "order_total"],
    sample: { customer_name: "Priya", order_number: "#4102", product_name: "Aurora Arches Matte iPhone 15 Skin", order_total: "527.00" },
  },
  {
    key: "order_dispatched", label: "Order shipped", group: "Orders", photo: true,
    when: "When the parcel is handed to the courier, with AWB and tracking.",
    vars: ["first_name", "order_number", "courier_name", "awb_number", "tracking_url"],
    sample: { first_name: "Priya", order_number: "#4102", courier_name: "Delhivery", awb_number: "38291045561", tracking_url: "https://www.delhivery.com/track-v2/package/38291045561", order_link: `${SITE}/orders/test-order` },
  },
  {
    key: "out_for_delivery", label: "Out for delivery", group: "Orders", photo: false,
    when: "The day it's out for delivery; reminds COD customers of the amount.",
    vars: ["first_name", "order_number", "cod_line"],
    sample: { first_name: "Priya", order_number: "#4102", cod_line: "Please keep ₹527 ready — it's Cash on Delivery." },
  },
  {
    key: "order_delivered", label: "Delivered", group: "Orders", photo: true,
    when: "On delivery, with the how-to-apply guide and the review link.",
    vars: ["first_name", "order_number", "review_link"],
    sample: { first_name: "Priya", order_number: "#4102", review_link: `${SITE}/review/test-order` },
  },
  {
    key: "order_cancelled", label: "Order cancelled", group: "Orders", photo: false,
    when: "When an order is cancelled, with what happens to the money.",
    vars: ["first_name", "order_number", "refund_line"],
    sample: { first_name: "Priya", order_number: "#4102", refund_line: "Your payment will be refunded to the original payment method." },
  },
  {
    key: "review_request", label: "Review request", group: "Customer", photo: false,
    when: "A few days after delivery, and one reminder 5 days later if no review.",
    vars: ["customer_name", "product_name", "review_link"],
    sample: { customer_name: "Priya", product_name: "Aurora Arches Matte iPhone 15 Skin", review_link: `${SITE}/review/test-order` },
  },
  {
    key: "wallet_credited", label: "Wallet credited", group: "Customer", photo: false,
    when: "Whenever money lands in a wallet: review reward, cashback, referral, refund.",
    vars: ["customer_name", "amount_text", "reason_line", "wallet_balance", "wallet_link"],
    sample: { customer_name: "Priya", amount_text: "₹23", reason_line: "Thanks for reviewing order #4102 — here's your reward", wallet_balance: "₹73", wallet_link: `${SITE}/account/wallet` },
  },
  {
    key: "referral_friend_ordered", label: "Referral: friend ordered", group: "Customer", photo: false,
    when: "To the referrer when a friend orders with their link.",
    vars: ["referrerName", "friendName", "amount", "link"],
    sample: { referrerName: "Rahul", friendName: "Priya", amount: "₹50", link: `${SITE}/account` },
  },
  {
    key: "referral_reward_paid", label: "Referral: reward paid", group: "Customer", photo: false,
    when: "To the referrer when the friend's order is delivered and the reward is paid.",
    vars: ["referrerName", "friendName", "amount", "link"],
    sample: { referrerName: "Rahul", friendName: "Priya", amount: "₹50", link: `${SITE}/account` },
  },
  {
    key: "payment_failed", label: "Payment failed", group: "Recovery", photo: false,
    when: "When an online payment doesn't go through, with a link to finish paying.",
    vars: ["customer_name", "order_number", "order_amount", "pay_link"],
    sample: { customer_name: "Priya", order_number: "4102", order_amount: "₹527", pay_link: `${SITE}/pay/test-order` },
  },
  {
    key: "abandoned_cart", label: "Abandoned cart", group: "Recovery", photo: true,
    when: "First cart reminder; the button (/c/<code>) refills the cart with the coupon.",
    vars: ["customer_name", "product_name", "coupon_line"],
    sample: { customer_name: "Priya", product_name: "Aurora Arches Matte iPhone 15 Skin", coupon_line: "Use code BACK10 at checkout for 10% off.", cart_code: "TEST" },
  },
  {
    key: "back_in_stock", label: "Back in stock", group: "Recovery", photo: false,
    when: "To everyone who tapped Notify me, when the product is restocked.",
    vars: ["product_name", "product_url"],
    sample: { product_name: "Aurora Arches Matte iPhone 15 Skin", product_url: `${SITE}/products/refill-hd-glass-autoapply-iphone` },
  },
  {
    key: "model_requested", label: "Model request received", group: "Model requests", photo: false,
    when: "When someone asks for a device we don't list yet.",
    vars: ["brand_name", "model_name", "request_number"],
    sample: { brand_name: "Samsung", model_name: "Galaxy S25 FE", request_number: "MR-150" },
  },
  {
    key: "model_added", label: "Requested model added", group: "Model requests", photo: false,
    when: "When the requested device goes live.",
    vars: ["brand_name", "model_name", "request_number"],
    sample: { brand_name: "Samsung", model_name: "Galaxy S25 FE", request_number: "MR-150" },
  },
  {
    key: "admin_new_order", label: "New order (to you)", group: "Admin", photo: false,
    when: "To the admin number on every confirmed order.",
    vars: ["order_number", "order_amount", "customer_name", "number_of_products", "payment_mode"],
    sample: { order_number: "#4102", order_amount: "527.00", customer_name: "Priya Sharma", number_of_products: "2", payment_mode: "COD" },
  },
  {
    key: "admin_daily_digest", label: "Daily digest (to you)", group: "Admin", photo: false,
    when: "Every morning: yesterday's orders, revenue, what to pack.",
    vars: ["orders_count", "revenue", "to_pack", "needs_attention", "low_stock"],
    sample: { orders_count: "17", revenue: "₹4,434", to_pack: "29", needs_attention: "2", low_stock: "R-39 (0m)" },
  },
];
