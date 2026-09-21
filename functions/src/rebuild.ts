/**
 * Asking the storefront to rebuild itself.
 *
 * Hostinger deploys the prod-ready branch on every push, so a code change
 * deploys itself. A *data* change does not: publishing an SEO page or
 * repairing one writes to Firestore and pushes nothing, so the page sits
 * there until the 3 am job pushes an empty commit — or until somebody
 * remembers to open GitHub and press Run workflow.
 *
 * The launch pipeline has asked for rebuilds this way for a while. This is
 * the same request, lifted out so anything that changes what the storefront
 * should render can make it.
 */
export async function requestRebuild(reason: string): Promise<{ ok: boolean; note: string }> {
  const token = process.env.GITHUB_REBUILD_TOKEN || "";
  const repo = process.env.GITHUB_REPO || "divyu9/skinly";
  const hook = process.env.HOSTINGER_DEPLOY_WEBHOOK || "";

  if (token) {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "skinly-rebuild",
      },
      body: JSON.stringify({ event_type: "rebuild", client_payload: { reason } }),
    });
    const note = res.ok
      ? "storefront rebuild requested — live in about five minutes"
      : `GitHub ${res.status}: ${(await res.text()).slice(0, 120)}`;
    return { ok: res.ok, note };
  }
  if (hook) {
    const res = await fetch(hook, { method: "POST" });
    return { ok: res.ok, note: `webhook ${res.status}` };
  }
  // Not an error: the nightly job will pick the change up either way.
  return { ok: false, note: "no rebuild token set — the nightly rebuild will pick this up" };
}
