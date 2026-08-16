# StudyFlow

StudyFlow is a web-based productivity and study planning application that automatically transforms a user’s daily tasks, commitments, and fixed schedule into a personalized study/work plan. It integrates with Apple Reminders to keep tasks synchronized, allows users to track task completion, and provides summaries and insights to help them monitor progress and improve productivity.

# StudyFlow — Run & Deploy

Quick instructions to run the Vite React client and Node server locally, and to view the deployed demo.

Prerequisites
- Node.js v18+ and npm
- Git (for deploy workflows)

Install dependencies
```bash
# from project root
cd client && npm install
cd ../server && npm install
```

Run locally (development)
- Start the server (terminal 1)
```bash
cd server
# use the project's start/dev script if present
npm run dev || npm start || node index.js
```
- Start the client (terminal 2)
```bash
cd client
npm run dev
```
- Open the app:
  - Vite dev server default: http://localhost:5173
  - Typical server API: http://localhost:3000 (check server output for exact port)

Apply theme before render (optional)
- The project uses a `.dark` root class. To avoid flicker the client already sets the class in `client/src/main.tsx`.

Build & deploy client to GitHub Pages
```bash
cd client
npm run build
npm run deploy   # uses gh-pages and the `homepage` in package.json
```
- Ensure `client/vite.config.ts` has `base: "/study-flow/"` when deploying to `https://<username>.github.io/study-flow/`.

Deploy server
- Recommended hosts: Vercel, Render, Railway.
- For Vercel: connect the repo, set the server as a separate project (or use a monorepo setup), configure environment variables in the dashboard, and set the start command.

Serve production build locally (optional)
```bash
# build client
cd client
npm run build

# serve static build (install serve globally)
npm install -g serve
serve -s dist -l 5173
```

Inspect gh-pages branch locally
```bash
git fetch origin gh-pages
git checkout -b gh-pages origin/gh-pages
```

Notes
- Frontend reads API base from environment or code; update it to the deployed server URL when deploying.
- Add `node_modules` to `.gitignore` (server/.gitignore already contains it). If committed earlier: `git rm -r --cached node_modules && git commit -m "Remove node_modules"`.

If you want, I can:
- Add a GitHub Actions workflow to auto-deploy the client on push, or
- Add Vercel/Render deployment steps for the server.