import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";

/**
 * Media Library - Store and manage uploaded media files
 */

// Get all media items with pagination
export const listMedia = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    folder: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let query = ctx.db.query("mediaLibrary").order("desc");

    const items = await query.collect();

    // Filter by folder if specified
    let filtered = items;
    if (args.folder) {
      filtered = filtered.filter((item) => item.folder === args.folder);
    }

    // Filter by media type if specified
    if (args.mediaType) {
      filtered = filtered.filter((item) => item.mediaType === args.mediaType);
    }

    // Filter by search query if specified
    if (args.searchQuery) {
      const search = args.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.filename.toLowerCase().includes(search) ||
          item.folder?.toLowerCase().includes(search) ||
          item.tags?.some((tag) => tag.toLowerCase().includes(search))
      );
    }

    // Apply pagination
    const paginated = filtered.slice(0, limit);

    return {
      items: paginated,
      hasMore: filtered.length > limit,
      totalCount: filtered.length,
    };
  },
});

// Get unique folders from media library
export const getFolders = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("mediaLibrary").collect();
    const folders = new Set<string>();

    items.forEach((item) => {
      if (item.folder) {
        folders.add(item.folder);
      }
    });

    return Array.from(folders).sort();
  },
});

// Get media item by ID
export const getMediaById = query({
  args: { id: v.id("mediaLibrary") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Add media item to library
export const addMedia = mutation({
  args: {
    cloudinaryUrl: v.string(),
    cloudinaryPublicId: v.string(),
    filename: v.string(),
    folder: v.optional(v.string()),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    format: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    bytes: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    return await ctx.db.insert("mediaLibrary", {
      ...args,
      uploadedBy: identity?.email || "unknown",
      createdAt: Date.now(),
    });
  },
});

// Update media item (tags, folder)
export const updateMedia = mutation({
  args: {
    id: v.id("mediaLibrary"),
    filename: v.optional(v.string()),
    folder: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Media not found");

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete media item from library
export const deleteMediaInternal = internalMutation({
  args: { id: v.id("mediaLibrary") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Media not found");

    await ctx.db.delete(args.id);
    return { success: true, publicId: existing.cloudinaryPublicId };
  },
});

// Action to delete media from R2 and database
export const deleteMedia = action({
  args: { id: v.id("mediaLibrary") },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(api.mediaLibrary.getMediaById, { id: args.id });
    if (!existing) throw new Error("Media not found");

    // Delete from R2
    if (existing.cloudinaryPublicId) {
      try {
        await ctx.runAction((internal as any).r2.deleteFromR2, {
          key: existing.cloudinaryPublicId,
        });
      } catch (e) {
        console.error(`Failed to delete ${existing.cloudinaryPublicId} from R2`, e);
      }
    }

    return await ctx.runMutation(internal.mediaLibrary.deleteMediaInternal, { id: args.id });
  },
});

// Internal mutation to add media (called from action)
export const addMediaInternal = internalMutation({
  args: {
    cloudinaryUrl: v.string(),
    cloudinaryPublicId: v.string(),
    filename: v.string(),
    folder: v.optional(v.string()),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    format: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    bytes: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mediaLibrary", {
      ...args,
      uploadedBy: "system",
      createdAt: Date.now(),
    });
  },
});

// Internal bulk delete
export const bulkDeleteMediaInternal = internalMutation({
  args: { ids: v.array(v.id("mediaLibrary")) },
  handler: async (ctx, args) => {
    const publicIds: string[] = [];

    for (const id of args.ids) {
      const existing = await ctx.db.get(id);
      if (existing) {
        publicIds.push(existing.cloudinaryPublicId);
        await ctx.db.delete(id);
      }
    }

    return { success: true, deletedCount: args.ids.length, publicIds };
  },
});

// Bulk delete media items from R2 and database
export const bulkDeleteMedia = action({
  args: { ids: v.array(v.id("mediaLibrary")) },
  handler: async (ctx, args) => {
    let deletedCount = 0;
    const publicIds: string[] = [];

    for (const id of args.ids) {
      const existing = await ctx.runQuery(api.mediaLibrary.getMediaById, { id });
      if (existing && existing.cloudinaryPublicId) {
        try {
          await ctx.runAction((internal as any).r2.deleteFromR2, {
            key: existing.cloudinaryPublicId,
          });
          publicIds.push(existing.cloudinaryPublicId);
          deletedCount++;
        } catch (e) {
          console.error(`Failed to delete ${existing.cloudinaryPublicId} from R2`, e);
        }
      }
    }

    await ctx.runMutation(internal.mediaLibrary.bulkDeleteMediaInternal, { ids: args.ids });
    return { success: true, deletedCount, publicIds };
  },
});

// Upload to R2 and add to media library
export const uploadAndAddToLibrary = action({
  args: {
    imageBase64: v.string(),
    filename: v.string(),
    folder: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
  },
  handler: async (ctx, args) => {
    try {
      // Generate a unique file name
      const sanitizedFilename = args.filename
        .replace(/\.[^/.]+$/, "") // Remove extension
        .replace(/[^a-zA-Z0-9-_]/g, "_"); // Sanitize
      const folder = args.folder || "media-library";
      
      // Determine file extension
      let extension = "webp"; // default
      if (args.imageBase64.startsWith("data:")) {
        const mimeMatch = args.imageBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        if (mimeMatch && mimeMatch.length > 1) {
          const mimeType = mimeMatch[1];
          if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
          else if (mimeType.includes("png")) extension = "png";
          else if (mimeType.includes("gif")) extension = "gif";
          else if (mimeType.includes("mp4")) extension = "mp4";
          else if (mimeType.includes("webm")) extension = "webm";
        }
      }
      
      const fileKey = `${folder}/${sanitizedFilename}_${Date.now()}.${extension}`;
      
      // Extract base64 data
      const base64Data = args.imageBase64.includes(',') 
        ? args.imageBase64.split(',')[1] 
        : args.imageBase64;
        
      const contentType = args.mediaType === "video" ? `video/${extension}` : `image/${extension}`;

      // Upload to R2
      const r2Result = await ctx.runAction((internal as any).r2.uploadToR2, {
        fileBase64: base64Data,
        key: fileKey,
        contentType: contentType,
      });

      if (!r2Result.success) {
        throw new Error(r2Result.error || "Failed to upload to R2");
      }

      // We need to estimate file size since R2 action doesn't return it yet
      // A base64 string is about 33% larger than the original binary
      const estimatedBytes = Math.floor((base64Data.length * 3) / 4);

      // Add to media library using internal mutation
      await ctx.runMutation(internal.mediaLibrary.addMediaInternal, {
        cloudinaryUrl: r2Result.url, // Keeping the field name for backward compatibility in DB schema, but storing R2 URL
        cloudinaryPublicId: r2Result.key, // Store R2 key here for deletion later
        filename: args.filename,
        folder: folder,
        mediaType: args.mediaType || "image",
        format: extension,
        width: 0, // We can't easily determine dimensions server-side without a library
        height: 0,
        bytes: estimatedBytes,
        tags: args.tags || [],
      });

      return {
        success: true,
        cloudinaryUrl: r2Result.url, // Return R2 URL
        publicId: r2Result.key, // Return R2 key
        format: extension,
        width: 0,
        height: 0,
        bytes: estimatedBytes,
      };
    } catch (error) {
      console.error("Media upload error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  },
});
