/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname, // 👈 force le bon workspace
  },
};

export default nextConfig;
