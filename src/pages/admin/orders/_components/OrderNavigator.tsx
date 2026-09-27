import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button.tsx";

/**
 * Newer / older order, from an order's page: the next confirmed order placed
 * after this one and the one before it, by createdAt. Unpaid checkouts and
 * failed payments (no order number yet, or awaiting payment) and deleted
 * orders are skipped. The
 * keyboard's ← and → do the same when nothing is being typed.
 */
type Near = { id: string; label: string } | null;

async function neighbour(createdAt: number, dir: "newer" | "older"): Promise<Near> {
  const q = query(collection(db, "orders"),
    where("createdAt", dir === "newer" ? ">" : "<", createdAt),
    orderBy("createdAt", dir === "newer" ? "asc" : "desc"), limit(30));
  const s = await getDocs(q);
  const d = s.docs.find((x) => {
    const o = x.data() as any;
    return !!o.orderNumber && !o.isDeleted && o.status !== "pending_payment" && o.paymentStatus !== "failed";
  });
  if (!d) return null;
  const o = d.data() as any;
  return { id: d.id, label: String(o.orderNumber) };
}

export function OrderNavigator({ createdAt }: { createdAt?: number }) {
  const navigate = useNavigate();
  const [newer, setNewer] = useState<Near>(null);
  const [older, setOlder] = useState<Near>(null);

  useEffect(() => {
    setNewer(null); setOlder(null);
    if (!createdAt) return;
    let live = true;
    neighbour(createdAt, "newer").then((n) => { if (live) setNewer(n); }).catch(() => {});
    neighbour(createdAt, "older").then((n) => { if (live) setOlder(n); }).catch(() => {});
    return () => { live = false; };
  }, [createdAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === "ArrowLeft" && newer) navigate(`/backend-skinly/orders/${newer.id}`);
      if (e.key === "ArrowRight" && older) navigate(`/backend-skinly/orders/${older.id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newer, older, navigate]);

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="sm" disabled={!newer} title="Newer order (←)"
        onClick={() => newer && navigate(`/backend-skinly/orders/${newer.id}`)}>
        <ChevronLeftIcon className="size-4 mr-1" /> {newer ? `Newer · ${newer.label}` : "Newer"}
      </Button>
      <Button variant="outline" size="sm" disabled={!older} title="Older order (→)"
        onClick={() => older && navigate(`/backend-skinly/orders/${older.id}`)}>
        {older ? `${older.label} · Older` : "Older"} <ChevronRightIcon className="size-4 ml-1" />
      </Button>
    </div>
  );
}
