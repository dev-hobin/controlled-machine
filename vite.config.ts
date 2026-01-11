import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      exclude: ['src/__tests__'],
      rollupTypes: false,
      afterBuild: () => {
        // Copy .d.ts to .d.cts for CJS compatibility
        copyFileSync('dist/index.d.ts', 'dist/index.d.cts')
        copyFileSync('dist/react.d.ts', 'dist/react.d.cts')
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs'
        return `${entryName}.${ext}`
      },
    },
    rollupOptions: {
      external: ['react'],
      output: {
        preserveModules: false,
      },
    },
    sourcemap: true,
    minify: false,
  },
})
