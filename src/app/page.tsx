"use client";

import { useState, useRef, useEffect, ChangeEvent, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DEFAULT_PROMPT = "Describe what's in this image in detail.";
const PROMPT_STORAGE_KEY = "image-analyzer:prompt";

export default function Home() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [promptTab, setPromptTab] = useState<"write" | "preview">("write");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore the prompt from localStorage once the page (re)loads in the browser.
  // Both state updates below are batched into the same render, so the persist
  // effect below never fires with a stale (pre-restore) prompt value.
  useEffect(() => {
    const stored = window.localStorage.getItem(PROMPT_STORAGE_KEY);
    if (stored !== null) setPrompt(stored);
    setIsHydrated(true);
  }, []);

  // Persist every edit, but not before the stored value has been restored above.
  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
  }, [prompt, isHydrated]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setResult(null);
    setError(null);

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Please choose an image first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("prompt", prompt);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }

      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-12 font-sans">
      <main className="flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Image Analyzer
          </h1>
          <p className="text-zinc-600">
            Upload an image, write a prompt in Markdown, and get a formatted response from Claude.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Prompt: write / preview markdown */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">Prompt (Markdown)</label>
              <div className="flex overflow-hidden rounded-md border border-zinc-300 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPromptTab("write")}
                  className={`px-3 py-1.5 transition-colors ${promptTab === "write"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-100"
                    }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setPromptTab("preview")}
                  className={`px-3 py-1.5 transition-colors ${promptTab === "preview"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-100"
                    }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {promptTab === "write" ? (
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Ask something about the image using **Markdown**…"
                className="rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
              />
            ) : (
              <div className="h-80 overflow-y-auto rounded-lg border border-zinc-300 bg-white p-3">
                {prompt.trim() ? (
                  <article className="prose prose-sm prose-zinc max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{prompt}</ReactMarkdown>
                  </article>
                ) : (
                  <p className="text-sm text-zinc-400">Nothing to preview yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Response (left) + image upload (right) */}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            <div className="flex flex-col gap-2 md:order-1">
              <span className="text-sm font-medium text-zinc-700">Image</span>
              <label
                htmlFor="image-upload"
                className="flex min-h-80 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-white p-6 text-center transition-colors hover:border-zinc-400"
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Selected preview"
                    className="max-h-72 rounded-lg object-contain"
                  />
                ) : (
                  <span className="text-sm text-zinc-500">
                    Click to choose an image (JPEG, PNG, GIF, or WebP — max 5MB)
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  id="image-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 md:order-2">
              <span className="text-sm font-medium text-zinc-700">Response</span>
              <div className="flex  h-100 overflow-auto flex-col rounded-xl border border-zinc-200 bg-white p-4">
                {loading ? (
                  <p className="text-sm text-zinc-400">Analyzing…</p>
                ) : result ? (
                  <article className="prose prose-sm prose-zinc max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                  </article>
                ) : (
                  <p className="text-sm text-zinc-400">
                    The response will appear here after you analyze an image.
                  </p>
                )}
              </div>
            </div>

          </div>

          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze image"}
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
