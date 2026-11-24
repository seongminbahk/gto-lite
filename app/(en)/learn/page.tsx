import type { Metadata } from "next";
import { LearnPage } from "@/components/Learn/LearnPage";
import { learnMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = learnMetadata("en");

export default function Learn() {
  return <LearnPage locale="en" />;
}
