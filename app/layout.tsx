import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Otter Lab",
  description: "수달 연구원들이 AI·IT 소식으로 카드뉴스와 블로그 글을 만드는 강가 연구소",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F2FAFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
