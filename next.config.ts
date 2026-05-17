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
  // 启用 cross-origin isolation，让浏览器暴露 SharedArrayBuffer
  // 这是 WASM 轻节点（@nervosnetwork/fiber-js）必须的运行环境
  // 仅开发环境注入；生产环境由 Caddy 统一下发，避免重复响应头
  async headers() {
    if (process.env.NODE_ENV !== 'development') return []
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

export default nextConfig
