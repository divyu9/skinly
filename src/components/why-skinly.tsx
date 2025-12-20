import { ShieldCheckIcon, TruckIcon, SparklesIcon, PackageIcon } from "lucide-react";

interface WhySkinlyItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const defaultItems: WhySkinlyItem[] = [
  {
    icon: <ShieldCheckIcon className="size-8 text-primary" />,
    title: "Premium Quality",
    description: "High-quality materials that protect and enhance your devices",
  },
  {
    icon: <TruckIcon className="size-8 text-primary" />,
    title: "Fast Shipping",
    description: "Quick delivery across India with reliable tracking",
  },
  {
    icon: <SparklesIcon className="size-8 text-primary" />,
    title: "Unique Designs",
    description: "Stunning designs that make your device stand out",
  },
  {
    icon: <PackageIcon className="size-8 text-primary" />,
    title: "Perfect Fit",
    description: "Precision-cut for your exact device model",
  },
];

interface WhySkinlyProps {
  title?: string;
  items?: WhySkinlyItem[];
}

export function WhySkinly({ 
  title = "Why Choose Skinly?",
  items = defaultItems
}: WhySkinlyProps) {
  return (
    <section className="container mx-auto px-4 py-8 bg-muted/30 rounded-3xl">
      <div className="space-y-4">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
        </div>

        {/* Items Grid - 2x2 on mobile, 4x1 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center space-y-2 p-3 md:p-4 rounded-xl bg-background hover:shadow-lg transition-shadow"
            >
              {/* Icon */}
              <div className="size-10 md:size-12 rounded-full bg-primary/10 flex items-center justify-center">
                <div className="scale-75 md:scale-100">{item.icon}</div>
              </div>

              {/* Title */}
              <h3 className="text-xs md:text-sm font-semibold leading-tight">{item.title}</h3>

              {/* Description */}
              <p className="text-[10px] md:text-xs text-muted-foreground leading-snug">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
