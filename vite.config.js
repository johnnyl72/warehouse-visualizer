import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The prototype's JSX (.jsx files with React.* calls) ports directly; the
// React plugin's automatic runtime handles the JSX transform.
export default defineConfig({
  plugins: [react()],
  server: { open: true },
});
