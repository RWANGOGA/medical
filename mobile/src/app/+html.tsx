import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * This file is web-only and used to configure the root HTML for every
 * web page during static rendering. The contents of this function only run
 * in Node.js environments and do not access the DOM or browser APIs.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0284C7" />
        <meta name="description" content="Antimicrobial Stewardship Platform - Clinical Decision Support" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* Preconnect to API domain for faster loading */}
        <link rel="preconnect" href="https://medical-sbit.onrender.com" />

        {/* Prevent phone number detection on iOS */}
        <meta name="format-detection" content="telephone=no" />

        {/* Disable tap highlight on mobile for native app feel */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * {
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
              }

              html {
                scroll-behavior: smooth;
                -webkit-text-size-adjust: 100%;
              }

              body {
                margin: 0;
                padding: 0;
                overscroll-behavior-y: contain;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }

              /* Prevent iOS zoom on input focus */
              input, select, textarea {
                font-size: 16px !important;
              }

              /* Responsive container */
              #root {
                min-height: 100vh;
                min-height: 100dvh;
                display: flex;
                flex-direction: column;
              }

              /* Touch target minimum size */
              button, a, [role="button"] {
                min-height: 44px;
                min-width: 44px;
              }

              /* Responsive breakpoints */
              @media (min-width: 768px) {
                .responsive-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                  gap: 16px;
                }
              }

              @media (min-width: 1024px) {
                .responsive-grid {
                  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                }
              }

              /* Safe area insets for notched devices */
              .safe-area-top {
                padding-top: env(safe-area-inset-top);
              }
              .safe-area-bottom {
                padding-bottom: env(safe-area-inset-bottom);
              }

              /* Scrollbar styling for web */
              ::-webkit-scrollbar {
                width: 6px;
                height: 6px;
              }
              ::-webkit-scrollbar-track {
                background: transparent;
              }
              ::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
              }
              ::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.3);
              }
            `,
          }}
        />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
