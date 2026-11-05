import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { mockApi } from './scripts/mockApi';

export default defineConfig({
  plugins: [
    react(),
    // MOCK_API=1 이면 개발 서버에서 가짜 데이터로 /api 응답 (외부 API 없이 화면 확인용)
    ...(process.env.MOCK_API ? [mockApi()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '주봉 차트',
        short_name: '주봉차트',
        description: '주식·암호화폐 주봉 차트 (이동평균, 거래량, RSI, 프리미엄)',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // 네트워크 우선, 실패(오프라인) 시 마지막으로 받은 데이터 사용
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * 86400 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
