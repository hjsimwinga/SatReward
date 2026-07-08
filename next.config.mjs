/** @type {import('next').NextConfig} */
const basePath = "/satreward";

const nextConfig = {
  basePath,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
