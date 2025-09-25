import { defineConfig } from 'vite'

const isGithubActions = process.env.GITHUB_ACTIONS === 'true'
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''

// https://vitejs.dev/config/
export default defineConfig({
  // When building on GitHub Pages, serve assets from the repository sub-path
  // Example: https://<user>.github.io/<repo>/
  base: isGithubActions && repository ? `/${repository}/` : '/',
})
