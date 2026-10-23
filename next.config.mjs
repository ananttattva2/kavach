/** @type {import('next').NextConfig} */
const config = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/clients/*/audits": ["./assets/fonts/NotoSans-Regular.ttf"],
  },
};
export default config;
