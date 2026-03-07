import { Response } from "express";
import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

const STORAGE_BUCKET = "uploads";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  // Gets a signed upload URL for a new object.
  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; objectPath: string }> {
    const supabase = getSupabaseAdmin();
    const objectId = randomUUID();
    const storagePath = `uploads/${objectId}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(`Failed to create upload URL: ${error?.message || 'Unknown error'}`);
    }

    return {
      uploadURL: data.signedUrl,
      objectPath: `/objects/${storagePath}`,
    };
  }

  // Returns a signed URL for the given storage path.
  async getSignedUrl(storagePath: string): Promise<string> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    if (error || !data?.signedUrl) {
      throw new ObjectNotFoundError();
    }

    return data.signedUrl;
  }

  // Creates a signed URL and redirects the browser to Supabase storage.
  // This supports HTTP Range requests (needed for video playback/seeking).
  async serveObject(storagePath: string, res: Response) {
    const url = await this.getSignedUrl(storagePath);
    res.redirect(url);
  }

  // Resolves an object path (e.g. "/objects/uploads/uuid") to the Supabase storage path.
  resolveStoragePath(objectPath: string): string {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const storagePath = objectPath.slice("/objects/".length);
    // Block path traversal attempts
    if (storagePath.includes('..') || storagePath.includes('\0')) {
      throw new ObjectNotFoundError();
    }
    return storagePath;
  }

  // Normalizes a raw path (which may be a full URL or storage path) to the /objects/ format.
  normalizeObjectEntityPath(rawPath: string): string {
    // If it's already in our normalized format, return as-is
    if (rawPath.startsWith("/objects/")) {
      return rawPath;
    }

    // If it's a Supabase storage URL, extract the path
    try {
      const url = new URL(rawPath);
      // Supabase storage URLs contain /storage/v1/object/ in the path
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/(.+)/);
      if (match) {
        return `/objects/${match[1]}`;
      }
    } catch {
      // Not a URL, treat as a direct path
    }

    return rawPath;
  }
}
