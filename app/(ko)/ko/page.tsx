import type { Metadata } from "next";
import { HomeIntro } from "@/components/HomeIntro";
import { SolverHome } from "@/components/SolverHome";
import { homeMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = homeMetadata("ko");

export default function KoreanHome() {
  return (
    <>
      <SolverHome />
      <HomeIntro locale="ko" />
    </>
  );
}
