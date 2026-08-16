import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HealthAI - Medical Consultation",
  description: "Your personal AI health assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        {/* Preload avatar GLB files for faster loading */}
        <link rel="preload" href="/avatar.glb" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/avatar-male.glb" as="fetch" crossOrigin="anonymous" />

        {/* Preload TalkingHead dependencies */}
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js" as="script" crossOrigin="anonymous" />
        <link rel="preload" href="https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/modules/talkinghead.mjs" as="script" crossOrigin="anonymous" />
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm" as="script" crossOrigin="anonymous" />

        {/* Import map for TalkingHead's Three.js dependency */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                "three": "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/"
              }
            })
          }}
        />

        {/* Preload TalkingHead and HeadTTS libraries on page load */}
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `
              // Preload libraries in the background as soon as page loads
              (async () => {
                try {
                  const [{ TalkingHead }, { HeadTTS }] = await Promise.all([
                    import("https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@main/modules/talkinghead.mjs"),
                    import("https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm")
                  ]);
                  window.TalkingHead = TalkingHead;
                  window.HeadTTS = HeadTTS;
                  window.dispatchEvent(new Event('talkinghead-loaded'));
                  console.log('[Preload] TalkingHead and HeadTTS libraries loaded');
                } catch (e) {
                  console.warn('[Preload] Failed to preload libraries:', e);
                }
              })();
            `
          }}
        />
      </head>
      <body className="h-screen flex flex-col bg-background text-on-surface">
        {children}
      </body>
    </html>
  );
}
