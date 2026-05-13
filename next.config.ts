import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@fiber-pay/sdk', '@nervosnetwork/fiber-js'],
  webpack(config) {
    // Enable WebAssembly support (required for @nervosnetwork/fiber-js)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    }
    return config
  },
}

export default nextConfig
