import Link from "next/link";
import type { ComponentProps } from "react";

export const usesStaticDocuments = process.env.NEXT_PUBLIC_STATIC_DOCUMENTS === "1";

export function siteDocumentHref(href: string) {
  if (!usesStaticDocuments || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://cd.invalid");
  return (url.pathname.endsWith("/") || /\.[A-Za-z0-9]+$/.test(url.pathname) && !/^\/(?:company|security)\//.test(url.pathname)
    ? url.pathname : url.pathname + "/") + url.search + url.hash;
}

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function SiteDocumentLink({ href, prefetch = false, replace, scroll, onNavigate, ...props }: Props) {
  if (!usesStaticDocuments) {
    return <Link href={href} prefetch={prefetch} replace={replace} scroll={scroll}
      {...(onNavigate && { onNavigate })} {...props} />;
  }
  return <a data-document-link={href.startsWith("/") && !href.startsWith("//") ? "" : undefined} href={siteDocumentHref(href)} {...props} />;
}
