// Demo build for boogpunt.com/AxiA: DEMO=1 BASE_PATH=/AxiA next build
// (view-only: data and thumbnails are bundled by scripts/demo-data.mjs).
const base = process.env.BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(base && { basePath: base }),
  env: { NEXT_PUBLIC_BASE_PATH: base, NEXT_PUBLIC_DEMO: process.env.DEMO === "1" ? "1" : "" },
};

export default nextConfig;
