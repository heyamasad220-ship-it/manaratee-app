import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack sometimes mis-infers the App Router `app/` folder as the project
  // root and then fails to resolve `next/package.json`. Pin the real repo root.
  turbopack: {
    root: projectRoot,
  },
  serverActions: {
    bodySizeLimit: "4mb",
  },
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
        destination: "/event-management/calendar",
        permanent: false,
      },
      {
        source: "/bookings/calendar",
        destination: "/facilities/calendar?sources=venue_rental",
        permanent: false,
      },
      {
        source: "/vendor-hub/community-calendar",
        destination: "/community-calendar",
        permanent: false,
      },
      {
        source: "/vendor-hub/applications",
        destination: "/vendor-hub/events",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors/applications",
        destination: "/vendor-hub/events",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors/approved",
        destination: "/vendor-hub/network/vendors",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors/waitlist",
        destination: "/vendor-hub/network/vendors",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors/documents",
        destination: "/vendor-hub/network/documents",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors/communications",
        destination: "/vendor-hub/network/invitations",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors",
        destination: "/vendor-hub/network/vendors",
        permanent: false,
      },
      {
        source: "/vendor-hub/vendors/:path*",
        destination: "/vendor-hub/network/vendors",
        permanent: false,
      },
      {
        source: "/vendor-hub/booths",
        destination: "/vendor-hub/events",
        permanent: false,
      },
      {
        source: "/vendor-hub/booths/:path*",
        destination: "/vendor-hub/events",
        permanent: false,
      },
      {
        source: "/vendor-hub/payments",
        destination: "/vendor-hub/events",
        permanent: false,
      },
      {
        source: "/vendor-hub/finance/:path*",
        destination: "/vendor-hub/events",
        permanent: false,
      },
      {
        source: "/vendor-hub/programming/:path*",
        destination: "/vendor-hub",
        permanent: false,
      },
      {
        source: "/vendor-hub/operations/:path*",
        destination: "/vendor-hub",
        permanent: false,
      },
      {
        source: "/vendor-hub/publishing/:path*",
        destination: "/vendor-hub/community-calendar",
        permanent: false,
      },
      {
        source: "/vendor-hub/activities",
        destination: "/vendor-hub",
        permanent: false,
      },
      {
        source: "/vendor-hub/entertainment",
        destination: "/vendor-hub",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
