import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest: {
        manifest_version: 3,
        name: 'AK-HD Translated Video',
        version: '1.0.0',
        description: 'إضافة متطورة للترجمة الفورية للفيديو - تدعم 156+ لغة مع واجهة ذكية بـ 30+ لغة',
        permissions: [
          'activeTab',
          'storage',
          'scripting',
          'tabs',
          'background',
          'audioCapture'
        ],
        host_permissions: [
          '<all_urls>',
          'https://libretranslate.com/*',
          'https://translate.googleapis.com/*',
          'https://api.deepl.com/*',
          'https://api-free.deepl.com/*',
          'https://api.openai.com/*',
          'https://api.together.xyz/*',
          'https://api.deepseek.com/*',
          'https://api.gemini.googleapis.com/*',
          'https://api.voxart.ai/*',
          'https://speech.googleapis.com/*',
          'https://*.cognitiveservices.azure.com/*',
          'https://aws.amazon.com/*'
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/ui'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/assets': path.resolve(__dirname, './src/assets'),
      '@/background': path.resolve(__dirname, './src/background'),
      '@/content': path.resolve(__dirname, './src/content')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        'content/main': path.resolve(__dirname, 'src/content/main.ts'),
        'popup/main': path.resolve(__dirname, 'src/ui/popup.tsx'),
        'background/main': path.resolve(__dirname, 'src/background/main.ts'),
        'options/main': path.resolve(__dirname, 'src/ui/options.tsx')
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@mui/material', 'webextension-polyfill']
  }
})