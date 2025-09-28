# Ticketing Demo Monorepo

This repository hosts both the React client and the Fastify/Prisma API (placeholder) for the IT ticketing demo.

## Structure

```
.
├── README.md
├── backend/        # Fastify + Prisma API placeholder
├── docs/           # API documentation and architectural notes
└── frontend/       # React + Vite client implementation
```

### Frontend

The UI lives under `frontend/` and is built with React, Vite, and Framer Motion. The primary component is `TicketingCanvasDemo`, which wires the UI to a REST API. To run the client:

```bash
cd frontend
npm install
npm run demo
```

The `demo` script launches Vite, opens your browser automatically, and loads the built-in mock API so the UI works instantly without provisioning a backend. If you do have the Fastify service running elsewhere, open the API modal (top-right "API" button) and paste its base URL, or set one of the following from the browser console:

1. `localStorage.setItem('apiBase', 'http://localhost:4000')`
2. `window.API_BASE = 'http://localhost:4000'`
3. Append `?api=http://localhost:4000` to the site URL

### Backend

The backend directory currently contains a placeholder README that sketches the suggested Fastify/Prisma layout. Populate it with your implementation to expose the routes referenced in [`docs/API.md`](docs/API.md).

### Documentation

Additional API notes live in `docs/API.md`. Extend this area with onboarding instructions, ERDs, or architectural decision records as the project grows.
