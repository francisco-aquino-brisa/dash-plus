import type { Metadata } from "next";
import localFont from "next/font/local";
import { Source_Sans_3, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Figtree (display) — brand-supplied static faces, self-hosted via next/font.
const figtree = localFont({
  variable: "--font-figtree",
  display: "swap",
  src: [
    { path: "./fonts/figtree/Figtree-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/figtree/Figtree-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/figtree/Figtree-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/figtree/Figtree-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/figtree/Figtree-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/figtree/Figtree-ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "./fonts/figtree/Figtree-Black.ttf", weight: "900", style: "normal" },
  ],
});

// Source Sans 3 (UI/body) + JetBrains Mono (capability labels) from Google.
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  variable: "--font-source-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brisa Dash · Brisanet",
  description:
    "Dashboards executivos de performance da Brisanet: cidades, vendas, produtividade comercial e vendedor.",
};

// Applied before paint so the persisted theme never flashes the wrong palette.
const THEME_BOOTSTRAP = `try{var t=localStorage.getItem('brisa-dash-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      className={`${figtree.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
