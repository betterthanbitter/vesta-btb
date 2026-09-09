/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * The directory data is read at runtime with a path built from
   * process.cwd(), which Next cannot trace statically. Without this, the
   * serverless functions deploy without the JSON files and every route that
   * calls loadDirectory() throws in production while working locally — the
   * worst kind of bug, because nothing catches it before deploy.
   */
  outputFileTracingIncludes: {
    '/consult/[id]': ['./data/**'],
    '/go/consult/[id]': ['./data/**'],
    '/api/consult': ['./data/**'],
    '/[hub]/[category]': ['./data/**'],
    '/': ['./data/**'],
  },
};
export default nextConfig;
