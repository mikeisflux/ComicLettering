import type { Metadata } from "next";
import { GUIDE_INTRO, GUIDE_SECTIONS, GUIDE_TITLE } from "@/lib/userGuide";

export const metadata: Metadata = {
  title: `${GUIDE_TITLE} — every feature, explained`,
  description:
    "The complete guide to the LetterMyComic studio: word balloons, joins, lettering, warping, Tuck Back, the bleed line, spreads, collaboration, export and printing.",
  alternates: { canonical: "/guide" },
};

export default function GuidePage() {
  return (
    <main className="mktSection">
      <article className="prose blogPost">
        <p className="heroKicker">Documentation</p>
        <h1>{GUIDE_TITLE}</h1>
        <p>{GUIDE_INTRO}</p>
        <ul>
          {GUIDE_SECTIONS.map((s) => (
            <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
          ))}
        </ul>
        {GUIDE_SECTIONS.map((s) => (
          <section key={s.id} id={s.id}>
            <h2>{s.title}</h2>
            {s.blocks.map((b, i) => {
              if (b.h) return <h3 key={i}>{b.h}</h3>;
              if (b.p) return <p key={i}>{b.p}</p>;
              if (b.ul) return <ul key={i}>{b.ul.map((it, j) => <li key={j}>{it}</li>)}</ul>;
              return null;
            })}
          </section>
        ))}
      </article>
    </main>
  );
}
