/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/programs/registrations/enrollment/:id",
        destination: "/programs/registrations/:id",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
