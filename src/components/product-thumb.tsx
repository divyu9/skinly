import { useState } from "react";
import { ImageOffIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";

/**
 * A product image that degrades to a neutral placeholder instead of the
 * browser's broken-image alt text.
 *
 * Around 3,800 product photos were lost when the old Cloudinary account was
 * deleted, so a share of URLs in the catalogue 404. Rendering the alt string in
 * a grey box made carousels look abandoned — worse than showing nothing.
 */
export function ProductThumb({
  src,
  alt,
  className,
  dimmed,
}: {
  src?: string;
  alt: string;
  className?: string;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
        <ImageOffIcon className="size-7 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", dimmed && "opacity-30", className)}
    />
  );
}
