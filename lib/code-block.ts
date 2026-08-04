const LANGUAGE_LABELS: Record<string, string> = {
  bash: "SHELL",
  css: "CSS",
  html: "HTML",
  javascript: "JAVASCRIPT",
  js: "JAVASCRIPT",
  json: "JSON",
  jsx: "JSX",
  markdown: "MARKDOWN",
  md: "MARKDOWN",
  powershell: "POWERSHELL",
  shell: "SHELL",
  sh: "SHELL",
  text: "TEXT",
  ts: "TYPESCRIPT",
  tsx: "TSX",
  typescript: "TYPESCRIPT",
  yaml: "YAML",
  yml: "YAML",
};

export function getCodeLanguageLabel(className?: string) {
  const language = className
    ?.split(/\s+/u)
    .find((value) => value.startsWith("language-"))
    ?.slice("language-".length)
    .toLowerCase();

  if (!language) return "TEXT";
  return LANGUAGE_LABELS[language] ?? language.replaceAll("-", " ").toUpperCase();
}
