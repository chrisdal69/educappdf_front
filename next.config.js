const urlBack = process.env.NEXT_PUBLIC_URL_BACK;

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      new URL(`https://storage.googleapis.com/${process.env.NEXT_PUBLIC_BUCKET_NAME || "mathsapp"}/**`),     
      new URL("https://upload.wikimedia.org/wikipedia/**"),
    ],
    minimumCacheTTL: 2678400,
  },
  async rewrites() {
    if (!urlBack) return [];
    return [
      { source: "/auth/:path*", destination: `${urlBack}/auth/:path*` },
      { source: "/users/:path*", destination: `${urlBack}/users/:path*` },
      { source: "/upload/:path*", destination: `${urlBack}/upload/:path*` },
      { source: "/cards/:path*", destination: `${urlBack}/cards/:path*` },
      { source: "/quizzs/:path*", destination: `${urlBack}/quizzs/:path*` },
    ];
  },
};

module.exports = nextConfig;