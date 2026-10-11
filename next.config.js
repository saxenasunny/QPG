/** @type {import('next').NextConfig} */
module.exports = {
  experimental: { serverComponentsExternalPackages: ['pg', 'mammoth', 'docx', 'read-excel-file', 'unzipper', 'cheerio'] },
};
