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

        {/* Preload libraries - Three.js and TalkingHead self-hosted, HeadTTS on CDN */}
        <link rel="preload" href="/lib/three.module.js" as="script" crossOrigin="anonymous" />
        <link rel="preload" href="/lib/talkinghead.mjs" as="script" crossOrigin="anonymous" />
        <link rel="preload" href="https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm" as="script" crossOrigin="anonymous" />

        {/* Import map for Three.js - using self-hosted files */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                "three": "/lib/three.module.js",
                "three/addons/": "/lib/three-addons/"
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
              // TalkingHead is self-hosted, HeadTTS stays on CDN (has complex AI dependencies)
              (async () => {
                try {
                  console.log('[Preload] Starting to load libraries...');
                  const [talkingHeadModule, headTTSModule] = await Promise.all([
                    import("/lib/talkinghead.mjs"),
                    import("https://cdn.jsdelivr.net/npm/@met4citizen/headtts@1.3/+esm")
                  ]);
                  console.log('[Preload] Modules loaded');
                  window.TalkingHead = talkingHeadModule.TalkingHead;
                  window.HeadTTS = headTTSModule.HeadTTS;
                  window.dispatchEvent(new Event('talkinghead-loaded'));
                  console.log('[Preload] TalkingHead (self-hosted) and HeadTTS (CDN) libraries loaded');
                } catch (e) {
                  console.error('[Preload] Failed to preload libraries:', e);
                  console.error('[Preload] Error stack:', e.stack);
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
