import { Dimensions, Platform, useWindowDimensions } from "react-native";

/**
 * Responsive breakpoint utilities for the app.
 * Works on both mobile and web platforms.
 */

// Breakpoints (width in pixels)
export const BREAKPOINTS = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type Breakpoint = "phone" | "tablet" | "desktop" | "wide";

/**
 * Get current breakpoint based on screen width
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.wide) return "wide";
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "phone";
}

/**
 * Hook to get current breakpoint and responsive utilities
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const breakpoint = getBreakpoint(width);

  return {
    width,
    height,
    breakpoint,
    isPhone: breakpoint === "phone",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop",
    isWide: breakpoint === "wide",
    isTabletOrLarger: width >= BREAKPOINTS.tablet,
    isDesktopOrLarger: width >= BREAKPOINTS.desktop,
    isMobile: width < BREAKPOINTS.tablet,
  };
}

/**
 * Scale a value based on screen width
 * Useful for responsive font sizes, margins, etc.
 */
export function scaleSize(
  phoneValue: number,
  tabletValue?: number,
  desktopValue?: number
): number {
  const { width } = Dimensions.get("window");
  const breakpoint = getBreakpoint(width);

  switch (breakpoint) {
    case "desktop":
    case "wide":
      return desktopValue ?? tabletValue ?? phoneValue;
    case "tablet":
      return tabletValue ?? phoneValue;
    default:
      return phoneValue;
  }
}

/**
 * Get number of columns for a grid based on screen width
 */
export function getGridColumns(width: number): number {
  if (width >= BREAKPOINTS.wide) return 4;
  if (width >= BREAKPOINTS.desktop) return 3;
  if (width >= BREAKPOINTS.tablet) return 2;
  return 1;
}

/**
 * Minimum touch target size (Apple HIG & Material Design)
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Ensure a value meets minimum touch target size
 */
export function ensureTouchTarget(size: number): number {
  return Math.max(size, MIN_TOUCH_TARGET);
}
