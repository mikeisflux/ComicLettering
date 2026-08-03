import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blogPosts";

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
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...BLOG_POSTS.map((post) => ({
      url: `${BASE}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/delete-account`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
