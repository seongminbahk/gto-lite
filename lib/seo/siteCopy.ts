import type { Locale } from "@/lib/i18n/messages";
import { SITE_NAME } from "@/lib/siteUrl";

export interface SiteCopy {
  /** The home page's title in search results and tabs. */
  title: string;
  description: string;
  /** The home page's heading and the lines under it, rendered on the server below the solver. */
  heading: string;
  intro: string[];
  aboutLink: string;
}

const en: SiteCopy = {
  title: `Free GTO Poker Solver — Preflop Ranges, ICM & Postflop · ${SITE_NAME}`,
  description:
    "Free GTO poker solver: tournament and cash preflop ranges with ICM and rake, push/fold charts, and a postflop solver that runs in your browser. No sign-up.",
  heading: "Free GTO poker solver: preflop ranges, ICM and postflop",
  intro: [
    "gtoLite shows preflop ranges for every seat in tournaments (8-handed, with ICM stages from the bubble to the final table) and 6-max or 8-max cash games with rake, from 2 to 100 big blinds. Short stacks get exact push/fold Nash ranges.",
    "When two players reach the flop, a CFR solver compiled to WebAssembly solves the spot on your own device, then follows the hand through the turn and river. It is free and needs no account.",
  ],
  aboutLink: "How the ranges and the solver work",
};

const ko: SiteCopy = {
  title: `무료 GTO 포커 솔버 — 프리플랍 레인지, ICM, 포스트플랍 · ${SITE_NAME}`,
  description:
    "무료 GTO 포커 솔버. ICM과 레이크를 반영한 토너먼트·캐시 프리플랍 레인지, 푸시/폴드 차트, 브라우저에서 돌아가는 포스트플랍 솔버. 가입 없이 바로 씁니다.",
  heading: "무료 GTO 포커 솔버: 프리플랍 레인지, ICM, 포스트플랍",
  intro: [
    "gtoLite는 토너먼트(8인, 버블부터 파이널 테이블까지 ICM 단계)와 레이크가 있는 6맥스·8맥스 캐시 게임에서 2~100빅블라인드까지 모든 자리의 프리플랍 레인지를 보여줍니다. 짧은 스택에서는 정확히 푼 푸시/폴드 내시 레인지를 씁니다.",
    "두 명이 플랍에 가면 WebAssembly로 컴파일한 CFR 솔버가 내 기기에서 스팟을 풀고, 턴과 리버까지 이어서 풉니다. 무료이고 계정이 필요 없습니다.",
  ],
  aboutLink: "레인지와 솔버가 어떻게 만들어지는지 보기",
};

const COPY: Record<Locale, SiteCopy> = { en, ko };

export function siteCopy(locale: Locale): SiteCopy {
  return COPY[locale];
}
