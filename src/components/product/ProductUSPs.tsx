import {
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon,
  CheckIcon,
  PackageIcon,
} from "lucide-react";

const SKIN_USPS = [
  { icon: ShieldCheckIcon, text: "Precision Cut for Perfect Fit" },
  { icon: SparklesIcon, text: "High-Resolution Print Quality" },
  { icon: TruckIcon, text: "Bubble-Free Application" },
  { icon: CheckIcon, text: "Easy to Remove & Residue-Free" },
  { icon: CheckIcon, text: "Easy Installation" },
  { icon: PackageIcon, text: "Premium Installation Kit Included" },
];

interface ProductUSPsProps {
  show: boolean;
}

export function ProductUSPs({ show }: ProductUSPsProps) {
  if (!show) return null;
  
  return (
    <div className="space-y-2">
      {SKIN_USPS.map((usp, idx) => (
        <div key={idx} className="flex items-start gap-2 text-sm">
          <usp.icon className="size-4 shrink-0 mt-0.5 text-primary" />
          <span className="text-muted-foreground">{usp.text}</span>
        </div>
      ))}
    </div>
  );
}
