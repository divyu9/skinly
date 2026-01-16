import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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

// Delete media item from library (note: doesn't delete from Cloudinary)
export const deleteMedia = mutation({
  args: { id: v.id("mediaLibrary") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Media not found");

    await ctx.db.delete(args.id);
    return { success: true, publicId: existing.cloudinaryPublicId };
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

// Bulk delete media items
export const bulkDeleteMedia = mutation({
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

// Upload to Cloudinary and add to media library
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
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary credentials not configured");
      }

      // Generate a unique public ID
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const sanitizedFilename = args.filename
        .replace(/\.[^/.]+$/, "") // Remove extension
        .replace(/[^a-zA-Z0-9-_]/g, "_"); // Sanitize
      const publicId = `${sanitizedFilename}_${Date.now()}`;
      const folder = args.folder || "media-library";

      // Prepare upload parameters
      const uploadParams: Record<string, string> = {
        upload_preset: "webp-auto-convert",
        folder: folder,
        public_id: publicId,
        timestamp: timestamp,
      };

      // Generate signature
      const sortedParams = Object.keys(uploadParams)
        .sort()
        .map((key) => `${key}=${uploadParams[key]}`)
        .join("&");

      const signatureInput = sortedParams + apiSecret;

      async function sha1(str: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest("SHA-1", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      }

      const signature = await sha1(signatureInput);

      // Determine resource type based on media type
      const resourceType = args.mediaType === "video" ? "video" : "image";

      const finalParams = {
        ...uploadParams,
        api_key: apiKey,
        signature: signature,
        file: args.imageBase64,
      };

      // Upload to Cloudinary
      const formData = new FormData();
      Object.entries(finalParams).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value);
        }
      });

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudinary upload failed: ${errorText}`);
      }

      const result = await response.json();

      // Add to media library using internal mutation
      await ctx.runMutation(internal.mediaLibrary.addMediaInternal, {
        cloudinaryUrl: result.secure_url,
        cloudinaryPublicId: result.public_id,
        filename: args.filename,
        folder: folder,
        mediaType: args.mediaType || "image",
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        tags: args.tags || [],
      });

      return {
        success: true,
        cloudinaryUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
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
