import type { Metadata } from "next";
import { notFound, redirect, permanentRedirect } from "next/navigation";
import { cookies } from "next/headers";
import { SitePage, ScrollPage } from "../../components/SitePage";
import { getSiteSettings, getScrollPages, getPageBySlug } from "../../lib/queries";
import { pageMetadata } from "../../lib/seo";
import { splitLocalePath, isLocaleShaped } from "../../lib/locale";

// Path-prefix i18n (template v15) — one optional-catch-all route now serves
// every page in every language: "/" and "/{slug}" (default locale) plus
// "/{locale}" and "/{locale}/{slug}". It replaces the old app/page.tsx +
// app/[slug]/page.tsx pair (a "/[locale]" segment can't sit beside
// "/[slug]" — Next forbids two differently-named dynamic segments at one
// level — so the locale has to be parsed out of a catch-all instead).
//
// force-dynamic, carried over from the old app/page.tsx: without it "/"
// prerenders as a fully static route whose Full Route Cache was observed
// on a live deploy to NOT pick up revalidateTag() for container-tagged
// content (settings-tagged content did propagate). A dynamic segment
// rendered per request has only unstable_cache in play and doesn't hit
// that bug.
export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ path?: string[] }>;
}

async function resolve(pathSegs: string[]) {
  const settings = await getSiteSettings();
  const availableLocales = (settings.availableLocales as string[] | null) ?? [];
  const { locale, isPrefixed, restSegments } = splitLocalePath(
    pathSegs,
    availableLocales,
    settings.defaultLocale
  );
  const slugSegs = isPrefixed ? restSegments : pathSegs;
  const slug = slugSegs.length ? slugSegs.join("/") : "home";
  // The path WITHOUT any locale prefix — what lib/seo.ts / app/sitemap.ts
  // hang the "/{locale}" prefixes off when they build canonical + hreflang.
  const urlPath = slugSegs.length ? `/${slugSegs.join("/")}` : "/";
  return { settings, availableLocales, locale, isPrefixed, slug, urlPath };
}

export async function generateMetadata({ params }: RouteCtx): Promise<Metadata> {
  const { path } = await params;
  const { slug, urlPath } = await resolve(path ?? []);
  return pageMetadata(slug, urlPath);
}

export default async function SiteRoute({ params }: RouteCtx) {
  const { path } = await params;
  const pathSegs = path ?? [];
  const { settings, availableLocales, locale, isPrefixed, slug } = await resolve(pathSegs);
  const defaultLocale = settings.defaultLocale;
  const localePrefix = locale === defaultLocale ? "" : `/${locale}`;

  // "/en/pricing" — the default locale explicitly prefixed. Its canonical
  // form is the bare path; permanent-redirect there. (middleware leaves
  // this to the route because it doesn't know the site's default locale.)
  if (isPrefixed && locale === defaultLocale) {
    permanentRedirect(pathSegs.length > 1 ? `/${pathSegs.slice(1).join("/")}` : "/");
  }

  // Sticky language for bare in-content links. A visitor whose cellpy_lang
  // cookie is a real non-default locale, landing on an UN-prefixed URL
  // (they clicked a "/pricing" link authored inside a block), is sent to
  // the prefixed version so they stay in their language. Googlebot carries
  // no cookie, so a crawler always sees the un-prefixed URL rendered as the
  // default language — exactly what its canonical + hreflang declare.
  if (!isPrefixed) {
    const cookieLang = (await cookies()).get("cellpy_lang")?.value;
    if (cookieLang && cookieLang !== defaultLocale && availableLocales.includes(cookieLang)) {
      redirect(`/${cookieLang}${pathSegs.length ? `/${pathSegs.join("/")}` : ""}`);
    }
  }

  const result = await getPageBySlug(slug);
  if (!result) {
    // A locale-shaped leading segment that isn't one of the site's
    // languages (a stale bookmark, "?lang=xx" junk funnelled here by
    // middleware, a language the site might add later) — send it to the
    // bare path rather than 404. Kept temporary: the segment isn't a
    // known-dead URL, and it could become a real locale.
    if (!isPrefixed && pathSegs.length > 0 && isLocaleShaped(pathSegs[0])) {
      redirect(pathSegs.length > 1 ? `/${pathSegs.slice(1).join("/")}` : "/");
    }
    notFound();
  }

  if (settings.layoutMode === "one-page") {
    // "/" (and "/{locale}") render every in-scroll page's sections
    // concatenated with anchor targets, same as the old app/page.tsx.
    if (slug === "home") {
      return <ScrollPage sections={await getScrollPages()} />;
    }
    // A direct hit on an in-scroll page's own URL redirects to its anchor
    // on the (locale-appropriate) home page instead of rendering twice.
    if (result.page.inScroll) {
      redirect(`${localePrefix}/#${slug}`);
    }
  }

  return <SitePage slug={slug} />;
}
