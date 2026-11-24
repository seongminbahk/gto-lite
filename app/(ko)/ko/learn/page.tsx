import type { Metadata } from "next";
import { LearnPage } from "@/components/Learn/LearnPage";
import { learnMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = learnMetadata("ko");

export default function KoreanLearn() {
  return <LearnPage locale="ko" />;
}
