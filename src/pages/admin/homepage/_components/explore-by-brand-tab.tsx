import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
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
  TagIcon,
  SparklesIcon,
  GripVerticalIcon,
  SaveIcon
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface CardFormData {
  title: string;
  imageUrl: string;
  linkUrl: string;
  subtitle: string;
  isActive: boolean;
  order: number;
}

interface SectionConfig {
  title: string;
  subtitle: string;
  cardWidth: number;
  cardHeight: number;
}

function SortableCard({ card, onEdit, onDelete }: { 
  card: { _id: Id<"homepageSectionCards">; title: string; imageUrl: string; linkUrl: string; isActive: boolean; order: number };
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card._id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("flex items-center gap-3 p-3 bg-background border rounded-lg", !card.isActive && "opacity-60")}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVerticalIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
        <img src={card.imageUrl} alt={card.title} className="h-full w-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{card.title}</p>
        <p className="text-xs text-muted-foreground truncate">{card.linkUrl}</p>
      </div>
      
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <EditIcon className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete}>
          <TrashIcon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function ExploreByBrandTab() {
  const sections = useQuery(api.homepage.getAllHomepageSections);
  const section = sections?.find((s) => s.sectionType === "explore_by_brand");
  const cards = useQuery(
    api.homepageSectionCards.getAllSectionCards,
    section ? { sectionId: section._id } : "skip"
  );
  
  const createCard = useMutation(api.homepageSectionCards.createSectionCard);
  const updateCard = useMutation(api.homepageSectionCards.updateSectionCard);
  const deleteCard = useMutation(api.homepageSectionCards.deleteSectionCard);
  const autoGenerateCards = useMutation(api.homepageSectionCards.autoGenerateBrandCards);
  const bulkReorder = useMutation(api.homepageSectionCards.bulkReorderSectionCards);
  const updateSection = useMutation(api.homepage.updateHomepageSection);

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [localCards, setLocalCards] = useState<typeof cards>([]);
  
  // Section config state
  const sectionConfig = section?.config as SectionConfig | undefined;
  const [configTitle, setConfigTitle] = useState(sectionConfig?.title || "Explore by Brand");
  const [configSubtitle, setConfigSubtitle] = useState(sectionConfig?.subtitle || "");
  const [cardWidth, setCardWidth] = useState(sectionConfig?.cardWidth || 200);
  const [cardHeight, setCardHeight] = useState(sectionConfig?.cardHeight || 200);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Sync local cards with fetched cards
  useState(() => {
    if (cards) {
      setLocalCards(cards);
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !localCards || localCards.length === 0) return;

    const oldIndex = localCards.findIndex((c) => c._id === active.id);
    const newIndex = localCards.findIndex((c) => c._id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(localCards, oldIndex, newIndex);
      setLocalCards(reordered);
    }
  };

  const handleSaveOrder = async () => {
    if (!localCards || localCards.length === 0) return;

    try {
      const cardOrders = localCards.map((card, index) => ({
        cardId: card._id,
        order: index + 1,
      }));
      
      await bulkReorder({ cardOrders });
      toast.success("Card order saved successfully");
    } catch (error) {
      toast.error("Failed to save card order");
      console.error(error);
    }
  };

  const handleAutoGenerate = async () => {
    if (!section || !confirm("This will replace all existing brand cards with auto-generated ones from your Models database. Continue?")) {
      return;
    }

    setIsGenerating(true);
    try {
      const result = await autoGenerateCards({ sectionId: section._id });
      toast.success(`Generated ${result.count} brand cards! Update images to customize.`);
    } catch (error) {
      toast.error("Failed to auto-generate cards");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!section) return;

    setIsSavingConfig(true);
    try {
      await updateSection({
        sectionId: section._id,
        config: JSON.stringify({
          title: configTitle,
          subtitle: configSubtitle || undefined,
          autoGenerate: false,
          cardWidth,
          cardHeight,
        }),
      });
      toast.success("Section settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error(error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleOpenDialog = (cardId?: Id<"homepageSectionCards">) => {
    if (cardId && cards) {
      const card = cards.find((c) => c._id === cardId);
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
        order: cards ? cards.length + 1 : 1,
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
          cardType: "brand",
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
          <TagIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Explore by Brand section not found. Please run seedHomepage mutation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Config */}
      <Card>
        <CardHeader>
          <CardTitle>Section Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="section-title">Section Title</Label>
              <Input
                id="section-title"
                value={configTitle}
                onChange={(e) => setConfigTitle(e.target.value)}
                placeholder="Explore by Brand"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="section-subtitle">Subtitle (Optional)</Label>
              <Input
                id="section-subtitle"
                value={configSubtitle}
                onChange={(e) => setConfigSubtitle(e.target.value)}
                placeholder="Shop your favorite brands"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-width">Card Width (px)</Label>
              <Input
                id="card-width"
                type="number"
                value={cardWidth}
                onChange={(e) => setCardWidth(parseInt(e.target.value) || 200)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-height">Card Height (px)</Label>
              <Input
                id="card-height"
                type="number"
                value={cardHeight}
                onChange={(e) => setCardHeight(parseInt(e.target.value) || 200)}
              />
            </div>
          </div>
          <Button onClick={handleSaveConfig} disabled={isSavingConfig}>
            <SaveIcon className="w-4 h-4 mr-2" />
            {isSavingConfig ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Brand Cards Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Brand Cards</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage brand cards displayed on homepage
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAutoGenerate} disabled={isGenerating} variant="outline">
                <SparklesIcon className="w-4 h-4 mr-2" />
                {isGenerating ? "Generating..." : "Auto-Generate"}
              </Button>
              <Button onClick={() => handleOpenDialog()}>
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Card
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!localCards || localCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <TagIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                No brand cards yet
              </p>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Click "Auto-Generate" to create cards from your Models database,<br />
                or click "Add Card" to create one manually
              </p>
            </div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={localCards.map((c) => c._id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {localCards.map((card) => (
                      <SortableCard
                        key={card._id}
                        card={card}
                        onEdit={() => handleOpenDialog(card._id)}
                        onDelete={() => handleDelete(card._id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <Button onClick={handleSaveOrder} variant="outline" className="w-full">
                <SaveIcon className="w-4 h-4 mr-2" />
                Save Order
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCard ? "Edit Brand Card" : "Add Brand Card"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-title">Brand Name *</Label>
              <Input
                id="card-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Apple"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-subtitle">Subtitle (Optional)</Label>
              <Input
                id="card-subtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="Premium Devices"
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
              {formData.imageUrl && (
                <div className="mt-2">
                  <img src={formData.imageUrl} alt="Preview" className="h-32 w-32 object-cover rounded border" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="card-link">Link URL *</Label>
              <Input
                id="card-link"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="/products?brand=apple"
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
