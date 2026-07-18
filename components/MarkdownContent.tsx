import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  a({ href, children, ...props }) {
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
  table({ children, ...props }) {
    return (
      <div className="table-scroll" role="region" aria-label="可横向滚动的表格" tabIndex={0}>
        <table {...props}>{children}</table>
      </div>
    );
  },
};

export function MarkdownContent({ source }: { source: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        components={markdownComponents}
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
