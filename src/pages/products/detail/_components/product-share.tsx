import { ShareIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";

interface ProductShareButtonProps {
  productTitle: string;
  productUrl: string;
}

export function ProductShareButton({ productTitle, productUrl }: ProductShareButtonProps) {
  const handleShare = async () => {
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: productTitle,
          text: `Check out ${productTitle} on Skinly`,
          url: productUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        if ((error as Error).name !== "AbortError") {
          // Fallback to copying link
          handleCopyLink();
        }
      }
    } else {
      // Fallback to copying link
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(productUrl);
    toast.success("Link copied to clipboard!");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleShare}
      className="shrink-0"
      aria-label="Share product"
    >
      <ShareIcon className="size-4" />
    </Button>
  );
}
