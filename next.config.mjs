/** @type {import('next').NextConfig} */
const nextConfig = { transpilePackages: ["three"], outputFileTracingIncludes: { "/api/card-image": ["./public/card-style/*.png"] } };
export default nextConfig;
