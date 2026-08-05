export const MARKDOWN_FOOTNOTE_CLOBBER_PREFIX = "note-";
export const MARKDOWN_FOOTNOTE_HEADING_CLASS = "footnote-heading";
export const MARKDOWN_FOOTNOTE_LABEL = "注释与来源";

export function getMarkdownFootnoteBackLabel(
  referenceIndex: number,
  rereferenceIndex: number,
) {
  const label = `返回正文中的注释 ${referenceIndex + 1}`;
  return rereferenceIndex > 1
    ? `${label}（第 ${rereferenceIndex} 处）`
    : label;
}
