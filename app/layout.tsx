import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getMenu, getSiteSettings } from "../lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "Site",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [menu, settings] = await Promise.all([getMenu(), getSiteSettings()]);
  const isSideNav = settings.navPosition === "side";

  return (
    <html lang="en">
      <body className={isSideNav ? "layout-side" : "layout-top"}>
        <nav className={isSideNav ? "nav-side" : "nav-top"}>
          {menu.map((item) => (
            <a key={item.id} href={item.pageSlug === "home" ? "/" : `/${item.pageSlug}`}>
              {item.label}
            </a>
          ))}
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
