export type SubscriptionChannelId =
  | "rss"
  | "opml"
  | "json-feed"
  | "opensearch"
  | "manifest"
  | "markdown";

export interface SubscriptionChannelLink {
  href: string;
  label: string;
}

export interface SubscriptionChannel {
  id: SubscriptionChannelId;
  audience: string;
  title: string;
  description: string;
  format: string;
  freshness: string;
  pathLabel: string;
  links: SubscriptionChannelLink[];
  statusNote?: string;
}

interface PortableSourceRecord {
  publishedAt: string;
  title: string;
  url: string;
}

const ROUTE_FRESHNESS = "1 HOUR FRESH / 24 HOUR SWR";

const staticChannels: SubscriptionChannel[] = [
  {
    id: "rss",
    audience: "阅读器",
    title: "订阅公开更新",
    description:
      "适合 Feedly、Inoreader 与其他 RSS 2.0 阅读器；按发布时间输出文章、TIL 与项目。",
    format: "application/rss+xml",
    freshness: ROUTE_FRESHNESS,
    pathLabel: "/rss.xml",
    links: [{ href: "/rss.xml", label: "打开 RSS" }],
  },
  {
    id: "opml",
    audience: "阅读器迁移",
    title: "一次导入全部订阅",
    description:
      "把全站、全部公开标签与全部公开专题 RSS 分组导入支持 OPML 2.0 的阅读器。",
    format: "text/x-opml",
    freshness: ROUTE_FRESHNESS,
    pathLabel: "/feeds.opml",
    links: [{ href: "/feeds.opml", label: "下载 OPML" }],
  },
  {
    id: "json-feed",
    audience: "JSON READER",
    title: "用结构化全文订阅",
    description:
      "为支持 JSON Feed 1.1 的客户端提供标题、摘要、正文纯文本、时间与标签。",
    format: "application/feed+json",
    freshness: ROUTE_FRESHNESS,
    pathLabel: "/feed.json",
    links: [{ href: "/feed.json", label: "打开 JSON Feed" }],
  },
  {
    id: "opensearch",
    audience: "浏览器 / 搜索工具",
    title: "读取站内搜索描述",
    description:
      "让支持 OpenSearch 的客户端读取查询模板；能否直接安装为搜索引擎取决于客户端支持。",
    format: "application/opensearchdescription+xml",
    freshness: ROUTE_FRESHNESS,
    pathLabel: "/opensearch.xml",
    links: [{ href: "/opensearch.xml", label: "查看搜索描述" }],
  },
  {
    id: "manifest",
    audience: "同步器 / 自动化",
    title: "发现内容并验证版本",
    description:
      "先读取公开内容清单发现全部记录，再用配套 JSON Schema 校验字段与版本。",
    format: "application/json + schema",
    freshness: ROUTE_FRESHNESS,
    pathLabel: "/content.json + /content.schema.json",
    links: [
      { href: "/content.json", label: "打开内容清单" },
      { href: "/content.schema.json", label: "查看清单 Schema" },
    ],
  },
];

function newestRecord(records: readonly PortableSourceRecord[]) {
  return records.slice().sort(
    (left, right) =>
      right.publishedAt.localeCompare(left.publishedAt) ||
      left.title.localeCompare(right.title, "zh-CN") ||
      left.url.localeCompare(right.url, "en"),
  )[0];
}

export function createSubscriptionCatalog(
  records: readonly PortableSourceRecord[],
): SubscriptionChannel[] {
  const latest = newestRecord(records);
  const markdown: SubscriptionChannel = {
    id: "markdown",
    audience: "OBSIDIAN / 引用工具",
    title: "读取单篇可移植 Markdown",
    description:
      "每条公开内容都保留可直接下载的 Markdown；适合引用、离线阅读或导入自己的知识库。",
    format: "text/markdown; charset=utf-8",
    freshness: ROUTE_FRESHNESS,
    pathLabel: "/posts|projects/<slug>/source.md",
    links: latest
      ? [
          {
            href: `${latest.url}/source.md`,
            label: `查看最新：${latest.title}`,
          },
        ]
      : [],
    statusNote: latest
      ? `当前示例来自 ${latest.publishedAt} 的最新公开记录。`
      : "发布第一条公开内容后，这里会出现可读取的 Markdown 示例。",
  };

  return [
    ...staticChannels.map((channel) => ({
      ...channel,
      links: channel.links.map((link) => ({ ...link })),
    })),
    markdown,
  ];
}
