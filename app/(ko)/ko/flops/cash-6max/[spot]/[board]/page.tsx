import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlopSpotPage } from "@/components/FlopPages/FlopSpotPage";
import { flopMetadata } from "@/lib/seo/metadata";
import { FLOP_DATA } from "@/lib/seo/flopData";
import { allFlopPages, parseFlopParams } from "@/lib/seo/flopPages";

// Every solved flop is built ahead; any other address is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allFlopPages(FLOP_DATA).map((p) => ({ spot: p.spot.slug, board: p.board.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ spot: string; board: string }> }): Promise<Metadata> {
  const page = parseFlopParams(FLOP_DATA, await params);
  if (!page) notFound();
  return flopMetadata("ko", page, FLOP_DATA.spots[page.spot.slug][page.board.slug]);
}

export default async function Flop({ params }: { params: Promise<{ spot: string; board: string }> }) {
  const page = parseFlopParams(FLOP_DATA, await params);
  if (!page) notFound();
  return <FlopSpotPage locale="ko" page={page} data={FLOP_DATA.spots[page.spot.slug][page.board.slug]} all={FLOP_DATA} />;
}
