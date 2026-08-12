import Image from "next/image";
import ReactMarkdown, { type Components } from "react-markdown";
import "katex/dist/katex.min.css";
import { Children, isValidElement } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import { MarkdownHeading } from "@/components/MarkdownHeading";
import { getCodeLanguageLabel } from "@/lib/code-block";
import {
  MARKDOWN_FOOTNOTE_HEADING_CLASS,
} from "@/lib/markdown-footnote";
import {
  MARKDOWN_REHYPE_OPTIONS,
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS,
  transformMarkdownUrl,
} from "@/lib/markdown-pipeline";
import {
  getMarkdownContentImages,
  type ContentImageDescriptor,
} from "@/lib/content/media";

const CONTENT_IMAGE_SIZES =
  "(max-width: 42rem) calc(100vw - 2rem), (max-width: 55rem) 90vw, 48rem";
const GALLERY_IMAGE_SIZES =
  "(max-width: 42rem) calc(100vw - 3.5rem), (max-width: 55rem) 44vw, 23rem";

function createMarkdownComponents(
  localImages: Record<string, ContentImageDescriptor>,
): Components {
  return {
    a({ href, children, node, ...props }) {
      void node;
      const external = href?.startsWith("https://") || href?.startsWith("http://");
      return (
        <a
          {...props}
          href={href}
          rel={external ? "noreferrer" : undefined}
          target={external ? "_blank" : undefined}
        >
          {children}
        </a>
      );
    },
    h2({ children, className, id, node, ...props }) {
      void node;
      if (
        id === "footnote-label" &&
        className?.split(/\s+/u).includes(MARKDOWN_FOOTNOTE_HEADING_CLASS)
      ) {
        return (
          <h2 {...props} className={className} id={id}>
            {children}
          </h2>
        );
      }
      return (
        <MarkdownHeading id={id} level={2}>
          {children}
        </MarkdownHeading>
      );
    },
    h3({ children, id }) {
      return (
        <MarkdownHeading id={id} level={3}>
          {children}
        </MarkdownHeading>
      );
    },
    img({ src, alt, className, title }) {
      if (typeof src !== "string") return null;
      const localImage = localImages[src];
      const galleryImage = className?.split(/\s+/u).includes("markdown-gallery-image");
      const imageClassName = [
        "markdown-image",
        localImage ? "markdown-image-local" : "markdown-image-external",
        ...(className?.split(/\s+/u).filter(Boolean) ?? []),
      ].join(" ");

      if (localImage) {
        return (
          <Image
            alt={alt ?? ""}
            className={imageClassName}
            height={localImage.height}
            sizes={galleryImage ? GALLERY_IMAGE_SIZES : CONTENT_IMAGE_SIZES}
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
          className={imageClassName}
          decoding="async"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={src}
          title={title}
        />
      );
    },
    pre({ children, className: preClassName, node, ...props }) {
      void node;
      if (
        preClassName?.split(/\s+/u).some((className) =>
          className === "markdown-codechange-pre" || className === "markdown-http-pre"
        )
      ) {
        return <pre {...props} className={preClassName}>{children}</pre>;
      }
      const codeElement = Children.toArray(children).find(isValidElement);
      const codeClassName = isValidElement<{ className?: string }>(codeElement)
        ? codeElement.props.className
        : undefined;

      return (
        <CodeBlock language={getCodeLanguageLabel(codeClassName)}>{children}</CodeBlock>
      );
    },
    span({ children, className, node, ...props }) {
      void node;
      if (className?.split(/\s+/u).includes("katex-display")) {
        return (
          <span
            {...props}
            aria-label="数学公式，可横向滚动"
            className={className}
            role="region"
            tabIndex={0}
          >
            {children}
          </span>
        );
      }
      return (
        <span {...props} className={className}>
          {children}
        </span>
      );
    },
    table({ children, className, node, ...props }) {
      void node;
      if (className?.split(/\s+/u).includes("markdown-data-table-grid")) {
        return (
          <table {...props} className={className}>
            {children}
          </table>
        );
      }
      return (
        <div
          className="table-scroll"
          role="region"
          aria-label="可横向滚动的表格"
          tabIndex={0}
        >
          <table {...props} className={className}>{children}</table>
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
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
        remarkRehypeOptions={MARKDOWN_REHYPE_OPTIONS}
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        urlTransform={transformMarkdownUrl}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
