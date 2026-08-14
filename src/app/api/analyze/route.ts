import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("image");
  const prompt = formData.get("prompt");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file was uploaded." }, { status: 400 });
  }

  if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type "${file.type}". Use JPEG, PNG, GIF, or WebP.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Maximum size is 5MB." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString("base64");

  const userPrompt =
    typeof prompt === "string" && prompt.trim().length > 0
      ? prompt.trim()
      : "Describe what's in this image in detail.";

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system:
        "Format every response as Markdown (headings, bold, bullet or numbered lists, tables where useful) so it renders cleanly in a Markdown viewer.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: file.type as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: base64Data,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");

    if (response.stop_reason === "refusal" || !textBlock) {
      return NextResponse.json(
        { error: "Claude declined to analyze this image." },
        { status: 422 },
      );
    }

    return NextResponse.json({ result: textBlock.text });
  } catch (error) {
    console.error("Anthropic API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error calling Claude.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
