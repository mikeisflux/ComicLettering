import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getPost } from "@/lib/blogPosts";

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title: `${post.title} — LetterMyComic Blog`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `https://lettermycomic.com/blog/${post.slug}`,
      publishedTime: post.date,
    },
  };
}

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function BlogPost(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: "LetterMyComic" },
    publisher: { "@type": "Organization", name: "LetterMyComic", url: "https://lettermycomic.com" },
    mainEntityOfPage: `https://lettermycomic.com/blog/${post.slug}`,
  };

  return (
    <main className="mktSection">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="prose blogPost">
        <p className="heroKicker">{post.kicker ?? "Lettering tutorial"}</p>
        <h1>{post.title}</h1>
        <p className="blogMeta">
          <time dateTime={post.date}>{fmtDate(post.date)}</time> · {post.minutes} min read
        </p>
        {post.blocks.map((block, i) => {
          if (block.h) return <h2 key={i}>{block.h}</h2>;
          if (block.p) return <p key={i}>{block.p}</p>;
          if (block.ul)
            return (
              <ul key={i}>
                {block.ul.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          return null;
        })}
      </article>
      <div className="relatedLinks">
        <Link href="/blog">← All articles</Link>
      </div>
      <div className="heroBtns" style={{ marginTop: 30, justifyContent: "flex-start" }}>
        <Link className="btnBig primary" href="/signup">Try LetterMyComic Free</Link>
      </div>
    </main>
  );
}
