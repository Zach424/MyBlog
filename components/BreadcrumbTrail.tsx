import { Fragment } from "react";
import Link from "next/link";
import {
  createBreadcrumbList,
  type BreadcrumbTrailItem,
} from "@/lib/breadcrumbs";
import { StructuredData } from "@/components/StructuredData";

export function BreadcrumbTrail({
  items,
  siteUrl,
}: {
  items: readonly BreadcrumbTrailItem[];
  siteUrl: URL;
}) {
  return (
    <>
      <StructuredData data={createBreadcrumbList(siteUrl, items)} />
      <nav className="breadcrumbs" aria-label="面包屑">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={item.href}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {isCurrent ? (
                <span aria-current="page">{item.name}</span>
              ) : (
                <Link href={item.href}>{item.name}</Link>
              )}
            </Fragment>
          );
        })}
      </nav>
    </>
  );
}
