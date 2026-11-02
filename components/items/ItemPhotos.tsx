"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addPhotosAction } from "@/app/actions/photos";
import { seenText } from "@/components/shared/Thumb";
import type { Inspection } from "@/lib/items/inspect";

const draw = (source: CanvasImageSource, w: number, h: number, max: number) => {
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
};

// A photo, shrunk in the browser.
async function fromPhoto(file: File, max: number) {
  const bitmap = await createImageBitmap(file);
  return draw(bitmap, bitmap.width, bitmap.height, max);
}

// Three frames from a short video. The video itself is never uploaded.
async function fromVideo(file: File, max: number) {
  const video = document.createElement("video");
  video.muted = true;
  video.src = URL.createObjectURL(file);
  await new Promise((ok) => (video.onloadeddata = ok));
  const frames: string[] = [];
  for (const at of [0.2, 0.5, 0.8]) {
    video.currentTime = video.duration * at;
    await new Promise((ok) => (video.onseeked = ok));
    frames.push(draw(video, video.videoWidth, video.videoHeight, max));
  }
  URL.revokeObjectURL(video.src);
  return frames;
}

// The owner's photos, what their agent saw in them, and a way to add more or show it working.
export function ItemPhotos({ itemId, photos, inspection }: { itemId: string; photos: string[]; inspection: Inspection | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const upload = (files: FileList | null, video: boolean) => {
    if (!files?.length) return;
    setError(null);
    start(async () => {
      const list = [...files].slice(0, 4);
      const [checks, thumbs] = video
        ? await Promise.all([fromVideo(list[0], 1024), fromVideo(list[0], 320)])
        : await Promise.all([Promise.all(list.map((f) => fromPhoto(f, 1024))), Promise.all(list.map((f) => fromPhoto(f, 320)))]);
      setError(await addPhotosAction(itemId, checks, video ? thumbs.slice(1, 2) : thumbs, video));
    });
  };

  const seen = seenText(inspection);
  const askWorking = inspection?.needsWorking && !inspection.workingShown;
  return (
    <div className="mt-3 text-sm">
      {photos.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photos.map((src) => <img key={src.slice(-40)} src={src} alt="" className="size-24 shrink-0 rounded-xl object-cover" />)}
        </div>
      )}
      {seen && <p className={inspection?.matches ? "text-muted-foreground" : "text-destructive"}>{seen}</p>}
      {inspection?.ask && <p className="text-muted-foreground">Your agent asks: {inspection.ask}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" loading={pending} onClick={() => photoInput.current?.click()}><Camera />{photos.length ? "Add photos" : "Add a photo"}</Button>
        {askWorking && <Button size="sm" variant="outline" loading={pending} onClick={() => videoInput.current?.click()}><Video />Show it working</Button>}
      </div>
      {pending && <p className="mt-1 text-muted-foreground">Your agent is looking at it…</p>}
      {error && <p className="mt-1 text-destructive">{error}</p>}
      <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files, false)} />
      <input ref={videoInput} type="file" accept="video/*,image/*" hidden onChange={(e) => upload(e.target.files, e.target.files?.[0]?.type.startsWith("video") ?? false)} />
    </div>
  );
}
