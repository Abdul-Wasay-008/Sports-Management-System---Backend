# Backend

Node.js, Express, Mongoose, TypeScript. HTTP API for the sports management app.

See the repository [README.md](../README.md) for how to run the server and the overall project layout.

## Environment

Copy [`.env.example`](./.env.example) to `.env` and set at least `MONGODB_URI` for a full database connection.

## Layout

- `src/config/` — environment and shared configuration
- `src/lib/` — database and other clients
- `src/routes/` — HTTP route modules (mounted under `/api`)
- `src/middleware/` — Express middleware (placeholders for auth, validation, etc.)
- `src/models/` — Mongoose models
