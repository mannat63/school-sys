/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  serverExternalPackages: ["jspdf", "jspdf-autotable"],
};

module.exports = nextConfig;
