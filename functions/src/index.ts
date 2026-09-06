import * as dotenv from "dotenv";
import * as admin from "firebase-admin";
dotenv.config();
admin.initializeApp();

export * from "./phonepe";
export * from "./placeorder";
export * from "./rapidshyp";
export * from "./whatsapp";
export * from "./seo";
export * from "./r2";
export * from "./orders";
export * from "./loginOtp";
export * from "./abandonedCarts";
