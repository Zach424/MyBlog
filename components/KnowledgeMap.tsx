import Link from "next/link";

import type {
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "@/lib/content";
import { getContentDatePresentation } from "@/lib/content-presentation";

const MAP_WIDTH = 1200;
const NODE_WIDTH = 360;
const NODE_HEIGHT = 112;
const MAP_PADDING_Y = 76;
const POST_X = 70;
const PROJECT_X = MAP_WIDTH - 70 - NODE_WIDTH;

type PositionedNode = KnowledgeGraphNode & {
  x: number;
  y: number;
};

function positionColumn(
  nodes: KnowledgeGraphNode[],
  x: number,
  height: number,
): PositionedNode[] {
  if (nodes.length === 1) {
    return [{ ...nodes[0], x, y: (height - NODE_HEIGHT) / 2 }];
  }
  const available = height - MAP_PADDING_Y * 2 - NODE_HEIGHT;
  const step = nodes.length > 1 ? available / (nodes.length - 1) : 0;
  return nodes.map((node, index) => ({
    ...node,
    x,
    y: MAP_PADDING_Y + index * step,
  }));
}

function splitTitle(value: string, lineLength = 19) {
  const characters = Array.from(value);
  if (characters.length <= lineLength) return [value];
  const first = characters.slice(0, lineLength).join("");
  const remaining = characters.slice(lineLength);
  const truncated = remaining.length > lineLength;
  const second = remaining
    .slice(0, truncated ? lineLength - 1 : lineLength)
    .join("");
  return [first, `${second}${truncated ? "…" : ""}`];
}

function edgePath(
  edge: KnowledgeGraphEdge,
  index: number,
  nodeByUrl: ReadonlyMap<string, PositionedNode>,
  reciprocalEdges: ReadonlySet<string>,
) {
  const source = nodeByUrl.get(edge.source);
  const target = nodeByUrl.get(edge.target);
  if (!source || !target) return "";

  const sourceY = source.y + NODE_HEIGHT / 2;
  const targetY = target.y + NODE_HEIGHT / 2;
  const sameColumn = source.x === target.x;
  if (sameColumn) {
    const isPostColumn = source.x === POST_X;
    const sourceX = isPostColumn ? source.x : source.x + NODE_WIDTH;
    const targetX = isPostColumn ? target.x : target.x + NODE_WIDTH;
    const gutterOffset = 24 + (index % 3) * 13;
    const gutterX = isPostColumn ? source.x - gutterOffset : source.x + NODE_WIDTH + gutterOffset;
    return `M ${sourceX} ${sourceY} C ${gutterX} ${sourceY}, ${gutterX} ${targetY}, ${targetX} ${targetY}`;
  }

  const sourceOnLeft = source.x < target.x;
  const sourceX = sourceOnLeft ? source.x + NODE_WIDTH : source.x;
  const targetX = sourceOnLeft ? target.x : target.x + NODE_WIDTH;
  const middleX = (sourceX + targetX) / 2;
  const reciprocalKey = `${edge.target}→${edge.source}`;
  const curve = reciprocalEdges.has(reciprocalKey)
    ? edge.source.localeCompare(edge.target, "en") < 0
      ? -34
      : 34
    : 0;
  return `M ${sourceX} ${sourceY} C ${middleX} ${sourceY + curve}, ${middleX} ${targetY + curve}, ${targetX} ${targetY}`;
}

function nodeType(node: KnowledgeGraphNode) {
  return node.kind === "post" ? "POST" : "PROJECT";
}

export function KnowledgeMapField({ graph }: { graph: KnowledgeGraph }) {
  if (graph.nodes.length === 0) {
    return (
      <div className="knowledge-empty">
        <strong>还没有可以绘制的公开记录。</strong>
        <p>发布第一篇文章或项目后，知识地图会从正文链接自动生成。</p>
      </div>
    );
  }

  const posts = graph.nodes.filter((node) => node.kind === "post");
  const projects = graph.nodes.filter((node) => node.kind === "project");
  const height = Math.max(500, Math.max(posts.length, projects.length, 1) * 150 + 140);
  const positioned = [
    ...positionColumn(posts, POST_X, height),
    ...positionColumn(projects, PROJECT_X, height),
  ];
  const nodeByUrl = new Map(positioned.map((node) => [node.url, node]));
  const edgeKeys = new Set(graph.edges.map((edge) => `${edge.source}→${edge.target}`));

  return (
    <figure className="knowledge-map-frame">
      <div className="knowledge-map-columns" aria-hidden="true">
        <span>POSTS / SOURCE NOTES</span>
        <span>PROJECTS / APPLIED WORK</span>
      </div>
      <div className="knowledge-map-scroll">
        <svg
          className="knowledge-map-field"
          viewBox={`0 0 ${MAP_WIDTH} ${height}`}
          role="group"
          aria-labelledby="knowledge-map-svg-title knowledge-map-svg-description"
        >
          <title id="knowledge-map-svg-title">公开内容关系图</title>
          <desc id="knowledge-map-svg-description">
            文章位于左侧，项目位于右侧；带箭头的连线表示正文从来源记录引用目标记录。
          </desc>
          <defs>
            <marker
              id="knowledge-arrow-post"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="knowledge-arrow-post" />
            </marker>
            <marker
              id="knowledge-arrow-project"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" className="knowledge-arrow-project" />
            </marker>
          </defs>
          <line
            className="knowledge-map-bus"
            x1={MAP_WIDTH / 2}
            x2={MAP_WIDTH / 2}
            y1="36"
            y2={height - 36}
            aria-hidden="true"
          />
          {graph.edges.map((edge, index) => {
            const source = nodeByUrl.get(edge.source);
            return (
              <path
                aria-hidden="true"
                className={`knowledge-edge knowledge-edge-${source?.kind ?? "post"}`}
                d={edgePath(edge, index, nodeByUrl, edgeKeys)}
                key={`${edge.source}-${edge.target}`}
                markerEnd={`url(#knowledge-arrow-${source?.kind ?? "post"})`}
                pathLength="1"
              />
            );
          })}
          {positioned.map((node) => {
            const lines = splitTitle(node.title);
            const contentDate = getContentDatePresentation(node);
            return (
              <a
                aria-label={`打开${node.kind === "post" ? "文章" : "项目"}：${node.title}`}
                className={`knowledge-node knowledge-node-${node.kind}${node.isolated ? " knowledge-node-isolated" : ""}`}
                href={node.url}
                key={node.url}
              >
                <title>{`${node.title}；向外 ${node.outgoing.length}，向内 ${node.backlinks.length}`}</title>
                <rect
                  className="knowledge-node-card"
                  height={NODE_HEIGHT}
                  width={NODE_WIDTH}
                  x={node.x}
                  y={node.y}
                />
                <text className="knowledge-node-type" x={node.x + 18} y={node.y + 22}>
                  {`${nodeType(node)} / ${contentDate.label} / ${contentDate.date}`}
                </text>
                <text
                  className="knowledge-node-count"
                  textAnchor="end"
                  x={node.x + NODE_WIDTH - 18}
                  y={node.y + 22}
                >
                  OUT {node.outgoing.length} / IN {node.backlinks.length}
                </text>
                <text className="knowledge-node-title" x={node.x + 18} y={node.y + 57}>
                  {lines.map((line, index) => (
                    <tspan dy={index === 0 ? 0 : 24} key={line} x={node.x + 18}>
                      {line}
                    </tspan>
                  ))}
                </text>
                <circle
                  className="knowledge-node-port"
                  cx={node.kind === "post" ? node.x + NODE_WIDTH : node.x}
                  cy={node.y + NODE_HEIGHT / 2}
                  r="5"
                />
              </a>
            );
          })}
        </svg>
      </div>
      <figcaption>
        箭头读取方向为“来源正文引用目标”。互相引用会绘制两条分轨信号；虚线节点当前没有站内关系。
      </figcaption>
    </figure>
  );
}

export function KnowledgeRelationLedger({ graph }: { graph: KnowledgeGraph }) {
  const nodeByUrl = new Map(graph.nodes.map((node) => [node.url, node]));

  return (
    <section className="knowledge-ledger" aria-labelledby="knowledge-ledger-title">
      <header className="knowledge-section-heading">
        <div>
          <p className="section-label">Relationship ledger</p>
          <h2 id="knowledge-ledger-title">逐条读取引用方向</h2>
        </div>
        <p>这份清单与上方信号场使用同一批正文链接，不依赖 JavaScript、画布命中区或另一份人工索引。</p>
      </header>
      {graph.edges.length === 0 ? (
        <div className="knowledge-empty knowledge-empty-compact">
          <strong>公开记录还没有互相引用。</strong>
          <p>在正文中加入另一篇公开文章或项目的站内链接后，这里会自动形成第一条关系。</p>
        </div>
      ) : (
        <ol className="knowledge-edge-list">
          {graph.edges.map((edge, index) => {
            const source = nodeByUrl.get(edge.source);
            const target = nodeByUrl.get(edge.target);
            if (!source || !target) return null;
            return (
              <li key={`${edge.source}-${edge.target}`}>
                <span className="knowledge-edge-seq">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Link className="knowledge-edge-record" href={source.url}>
                  <small>{nodeType(source)}</small>
                  <strong>{source.title}</strong>
                </Link>
                <span className="knowledge-edge-direction">
                  <span aria-hidden="true">→</span>
                  <small>引用</small>
                </span>
                <Link className="knowledge-edge-record" href={target.url}>
                  <small>{nodeType(target)}</small>
                  <strong>{target.title}</strong>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function KnowledgeIsolatedRecords({ graph }: { graph: KnowledgeGraph }) {
  const isolated = graph.nodes.filter((node) => node.isolated);

  return (
    <section className="knowledge-isolated" aria-labelledby="knowledge-isolated-title">
      <header>
        <p className="section-label">Unlinked records</p>
        <h2 id="knowledge-isolated-title">尚未连线，不等于没有价值</h2>
        <p>孤立记录仍可独立阅读；这里把它们显式列出，方便后续补充真实相关的依据或实践，而不是为了图形密度制造链接。</p>
      </header>
      {isolated.length === 0 ? (
        <p className="knowledge-isolated-empty">当前每条公开记录都至少有一个站内关系。</p>
      ) : (
        <ul>
          {isolated.map((node) => {
            const contentDate = getContentDatePresentation(node);
            return (
              <li key={node.url}>
                <Link href={node.url}>
                  <span>{`${nodeType(node)} / ${contentDate.label} / ${contentDate.date}`}</span>
                  <strong>{node.title}</strong>
                  <small>{node.description}</small>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
