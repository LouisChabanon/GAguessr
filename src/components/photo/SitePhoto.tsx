"use client";

import Image, { getImageProps } from "next/image";
import { useRef } from "react";
import { preload } from "react-dom";
import type { TargetPhoto } from "@/modes/types";

const THUMB_SIZES = "(min-width: 640px) 112px, 80px";
const FULL_SIZES = "(min-width: 832px) 800px, 92vw";

interface SitePhotoProps {
  name: string;
  photo: TargetPhoto | undefined;
}

/** Thumbnail of the site to find; opens the full photo with its credits. */
export function SitePhoto({ name, photo }: SitePhotoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (!photo) {
    return (
      <span
        role="img"
        aria-label="Aucune photo libre de ce site"
        title="Aucune photo libre de droits de ce site"
        data-testid="site-photo-missing"
        className="photo-placeholder grid h-15 w-20 shrink-0 place-items-center rounded-lg border border-line text-muted sm:h-21 sm:w-28"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="4" y="9" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={`Agrandir la photo : ${name}`}
        title={`Photo : ${photo.author} (${photo.license})`}
        data-testid="site-photo"
        className="group relative h-15 w-20 shrink-0 overflow-hidden rounded-lg bg-line sm:h-21 sm:w-28"
      >
        <Image
          src={photo.src}
          alt=""
          width={photo.width}
          height={photo.height}
          sizes={THUMB_SIZES}
          priority
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-md bg-ink/60 text-surface" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M7 1h4v4M5 11H1V7M11 1 7 5M1 11l4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label={name}
        // Clicking the backdrop (the dialog element itself, outside the figure) closes it.
        onClick={(event) => event.target === event.currentTarget && event.currentTarget.close()}
        className="photo-dialog m-auto w-[min(800px,92vw)] overflow-visible bg-transparent p-0"
      >
        <figure className="overflow-hidden rounded-2xl border border-line bg-panel-solid shadow-pop">
          <Image
            src={photo.src}
            alt={`Photo : ${name}`}
            width={photo.width}
            height={photo.height}
            sizes={FULL_SIZES}
            className="max-h-[75dvh] w-full bg-line object-contain"
          />
          <figcaption className="flex items-start justify-between gap-4 px-4 py-3 text-xs text-muted">
            <PhotoCredit photo={photo} />
            <form method="dialog">
              <button type="submit" className="font-medium text-ink hover:text-accent-text" autoFocus>
                Fermer
              </button>
            </form>
          </figcaption>
        </figure>
      </dialog>
    </>
  );
}

export function PhotoCredit({ photo }: { photo: TargetPhoto }) {
  return (
    <span>
      Photo : {photo.author} ·{" "}
      {photo.licenseUrl ? (
        <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
          {photo.license}
        </a>
      ) : (
        photo.license
      )}{" "}
      ·{" "}
      <a href={photo.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
        Wikimedia Commons
      </a>
    </span>
  );
}

/** Starts downloading the next site's thumbnail so it appears instantly. */
export function preloadPhoto(photo: TargetPhoto | undefined): void {
  if (!photo) return;
  const { props } = getImageProps({ src: photo.src, alt: "", width: photo.width, height: photo.height, sizes: THUMB_SIZES });
  preload(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "low" });
}
