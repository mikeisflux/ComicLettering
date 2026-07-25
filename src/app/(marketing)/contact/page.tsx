import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Questions about LetterMyComic, your subscription or comic lettering? Send us a message — we read everything and reply by email.",
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  return (
    <main>
      <ContactForm />
    </main>
  );
}
