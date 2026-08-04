import Image from "next/image";
import type { ContentCoverDescriptor } from "@/lib/content/cover";

export function ContentCover({
  cover,
  kind,
}: {
  cover: ContentCoverDescriptor;
  kind: "Article" | "Project" | "TIL";
}) {
  return (
    <figure className="content-cover">
      <figcaption className="content-cover-rail">
        <span>Visual artifact</span>
        <strong>{kind} / Cover</strong>
        <span>
          {cover.width} × {cover.height} px
        </span>
      </figcaption>
      <div className="content-cover-frame">
        <Image
          alt={cover.alt}
          height={cover.height}
          sizes="(max-width: 42rem) calc(100vw - 2rem), (max-width: 64rem) calc(100vw - 5rem), 1280px"
          src={cover.src}
          width={cover.width}
        />
      </div>
    </figure>
  );
}
