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
    <section className="container mx-auto px-4 py-12 bg-muted/30 rounded-3xl">
      <div className="space-y-8">
        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center space-y-3 p-6 rounded-2xl bg-background hover:shadow-lg transition-shadow"
            >
              {/* Icon */}
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold">{item.title}</h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
