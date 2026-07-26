import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blogPosts";

export const metadata: Metadata = {
  title: "Comic Lettering Blog — Balloon, Caption & SFX Tutorials",
  description:
    "Original tutorials on the craft of comic lettering: word balloon placement, tails, dialogue stacking, captions, sound effects, comic fonts and preparing pages for print.",
  alternates: { canonical: "/blog" },
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export default function BlogIndex() {
  return (
    <main className="mktSection">
      <h2>The Lettering Blog</h2>
      <p className="sub">
        Tutorials on the craft of comic lettering — balloons, tails, captions, sound
        effects and print prep — from the team behind LetterMyComic.
      </p>
      <div className="blogGrid">
        {BLOG_POSTS.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="featCard blogCard">
            <h3>{post.title}</h3>
            <p>{post.description}</p>
            <span className="blogMeta">
              <time dateTime={post.date}>{fmtDate(post.date)}</time> · {post.minutes} min read
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
