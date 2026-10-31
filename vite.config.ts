import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react(), {name:'production-csp', apply:'build', transformIndexHtml:()=>[{tag:'meta', attrs:{'http-equiv':'Content-Security-Policy',content:"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob: https: http:; connect-src 'self' https: http:; object-src 'none'; base-uri 'self'; form-action 'none'"}}]}],
  base: './', server: {port:5173, strictPort:true}
})
