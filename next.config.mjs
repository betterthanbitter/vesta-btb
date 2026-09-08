/** @type {import('next').NextConfig} */
const nextConfig = {
  // The domain layer under src/ is plain TypeScript with explicit .ts imports
  // so that `node --test` can run it with no build step. Next resolves those
  // paths natively; nothing special is needed here.
  experimental: {},
};
export default nextConfig;
