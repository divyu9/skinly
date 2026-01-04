# Cloudinary Integration for Mockups Module

## Overview
The mockups-advanced module now uploads images to Cloudinary instead of Convex storage. Images are automatically converted to WebP format and served from Cloudinary's CDN for optimal performance.

## Features Implemented

### 1. Automatic WebP Conversion
- All uploaded mockup images are automatically converted to WebP format
- Quality is set to `auto:good` for optimal file size and quality balance
- Maximum dimensions limited to 2000x2000px (no upscaling)

### 2. CDN Delivery
- All mockup images are served from Cloudinary's global CDN
- Faster load times with automatic edge caching
- Optimized delivery based on user location

### 3. Backward Compatibility
- The system supports both legacy Convex storage and new Cloudinary URLs
- Existing mockups stored in Convex will continue to work
- New uploads automatically use Cloudinary

## Configuration

### Environment Variables
Add these to your `.env.local` file:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=dcpjatdxs
CLOUDINARY_API_KEY=425811419382789
CLOUDINARY_API_SECRET=9VAd1j2XhdTRUnaXKQpEh-JFqZQ
```

## Architecture Changes

### 1. Database Schema (`convex/schema.ts`)
The `mockups` table now includes:
- `cloudinaryUrl` (optional): The CDN URL for the WebP image
- `cloudinaryPublicId` (optional): Used for deletions
- `fileId` (optional): Legacy Convex storage ID

### 2. Cloudinary Helper (`convex/cloudinary.ts`)
New actions for Cloudinary operations:
- `uploadToCloudinary`: Uploads base64 image and returns Cloudinary URL
- `deleteFromCloudinary`: Deletes image from Cloudinary

### 3. Updated Mutations

#### `storeMockupAdvanced` ([convex/mockupsAdvanced.ts](convex/mockupsAdvanced.ts:16))
Now accepts:
- `cloudinaryUrl`: The Cloudinary CDN URL
- `cloudinaryPublicId`: For deletion operations
- Removed: `fileId` (no longer needed for new uploads)

#### `deleteMockup` ([convex/mockupsAdvanced.ts](convex/mockupsAdvanced.ts:325))
Enhanced to handle both:
- Cloudinary deletions (if `cloudinaryPublicId` exists)
- Legacy Convex storage deletions (if `fileId` exists)

### 4. Updated Queries

#### `getMockupFileId` ([convex/mockups.ts](convex/mockups.ts:30))
Returns URLs with priority:
1. Cloudinary URL (if available) - **WebP, optimized**
2. Convex storage URL (legacy fallback)

#### `getBatchMockups` ([convex/mockups.ts](convex/mockups.ts:544))
Updated to prioritize Cloudinary URLs for batch fetching

## Upload Flow

### Frontend ([src/pages/admin/mockups-advanced.tsx](src/pages/admin/mockups-advanced.tsx:310))

1. User selects images through file input
2. For each image:
   - Convert to base64
   - Upload to Cloudinary (automatic WebP conversion)
   - Store mockup record with Cloudinary URL
   - Track upload progress

```typescript
// Upload to Cloudinary
const cloudinaryResult = await uploadToCloudinary({
  imageBase64: base64,
  folder: `mockups/${brandName}/${modelName}`,
  publicId: sku,
});

// Store mockup with Cloudinary URL
await storeMockup({
  brand: brandName,
  model: modelName,
  sku,
  cloudinaryUrl: cloudinaryResult.cloudinaryUrl,
  cloudinaryPublicId: cloudinaryResult.publicId,
  supportedModelId: modelId,
});
```

## Cloudinary Folder Structure

```
mockups/
├── Apple/
│   ├── iPhone 15 Pro/
│   │   ├── L-01.webp
│   │   ├── M-174.webp
│   │   └── ...
│   └── iPhone 14/
│       └── ...
├── Samsung/
│   └── Galaxy S24/
│       └── ...
└── ...
```

## Benefits

### Performance
- **Faster Loading**: Global CDN with edge caching
- **Smaller Files**: WebP format (typically 25-35% smaller than JPEG)
- **Automatic Optimization**: Quality and format optimization

### Scalability
- **No Convex Storage Limits**: Unlimited image storage through Cloudinary
- **Better Bandwidth**: Cloudinary handles all image delivery
- **Automatic Transformations**: On-the-fly image resizing and optimization

### Developer Experience
- **Simple API**: Base64 upload, get CDN URL back
- **Automatic Cleanup**: Deletion handled automatically
- **Legacy Support**: Existing images continue to work

## Testing

To test the integration:

1. Navigate to `/admin/mockups-advanced`
2. Select a model
3. Upload mockup images
4. Verify:
   - Images are converted to WebP
   - Cloudinary URLs are stored in database
   - Images load from Cloudinary CDN
   - Deletion removes from Cloudinary

## Monitoring

Check Cloudinary dashboard for:
- Storage usage
- Bandwidth usage
- Transformation usage
- CDN performance metrics

## Future Enhancements

Potential improvements:
- [ ] Add image variants (thumbnails, different sizes)
- [ ] Implement lazy loading placeholders
- [ ] Add watermarking for mockups
- [ ] Batch upload optimization
- [ ] Migration tool for legacy Convex images

## Troubleshooting

### Upload Failures
- Check Cloudinary credentials in `.env.local`
- Verify file size limits (Cloudinary free tier: 10MB)
- Check browser console for detailed errors

### Images Not Loading
- Verify `cloudinaryUrl` is stored in database
- Check Cloudinary dashboard for delivery stats
- Ensure public access is enabled on Cloudinary account

### Legacy Images
- Old images with only `fileId` will continue to work
- They will be served from Convex storage
- Consider migrating to Cloudinary for better performance
