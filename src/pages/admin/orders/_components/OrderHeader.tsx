import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

export type OrderStatus =
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "rto"
  | "pending_payment"
  | "failed";

export type PaymentStatus = "pending" | "success" | "failed";

interface OrderHeaderProps {
  orderNumber: string;
  creationTime: any;
  status: string;
  paymentStatus?: string;
  onStatusChange: (status: OrderStatus) => void;
  onPaymentStatusChange: (status: PaymentStatus) => void;
}

const STATUS_COLORS: Record<string, string> = {
  processing: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  shipped: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  delivered: "bg-green-500/10 text-green-600 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
  rto: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  pending_payment: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

const PAYMENT_COLORS: Record<string, string> = {
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

function formatDate(timestamp: number) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

export function OrderHeader({
  orderNumber,
  creationTime,
  status,
  paymentStatus,
  onStatusChange,
  onPaymentStatusChange,
}: OrderHeaderProps) {
  const statusColor = STATUS_COLORS[status] || "";
  const paymentColor =
    PAYMENT_COLORS[paymentStatus || ""] ||
    "bg-gray-500/10 text-gray-600 border-gray-500/20";

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{orderNumber}</h1>
        <p className="text-muted-foreground">{formatDate(toMillis(creationTime))}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as OrderStatus)}
        >
          <SelectTrigger className={`w-40 ${statusColor}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="rto">RTO</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={paymentStatus || "pending"}
          onValueChange={(v) => onPaymentStatusChange(v as PaymentStatus)}
        >
          <SelectTrigger className={`w-40 ${paymentColor}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Payment Pending</SelectItem>
            <SelectItem value="success">Paid</SelectItem>
            <SelectItem value="failed">Payment Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
