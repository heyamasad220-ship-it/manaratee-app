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
        source: "/hr",
        destination: "/workforce",
        permanent: false,
      },
      {
        source: "/hr/:path*",
        destination: "/workforce/:path*",
        permanent: false,
      },
      {
        source: "/programs/instructors",
        destination: "/workforce/employees?tab=assignments",
        permanent: false,
      },
      {
        source: "/events/overview",
        destination: "/event-management/overview",
        permanent: false,
      },
      {
        source: "/events/calendar",
        destination: "/facilities/calendar",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
