import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/app/lib/auth";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "jerseys", transformation: [{ width: 800, crop: "limit" }] },
          (error, result) => {
            if (error) reject(error);
            else if (!result?.secure_url) reject(new Error("Upload returned no URL"));
            else resolve(result as { secure_url: string; public_id: string });
          }
        )
        .end(buffer);
    });

    return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let publicId: string;
  try {
    const body = await req.json();
    publicId = body.publicId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!publicId || !publicId.startsWith("jerseys/")) {
    return NextResponse.json({ error: "Invalid publicId" }, { status: 400 });
  }

  await cloudinary.uploader.destroy(publicId);
  return NextResponse.json({ success: true });
}
