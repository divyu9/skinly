import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card } from "@/components/ui/card.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Plus,
  Search,
  Edit,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Wand2,
  MoreVertical,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { AdminLayout } from "@/components/admin-layout.tsx";

type PageType = "brand" | "device" | "product" | "skin-type" | "keyword";

type Page = {
  _id: Id<"seoPages">;
  pageType: PageType;
  metaTitle: string;
  slug: string;
  isPublished: boolean;
  createdAt: number;
  updatedAt?: number;
};

export default function SEOPagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pageTypeFilter, setPageTypeFilter] = useState<PageType | "all">("all");
  const [publishedFilter, setPublishedFilter] = useState<"all" | "published" | "draft">("all");
  const [selectedPages, setSelectedPages] = useState<Set<Id<"seoPages">>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<Id<"seoPages"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const pages = useQuery(api.seoPages.listPages, {
    pageType: pageTypeFilter === "all" ? undefined : pageTypeFilter,
    isPublished: publishedFilter === "all" ? undefined : publishedFilter === "published",
    searchQuery: searchQuery || undefined,
  });

  const deletePage = useMutation(api.seoPages.deletePage);
  const clonePage = useMutation(api.seoPages.clonePage);
  const togglePublish = useMutation(api.seoPages.togglePublish);
  const bulkTogglePublish = useMutation(api.seoPages.bulkTogglePublish);
  const bulkDeletePages = useMutation(api.seoPages.bulkDeletePages);

  const handleClone = async (pageId: Id<"seoPages">) => {
    try {
      const result = await clonePage({ pageId });
      toast.success(`Page cloned successfully: ${result.slug}`);
    } catch (error) {
      toast.error("Failed to clone page");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!pageToDelete) return;

    setIsDeleting(true);
    try {
      await deletePage({ pageId: pageToDelete });
      toast.success("Page deleted successfully");
      setDeleteDialogOpen(false);
      setPageToDelete(null);
    } catch (error) {
      toast.error("Failed to delete page");
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePublish = async (pageId: Id<"seoPages">, isPublished: boolean) => {
    try {
      await togglePublish({ pageId, isPublished: !isPublished });
      toast.success(isPublished ? "Page unpublished" : "Page published");
    } catch (error) {
      toast.error("Failed to update page");
      console.error(error);
    }
  };

  const handleBulkPublish = async (publish: boolean) => {
    if (selectedPages.size === 0) return;

    try {
      await bulkTogglePublish({
        pageIds: Array.from(selectedPages),
        isPublished: publish,
      });
      toast.success(
        `${selectedPages.size} page${selectedPages.size > 1 ? "s" : ""} ${publish ? "published" : "unpublished"}`
      );
      setSelectedPages(new Set());
    } catch (error) {
      toast.error("Failed to update pages");
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPages.size === 0) return;

    try {
      await bulkDeletePages({ pageIds: Array.from(selectedPages) });
      toast.success(`${selectedPages.size} page${selectedPages.size > 1 ? "s" : ""} deleted`);
      setSelectedPages(new Set());
    } catch (error) {
      toast.error("Failed to delete pages");
      console.error(error);
    }
  };

  const toggleSelectAll = () => {
    if (selectedPages.size === pages?.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(pages?.map((p) => p._id) || []));
    }
  };

  const toggleSelectPage = (pageId: Id<"seoPages">) => {
    const newSet = new Set(selectedPages);
    if (newSet.has(pageId)) {
      newSet.delete(pageId);
    } else {
      newSet.add(pageId);
    }
    setSelectedPages(newSet);
  };

  const getPageTypeBadgeColor = (type: PageType) => {
    switch (type) {
      case "brand":
        return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
      case "device":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "product":
        return "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20";
      case "skin-type":
        return "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20";
      case "keyword":
        return "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20";
      default:
        return "";
    }
  };

  const getPreviewUrl = (page: Page) => {
    const baseUrl = window.location.origin;
    switch (page.pageType) {
      case "brand":
        return `${baseUrl}/brand/${page.slug}`;
      case "device":
        return `${baseUrl}/device/${page.slug}`;
      case "product":
        return `${baseUrl}/product/${page.slug}`;
      case "skin-type":
        return `${baseUrl}/skin-type/${page.slug}`;
      case "keyword":
        return `${baseUrl}/${page.slug}`;
      default:
        return `${baseUrl}/${page.slug}`;
    }
  };

  const handlePreview = (page: Page) => {
    const url = getPreviewUrl(page);
    window.open(url, "_blank");
  };

  if (pages === undefined) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SEO Landing Pages</h1>
          <p className="text-muted-foreground mt-2">
            Manage SEO-optimized landing pages for brands, devices, products, and keywords
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/backend-skinly/seo-pages/auto-generate">
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-Generate
            </Link>
          </Button>
          <Button asChild>
            <Link to="/backend-skinly/seo-pages/new">
              <Plus className="mr-2 h-4 w-4" />
              Create New Page
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={pageTypeFilter} onValueChange={(v) => setPageTypeFilter(v as PageType | "all")}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Page Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="brand">Brand</SelectItem>
              <SelectItem value="device">Device</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="skin-type">Skin Type</SelectItem>
              <SelectItem value="keyword">Keyword</SelectItem>
            </SelectContent>
          </Select>
          <Select value={publishedFilter} onValueChange={(v) => setPublishedFilter(v as typeof publishedFilter)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pages</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedPages.size > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {selectedPages.size} page{selectedPages.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkPublish(true)}>
                <Eye className="mr-2 h-4 w-4" />
                Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkPublish(false)}>
                <EyeOff className="mr-2 h-4 w-4" />
                Unpublish
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Pages Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedPages.size === pages.length && pages.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No pages found. Create your first SEO page to get started.
                </TableCell>
              </TableRow>
            ) : (
              pages.map((page) => (
                <TableRow key={page._id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedPages.has(page._id)}
                      onCheckedChange={() => toggleSelectPage(page._id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{page.metaTitle}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={getPageTypeBadgeColor(page.pageType)}>
                      {page.pageType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">/{page.slug}</TableCell>
                  <TableCell>
                    {page.isPublished ? (
                      <Badge variant="default">Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(page.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(page)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/backend-skinly/seo-pages/${page._id}`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleClone(page._id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePublish(page._id, page.isPublished)}>
                          {page.isPublished ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Publish
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setPageToDelete(page._id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this page? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
