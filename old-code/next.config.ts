import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["kokoro-js", "onnxruntime-node"],
};

export default nextConfig;
