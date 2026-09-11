"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWhatsAppTemplate = exports.triggerWhatsAppWorker = exports.whatsappQueueWorker = exports.readAuthkeyResult = void 0;
const functionsV1 = __importStar(require("firebase-functions/v1"));
const https_1 = require("firebase-functions/v1/https");
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("./auth");
const rate_limit_1 = require("./rate-limit");
/**
 * Drains whatsappQueue through the authkey API.
 *
 * Nothing has sent since February: the templates and usecases never came
 * across in the migration, so there was no config to send against and no
 * worker to do it. Config is restored; this is the worker.
 *
 * A row is claimed inside a transaction before the request goes out, so a
 * failure mid-send costs one message rather than re-sending it every run.
 */
// The WhatsApp endpoint, not the SMS one. api.authkey.io/request with `sid`
// is Authkey's SMS API: it answered every send with {"success":{"sms":false},
// "message":{"sms":"Invalid Template"}} — keyed by "sms", because that is what
// it thought we were sending. WhatsApp wants this host and `wid`.
const AUTHKEY_URL = "https://console.authkey.io/restapi/request.php";
const MAX_PER_RUN = 40;
const MAX_ATTEMPTS = 3;
/**
 * Decides whether Authkey actually sent the message.
 *
 * It does not answer the way the old check assumed. A refusal comes back as
 * HTTP 203 with `{"Message": "Invalid authkey or insufficient balance"}` — a
 * 2xx, so `res.ok` was true, and the word "error" never appears, so the
 * substring test missed it too. Every rejected message was recorded as sent,
 * which is the worst outcome available: the queue drains, the admin reads
 * "sent", and the customer hears nothing.
 *
 * So the rule is inverted. A send counts only on a recognised success signal;
 * anything unrecognised is a failure that keeps the body for diagnosis. A
 * message wrongly marked failed is retried, which costs little. A message
 * wrongly marked sent is simply gone.
 */
