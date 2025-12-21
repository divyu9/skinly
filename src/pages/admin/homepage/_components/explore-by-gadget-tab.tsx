import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  SmartphoneIcon
} from "lucide-react";
import { cn } from "@/lib/utils.ts";

interface CardFormData {
  title: string;
  imageUrl: string;
  linkUrl: string;
  subtitle: string;
  isActive: boolean;
  order: number;
}

export function ExploreByGadgetTab() {
  const sections = useQuery(api.homepage.getAllHomepageSections);
  const section = sections?.find((s) => s.sectionType === "explore_by_gadget");
  const cards = useQuery(
    api.homepageSectionCards.getAllSectionCards,
    section ? { sectionId: section._id } : "skip"
  );
  const createCard = useMutation(api.homepageSectionCards.createSectionCard);
  const updateCard = useMutation(api.homepageSectionCards.updateSectionCard);
  const deleteCard = useMutation(api.homepageSectionCards.deleteSectionCard);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Id<"homepageSectionCards"> | null>(null);
  const [formData, setFormData] = useState<CardFormData>({
    title: "",
    imageUrl: "",
    linkUrl: "",
    subtitle: "",
    isActive: true,
    order: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenDialog = (cardId?: Id<"homepageSectionCards">) => {
    if (cardId && cards) {
      const card = cards.find((c: typeof cards[0]) => c._id === cardId);
      if (card) {
        setEditingCard(cardId);
        setFormData({
          title: card.title,
          imageUrl: card.imageUrl,
          linkUrl: card.linkUrl,
          subtitle: card.subtitle || "",
          isActive: card.isActive,
          order: card.order,
        });
      }
    } else {
      setEditingCard(null);
      setFormData({
        title: "",
        imageUrl: "",
        linkUrl: "",
        subtitle: "",
        isActive: true,
        order: cards ? cards.length : 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCard(null);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.imageUrl || !formData.linkUrl || !section) {
      toast.error("Title, image URL, and link URL are required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingCard) {
        await updateCard({
          cardId: editingCard,
          title: formData.title,
          imageUrl: formData.imageUrl,
          linkUrl: formData.linkUrl,
          subtitle: formData.subtitle || undefined,
          isActive: formData.isActive,
          order: formData.order,
        });
        toast.success("Card updated successfully");
      } else {
        await createCard({
          sectionId: section._id,
          cardType: "gadget",
          title: formData.title,
          imageUrl: formData.imageUrl,
          linkUrl: formData.linkUrl,
          subtitle: formData.subtitle || undefined,
          isActive: formData.isActive,
          order: formData.order,
        });
        toast.success("Card created successfully");
      }
      handleCloseDialog();
    } catch (error) {
      toast.error("Failed to save card");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cardId: Id<"homepageSectionCards">) => {
    if (!confirm("Are you sure you want to delete this card?")) {
      return;
    }

    try {
      await deleteCard({ cardId });
      toast.success("Card deleted successfully");
    } catch (error) {
      toast.error("Failed to delete card");
      console.error(error);
    }
  };

  if (sections === undefined || cards === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!section) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <SmartphoneIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Explore by Gadget section not found in database.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Explore by Gadget Cards</h3>
          <p className="text-sm text-muted-foreground">
            Display products organized by gadget type
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <SmartphoneIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No cards yet. Click "Add Card" to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card: typeof cards[0]) => (
            <Card key={card._id} className={cn(!card.isActive && "opacity-60")}>
              <CardContent className="p-0">
                <div
                  className="relative h-56 bg-cover bg-center rounded-t-lg"
                  style={{
                    backgroundImage: card.imageUrl
                      ? `url(${card.imageUrl})`
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                >
                  <div className="absolute inset-0 bg-black/30 rounded-t-lg" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="bg-white text-black px-3 py-1.5 rounded text-sm font-semibold text-center">
                      {card.title}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Order: {card.order}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(card._id)}
                      className="flex-1"
                    >
                      <EditIcon className="w-3 h-3 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(card._id)}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCard ? "Edit Card" : "Add Card"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-title">Title *</Label>
              <Input
                id="card-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="iPhone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-subtitle">Subtitle</Label>
              <Input
                id="card-subtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="All Models"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-image">Image URL *</Label>
              <Input
                id="card-image"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://cdn.hercules.app/file_..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-link">Link URL *</Label>
              <Input
                id="card-link"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="/products?gadgetType=iphone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-order">Display Order</Label>
              <Input
                id="card-order"
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
