# Al

A voice companion for older adults. Open the web page and talk: Al answers questions, reads email, and handles everyday tasks. A family dashboard shows what happened.

Stack: LiveKit (browser voice), Mastra (agent and tools), Neon Postgres, Exa, AgentMail, Kernel. Next.js for the web app.

## Run

```bash
cp .env.example .env       # fill LiveKit, OpenAI, and Neon values
npm install
npm run agent:download     # once
npm run migrate
npm run agent              # terminal 1: voice worker
npm run dev                # terminal 2: http://localhost:3000 and /dashboard
```

See `AGENTS.md` for layout and conventions.
