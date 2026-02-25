/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@omkar-adtech/ui', '@omkar-adtech/types', '@omkar-adtech/api'],
  images: {
    domains: [
      'res.cloudinary.com',
      'storage.googleapis.com',
      'graph.facebook.com',
      'via.placeholder.com',
    ],
  },
};

export default nextConfig;
