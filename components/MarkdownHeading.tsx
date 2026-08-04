import type { ReactNode } from "react";
import {
  getHeadingDepthMarker,
  getHeadingPermalink,
  type PermalinkHeadingLevel,
} from "@/lib/heading-permalink";

export function MarkdownHeading({
  children,
  id,
  level,
}: {
  children: ReactNode;
  id?: string;
  level: PermalinkHeadingLevel;
}) {
  const Heading = `h${level}` as const;

  return (
    <Heading id={id}>
      {children}
      {id ? (
        <a
          aria-label="本节永久链接"
          className="heading-permalink"
          href={getHeadingPermalink(id)}
        >
          <span aria-hidden="true">{getHeadingDepthMarker(level)}</span>
        </a>
      ) : null}
    </Heading>
  );
}
