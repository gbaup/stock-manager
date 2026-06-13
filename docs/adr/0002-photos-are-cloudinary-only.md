# Photos are Cloudinary-only

Every `Photo` is stored in Cloudinary and represented in the codebase as `{ url, publicId }`. The legacy representation — base64 data URIs stored inline in the `CatalogProduct.photos` JSON column — is migrated out one-time and not supported going forward. The `Photo` type does not encode an "origin" or "kind"; there is only one kind.

This was a real fork: the alternative was a discriminated union (`{ kind: 'cloudinary' | 'base64' }`) that permanently supported both. We chose Cloudinary-only because the runtime branch (`url.startsWith('https://')` at `photo-gallery.tsx:35`) was a symptom of the type system carrying a distinction the business does not want — the goal has always been to migrate off base64, and keeping it in the type would make the deletion contract (Cloudinary delete on unlink) impossible to express cleanly.

Future readers should not reintroduce base64 fallbacks "for offline support" or similar. If a new storage backend is needed, swap Cloudinary out behind the existing `Photo` type rather than adding a parallel kind.
