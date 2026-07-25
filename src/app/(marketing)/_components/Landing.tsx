import Link from "next/link";

export interface Faq { q: string; a: string }
export interface Section { h: string; p: React.ReactNode }
export interface RelatedLink { href: string; label: string }

export interface LandingProps {
  slug: string;
  h1: string;
  kicker: string;
  lead: React.ReactNode;
  sections: Section[];
  bullets?: { t: string; d: string }[];
  faqs?: Faq[];
  related?: RelatedLink[];
  ctaLabel?: string;
}

const BASE = "https://lettermycomic.com";

export default function Landing({
  slug, h1, kicker, lead, sections, bullets, faqs, related, ctaLabel = "Try the Free Demo",
}: LandingProps) {
  const url = `${BASE}/${slug}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE },
        { "@type": "ListItem", position: 2, name: h1, item: url },
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "LetterMyComic",
      operatingSystem: "Web browser (Windows, macOS, Linux, Chromebook)",
      applicationCategory: "DesignApplication",
      url,
      description: typeof lead === "string" ? lead : h1,
      offers: [
        { "@type": "Offer", price: "20.00", priceCurrency: "USD", description: "Monthly subscription" },
        { "@type": "Offer", price: "160.00", priceCurrency: "USD", description: "Yearly subscription" },
      ],
    },
  ];
  if (faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  const jsonLd = { "@context": "https://schema.org", "@graph": graph };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero">
        <p className="heroKicker">{kicker}</p>
        <h1>{h1}</h1>
        <p className="lead">{lead}</p>
        <div className="heroBtns">
          <Link className="btnBig primary" href="/signup?next=/app&demo=1">{ctaLabel}</Link>
          <Link className="btnBig secondary" href="/pricing">Pricing — $20/mo</Link>
        </div>
        <p className="heroNote">Runs in your browser · no downloads · free demo, no credit card</p>
      </section>

      {sections.map((s, i) => (
        <section className={"mktSection" + (i % 2 ? " alt" : "")} key={i}>
          <div>
            <h2>{s.h}</h2>
            <div className="prose">{s.p}</div>
          </div>
        </section>
      ))}

      {bullets?.length ? (
        <section className="mktSection">
          <h2>What you get</h2>
          <div className="featGrid">
            {bullets.map((b) => (
              <div className="featCard" key={b.t}>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {faqs?.length ? (
        <section className="mktSection alt">
          <div>
            <h2>Frequently asked questions</h2>
            <div className="faqList">
              {faqs.map((f) => (
                <details className="faqItem" key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mktSection ctaSection">
        <h2>Start lettering your comic today</h2>
        <p className="sub">Open the studio in your browser and try every tool free. Subscribe for $20/month or $160/year to save, export and print — no contracts, cancel anytime.</p>
        <div className="heroBtns">
          <Link className="btnBig primary" href="/signup?next=/app&demo=1">{ctaLabel}</Link>
        </div>
        {related?.length ? (
          <p className="relatedLinks">
            Explore more:{" "}
            {related.map((r, i) => (
              <span key={r.href}>
                {i > 0 && " · "}
                <Link href={r.href}>{r.label}</Link>
              </span>
            ))}
          </p>
        ) : null}
      </section>
    </main>
  );
}
