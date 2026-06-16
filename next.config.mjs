/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // These packages use native / node-only features and must not be bundled by webpack.
    // Keeping them external lets transformers.js load its models and pdf-parse read buffers.
    serverComponentsExternalPackages: ['@huggingface/transformers', 'pdf-parse'],
  },
};

export default nextConfig;
