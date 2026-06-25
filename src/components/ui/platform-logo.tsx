"use client";

import { type CSSProperties } from "react";

export type PlatformId = "instagram" | "telegram" | "linkedin" | "rubika" | "eitaa";

interface LogoProps {
  className?: string;
  style?: CSSProperties;
}

const size = (className?: string) => className ?? "size-5";

/* Real official brand logos, downloaded to /public/logos:
 *  - instagram.svg  (official 2016 gradient glyph, Wikimedia Commons)
 *  - telegram.svg   (official blue circle paper-plane, Wikimedia Commons)
 *  - linkedin.svg   (official "in" square, Wikimedia Commons)
 *  - rubika.png     (official app icon, 256×256, web-sourced)
 *  - eitaa.jpg      (official app icon, 1024×1024, web-sourced)
 *
 * Each renderer outputs a rounded square container so the logos sit
 * uniformly in the UI regardless of their native aspect ratio / shape.
 */

const META: Record<PlatformId, { src: string; rounded: string }> = {
  instagram: { src: "/logos/instagram.svg", rounded: "rounded-[22%]" },
  telegram: { src: "/logos/telegram.svg", rounded: "rounded-full" },
  linkedin: { src: "/logos/linkedin.svg", rounded: "rounded-[18%]" },
  rubika: { src: "/logos/rubika.png", rounded: "rounded-[22%]" },
  eitaa: { src: "/logos/eitaa.jpg", rounded: "rounded-[22%]" },
};

function ImgLogo({ src, alt, className, rounded, style }: { src: string; alt: string; className?: string; rounded: string; style?: CSSProperties }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`${rounded} object-cover ${size(className)}`}
      style={style}
      loading="lazy"
      draggable={false}
    />
  );
}

export function InstagramLogo({ className, style }: LogoProps) {
  return <ImgLogo src={META.instagram.src} alt="Instagram" className={className} rounded={META.instagram.rounded} style={style} />;
}
export function TelegramLogo({ className, style }: LogoProps) {
  return <ImgLogo src={META.telegram.src} alt="Telegram" className={className} rounded={META.telegram.rounded} style={style} />;
}
export function LinkedInLogo({ className, style }: LogoProps) {
  return <ImgLogo src={META.linkedin.src} alt="LinkedIn" className={className} rounded={META.linkedin.rounded} style={style} />;
}
export function RubikaLogo({ className, style }: LogoProps) {
  return <ImgLogo src={META.rubika.src} alt="Rubika" className={className} rounded={META.rubika.rounded} style={style} />;
}
export function EitaaLogo({ className, style }: LogoProps) {
  return <ImgLogo src={META.eitaa.src} alt="Eitaa" className={className} rounded={META.eitaa.rounded} style={style} />;
}

const registry = {
  instagram: InstagramLogo,
  telegram: TelegramLogo,
  linkedin: LinkedInLogo,
  rubika: RubikaLogo,
  eitaa: EitaaLogo,
} as const;

/**
 * Unified platform logo renderer. Uses the real downloaded brand assets.
 * Falls back to a neutral disc with initials for unknown platforms.
 */
export function PlatformLogo({
  platform,
  className,
  style,
}: {
  platform: string;
  className?: string;
  mono?: boolean; // kept for API compat — real logos are always full-color
  style?: CSSProperties;
}) {
  const Cmp = registry[platform as PlatformId] ?? null;
  if (!Cmp) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[var(--radius-small)] bg-surface-hover text-ink-tertiary text-[10px] font-[800] ${className ?? "size-5"}`}
        style={style}
      >
        {platform.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <Cmp className={className} style={style} />;
}
