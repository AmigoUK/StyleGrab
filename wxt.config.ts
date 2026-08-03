import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: 'StyleGrab',
    description:
      'Save colour palettes and typography from any page. Export as CSS variables, Tailwind config or W3C design tokens. Free, no account.',
    homepage_url: 'https://amigouk.github.io/StyleGrab/',
    // The native EyeDropper API and the MV3 service-worker behaviour we rely on
    // are stable from Chrome 116; below that the popup would offer a dead button.
    minimum_chrome_version: '116',
    // Privacy-minimal by design: no host_permissions, no `tabs`, no `downloads`.
    // `activeTab` grants temporary access to the page only when the user clicks
    // the action; `scripting` injects the style scanner on demand; `storage`
    // keeps the local library. captureVisibleTab works under activeTab.
    permissions: ['activeTab', 'storage', 'scripting'],
  },
});
