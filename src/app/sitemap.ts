import type { MetadataRoute } from "next";

const BASE = "https://lettermycomic.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    // keyword landing pages
    { url: `${BASE}/comic-lettering-software`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/manga-lettering`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/comic-book-lettering`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/comic-book-fonts`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
