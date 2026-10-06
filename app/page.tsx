"use client";
import dynamic from "next/dynamic";

// 연구소 지도는 브라우저에서만 그려요
const OtterLab = dynamic(() => import("@/src/lab/OtterLab"), { ssr: false });

export default function Home() {
  return <OtterLab />;
}
