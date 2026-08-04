import Image from "next/image";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Children, isValidElement } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import { getCodeLanguageLabel } from "@/lib/code-block";
import {
  getMarkdownContentImages,
  type ContentImageDescriptor,
} from "@/lib/content/media";

const CONTENT_IMAGE_SIZES =
  "(max-width: 42rem) calc(100vw - 2rem), (max-width: 55rem) 90vw, 48rem";

function createMarkdownComponents(
  localImages: Record<string, ContentImageDescriptor>,
): Components {
  return {
    a({ href, children, title }) {
      const external = href?.startsWith("https://") || href?.startsWith("http://");
      return (
        <a
          href={href}
          rel={external ? "noreferrer" : undefined}
          target={external ? "_blank" : undefined}
          title={title}
        >
          {children}
        </a>
      );
    },
    img({ src, alt, title }) {
      if (typeof src !== "string") return null;
      const localImage = localImages[src];

      if (localImage) {
        return (
          <Image
            alt={alt ?? ""}
            className="markdown-image markdown-image-local"
            height={localImage.height}
            sizes={CONTENT_IMAGE_SIZES}
            src={localImage.src}
            title={title}
            width={localImage.width}
          />
        );
      }

      return (
        // External hosts are intentionally not added to Next Image's optimizer
        // allowlist because author-controlled Markdown may reference any HTTPS host.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={alt ?? ""}
          className="markdown-image markdown-image-external"
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={src}
          title={title}
        />
      );
    },
    pre({ children }) {
      const codeElement = Children.toArray(children).find(isValidElement);
      const className = isValidElement<{ className?: string }>(codeElement)
        ? codeElement.props.className
        : undefined;

      return (
        <CodeBlock language={getCodeLanguageLabel(className)}>{children}</CodeBlock>
      );
    },
    table({ children }) {
      return (
        <div
          className="table-scroll"
          role="region"
          aria-label="可横向滚动的表格"
          tabIndex={0}
        >
          <table>{children}</table>
        </div>
      );
    },
  };
}

export async function MarkdownContent({
  source,
  sourcePath,
}: {
  source: string;
  sourcePath: string;
}) {
  const localImages = await getMarkdownContentImages(source, sourcePath);
  return (
    <div className="markdown-content">
      <ReactMarkdown
        components={createMarkdownComponents(localImages)}
        rehypePlugins={[
          rehypeSlug,
          [rehypeHighlight, { detect: false, ignoreMissing: true }],
        ]}
        remarkPlugins={[remarkGfm]}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
