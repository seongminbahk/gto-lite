import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RangeSpotPage } from "@/components/RangePages/RangeSpotPage";
import { spotMetadata } from "@/lib/seo/metadata";
import { allSpotPages, parseSpotParams, spotParams } from "@/lib/seo/spotPages";
import { solveSpotPage } from "@/lib/seo/spotSolve";
import { rangeStats } from "@/lib/seo/spotSummary";

// Every spot is built ahead; any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allSpotPages().map(spotParams);
}

export async function generateMetadata({ params }: PageProps<"/ranges/[format]/[stack]/[spot]">): Promise<Metadata> {
  const page = parseSpotParams(await params);
  if (!page) notFound();
  return spotMetadata("en", page, rangeStats(solveSpotPage(page).hands));
}

export default async function RangeSpot({ params }: PageProps<"/ranges/[format]/[stack]/[spot]">) {
  const page = parseSpotParams(await params);
  if (!page) notFound();
  return <RangeSpotPage locale="en" page={page} solved={solveSpotPage(page)} />;
}