function readAuthkeyResult(status, body) {
    var _a, _b, _c, _d, _e, _f;
    const text = String(body || "").trim();
    if (status !== 200)
        return { sent: false, reason: `HTTP ${status}: ${text.slice(0, 240)}` };
    let message = text;
    let hasLogId = false;
    try {
        const j = JSON.parse(text);
        // This endpoint answers per channel: {"success":{"whatsapp":true},
        // "message":{"whatsapp":"..."}}. A nested false is a refusal however
        // cheerful the surrounding JSON looks.
        const flat = (v) => v && typeof v === "object" ? Object.values(v).map(String).join(" ") : String(v !== null && v !== void 0 ? v : "");
        message = flat((_b = (_a = j.message) !== null && _a !== void 0 ? _a : j.Message) !== null && _b !== void 0 ? _b : text);
        if (j.success && typeof j.success === "object") {
            const flags = Object.values(j.success);
            if (flags.length && flags.every((f) => f === false)) {
                return { sent: false, reason: message.slice(0, 240) || "provider reported failure" };
            }
            if (flags.some((f) => f === true))
                return { sent: true, reason: "" };
        }
        if (j.success === false)
            return { sent: false, reason: message.slice(0, 240) };
        hasLogId = Boolean((_f = (_e = (_d = (_c = j.LogID) !== null && _c !== void 0 ? _c : j.log_id) !== null && _d !== void 0 ? _d : j.logid) !== null && _e !== void 0 ? _e : j.MessageID) !== null && _f !== void 0 ? _f : j.message_id);
    }
    catch (_g) {
        // Not JSON; judge the raw text instead.
    }
    if (/invalid|insufficient|unauthor|denied|fail|error|missing|not found|blocked/i.test(message)) {
        return { sent: false, reason: message.slice(0, 240) };
    }
    if (hasLogId || /success|submitted|queued|accepted/i.test(message)) {
        return { sent: true, reason: "" };
    }
    return { sent: false, reason: `Unrecognised Authkey response: ${text.slice(0, 240)}` };
}
exports.readAuthkeyResult = readAuthkeyResult;
const isSendableStatus = (s) => s === "pending" || s === "queued";
/** Claims one queue row, or returns null if another run already has it. */
const claim = async (queueId) => {
    const db = admin.firestore();
    const ref = db.collection("whatsappQueue").doc(queueId);
    try {
        return await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists)
                return null;
            const row = snap.data();
            if (!isSendableStatus(row.status))
                return null;
            if (Number(row.attempts || 0) >= MAX_ATTEMPTS) {
                tx.update(ref, { status: "failed", failureReason: "attempt limit reached" });
                return null;
            }
            tx.update(ref, {
                status: "processing",
                attempts: Number(row.attempts || 0) + 1,
                lastAttemptAt: Date.now(),
            });
            return Object.assign(Object.assign({}, row), { _id: queueId });
        });
    }
    catch (err) {
        console.error(`claim failed for queue row ${queueId}:`, err);
        return null;
    }
};
const sendOne = async (queueRow) => {
    const db = admin.firestore();
    const queueRef = db.collection("whatsappQueue").doc(queueRow._id);
    const messageId = queueRow.messageId;
    const msgSnap = messageId ? await db.collection("whatsappMessages").doc(messageId).get() : null;
    if (!(msgSnap === null || msgSnap === void 0 ? void 0 : msgSnap.exists)) {
        await queueRef.update({ status: "failed", failureReason: "message not found" });
        return false;
    }
    const msg = msgSnap.data();
    // Respect the per-usecase switch at send time, so turning one off takes
    // effect immediately for anything already queued.
    const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", msg.usecaseKey).limit(1).get();
    if (uc.empty || uc.docs[0].data().enabled !== true) {
        await queueRef.update({ status: "skipped", failureReason: "usecase disabled" });
        await msgSnap.ref.update({ status: "skipped" });
        return false;
    }
    const authkey = process.env.WHATSAPP_AUTHKEY || "";
    if (!authkey)
        throw new Error("WHATSAPP_AUTHKEY not configured");
    const phone = String(msg.recipientPhone || "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
        await queueRef.update({ status: "failed", failureReason: "invalid phone" });
        await msgSnap.ref.update({ status: "failed" });
        return false;
    }
    const wid = String(msg.providerTemplateId || uc.docs[0].data().providerTemplateId || "");
    if (!wid) {
        await queueRef.update({ status: "failed", failureReason: "no providerTemplateId on the usecase" });
        await msgSnap.ref.update({ status: "failed" });
        return false;
    }
    // Authkey takes variables positionally, as 1, 2, 3…, in the order the
    // template declares them — not by name. Sent by name they are simply
    // dropped and the message arrives with empty placeholders.
    const tpl = await db.collection("whatsappTemplates")
        .where("providerTemplateId", "==", wid).limit(1).get();
    const order = tpl.empty ? [] : (tpl.docs[0].data().variables || []);
    const numbered = {};
    order.forEach((name, i) => {
        const v = (msg.variables || {})[name];
        if (v !== undefined)
            numbered[String(i + 1)] = String(v);
    });
    const params = new URLSearchParams(Object.assign({ authkey, mobile: phone, country_code: "91", wid }, numbered));
    const fetch = require("node-fetch");
    const res = await fetch(`${AUTHKEY_URL}?${params.toString()}`, { method: "GET" });
    const body = await res.text();
    const verdict = readAuthkeyResult(res.status, body);
    if (!verdict.sent) {
        console.error("authkey send failed:", { status: res.status, body: body.slice(0, 300) });
        await queueRef.update({ status: "pending", failureReason: verdict.reason });
        await msgSnap.ref.update({ status: "failed", failureReason: verdict.reason });
        return false;
    }
    await queueRef.update({ status: "sent", sentAt: Date.now(), failureReason: admin.firestore.FieldValue.delete() });
    await msgSnap.ref.update({ status: "sent", sentAt: Date.now() });
    return true;
};
const drainQueue = async () => {
    const db = admin.firestore();
    const due = await db.collection("whatsappQueue")
        .where("status", "in", ["pending", "queued"])
        .limit(MAX_PER_RUN)
        .get();
    let sent = 0;
    let claimed = 0;
    for (const d of due.docs) {
        const row = await claim(d.id);
        if (!row)
            continue;
        claimed++;
        try {
            await (0, rate_limit_1.enforceDailyRateLimit)({
                key: "whatsappSends",
                limit: Number(process.env.WHATSAPP_DAILY_LIMIT || 500),
            });
        }
        catch (_a) {
            console.warn("daily WhatsApp cap reached; stopping this pass");
            await db.collection("whatsappQueue").doc(d.id).update({ status: "pending" });
            break;
        }
        if (await sendOne(row))
            sent++;
    }
    return { sent, claimed };
};
exports.whatsappQueueWorker = functionsV1.pubsub
    .schedule("every 5 minutes")
    .timeZone("Asia/Kolkata")
    .onRun(async () => {
    const result = await drainQueue();
    if (result.claimed)
        console.log("whatsapp worker:", result);
    return null;
});
/** Runs the same pass on demand from the dashboard. */
exports.triggerWhatsAppWorker = (0, https_1.onCall)(async (_data, context) => {
    await (0, auth_1.requireAdmin)(context);
    return drainQueue();
});
/** Sends one message against a usecase, to check the provider wiring. */
exports.testWhatsAppTemplate = (0, https_1.onCall)(async (data, context) => {
    await (0, auth_1.requireAdmin)(context);
    if (!(data === null || data === void 0 ? void 0 : data.phone) || !(data === null || data === void 0 ? void 0 : data.usecaseKey)) {
        throw new https_1.HttpsError("invalid-argument", "phone and usecaseKey are required");
    }
    const db = admin.firestore();
    const uc = await db.collection("whatsappUsecases").where("usecaseKey", "==", data.usecaseKey).limit(1).get();
    if (uc.empty)
        throw new https_1.HttpsError("not-found", "Usecase not found");
    const authkey = process.env.WHATSAPP_AUTHKEY || "";
    if (!authkey)
        throw new https_1.HttpsError("failed-precondition", "WHATSAPP_AUTHKEY is not configured");
    const phone = String(data.phone).replace(/\D/g, "").slice(-10);
    const params = new URLSearchParams(Object.assign({ authkey, mobile: phone, country_code: "91", sid: String(uc.docs[0].data().providerTemplateId || "") }, (data.variables || {})));
    const fetch = require("node-fetch");
    const res = await fetch(`${AUTHKEY_URL}?${params.toString()}`, { method: "GET" });
    const body = await res.text();
    return { ok: res.ok && !/error/i.test(body), response: body.slice(0, 500) };
});
//# sourceMappingURL=whatsappWorker.js.map