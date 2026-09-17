import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@/lib/firebase-hooks";
import { api } from "@/lib/firebase-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CheckIcon, ImageIcon, SearchIcon } from "lucide-react";

export interface PickedImage {
  url: string;
  alt: string;
}

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URLs already on the product, so they can be shown as added and not re-added. */
  existingUrls?: string[];
  onSelect: (images: PickedImage[]) => void;
  /** Pick exactly one image (a logo, a banner): a new click replaces the last. */
  single?: boolean;
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  existingUrls = [],
  onSelect,
  single = false,
}: MediaPickerDialogProps) {
  const [folder, setFolder] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, PickedImage>>({});
  // The list used to stop at 200, newest first, so older uploads could not be
  // reached at all. It now grows a page at a time, as the grid is scrolled.
  const PAGE = 120;
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [folder, search]);

  const folders = useQuery(api.mediaLibrary.getFolders);
  const result = useQuery(api.mediaLibrary.listMedia, {
    folder: folder === "all" ? undefined : folder,
    mediaType: "image",
    searchQuery: search || undefined,
  });

  // Media documents keep the URL under whichever provider uploaded them.
  // The library is read once; paging only decides how many to draw.
  const allItems = useMemo(() => {
    const raw = (result as any)?.items ?? [];
    return raw
      .map((m: any) => ({
        id: m._id,
        url: m.url || m.cloudinaryUrl || m.r2Url || "",
        filename: m.filename || "untitled",
        folder: m.folder || "",
      }))
      .filter((m: any) => m.url);
  }, [result]);
  const total = allItems.length;
  const items = useMemo(() => allItems.slice(0, shown), [allItems, shown]);

  const alreadyAdded = useMemo(() => new Set(existingUrls), [existingUrls]);
  const selectedCount = Object.keys(selected).length;

  const toggle = (item: { id: string; url: string; filename: string }) => {
    if (alreadyAdded.has(item.url)) return;
    setSelected((prev) => {
      const next = single ? (prev[item.id] ? { ...prev } : {}) : { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = { url: item.url, alt: item.filename };
      return next;
    });
  };

  const close = () => {
    setSelected({});
    setSearch("");
    onOpenChange(false);
  };

  const confirm = () => {
    onSelect(Object.values(selected));
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose from media library</DialogTitle>
          <DialogDescription>
            Pick images you have already uploaded. Select as many as you need.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by filename"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {(folders ?? []).map((f: string) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className="max-h-[55vh] overflow-y-auto rounded-lg border p-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight > el.scrollHeight - 300 && shown < total) setShown((n) => n + PAGE);
          }}
        >
          {result === undefined ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="mb-3 size-10 text-muted-foreground" />
              <p className="font-medium">No images found</p>
              <p className="text-sm text-muted-foreground">
                Try another folder, or upload from the Media page first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((item: any) => {
                const isAdded = alreadyAdded.has(item.url);
                const isSelected = !!selected[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item)}
                    disabled={isAdded}
                    title={isAdded ? "Already on this product" : item.filename}
                    className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition
                      ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-muted-foreground/30"}
                      ${isAdded ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                  >
                    <img
                      src={item.url}
                      alt={item.filename}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    {(isSelected || isAdded) && (
                      <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                        <CheckIcon className="size-4" />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[11px] text-white">
                      {isAdded ? "Already added" : item.filename}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {result !== undefined && total > 0 && (
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span>Showing {Math.min(items.length, total)} of {total}</span>
              {shown < total && (
                <Button type="button" size="sm" variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <span className="self-center text-sm text-muted-foreground">
            {selectedCount > 0 ? `${selectedCount} selected` : "Nothing selected"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={confirm} disabled={selectedCount === 0}>
              Add {selectedCount > 0 ? selectedCount : ""} image{selectedCount === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
