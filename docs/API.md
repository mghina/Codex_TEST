# API Overview

The frontend expects a REST API that exposes the following routes:

- `GET /health` – connectivity check.
- `POST /auth/login` – authenticate a user and return `{ token, user }`.
- `GET /tickets` – list tickets with Prisma-style payloads.
- `POST /tickets` – create a ticket (JSON body).
- `POST /tickets/multipart` – create a ticket with attachments (multipart/form-data).
- `PATCH /tickets/:id/status` – update status.
- `GET /tickets/:id/comments` – retrieve comments.
- `POST /tickets/:id/comments` – add a comment.
- `POST /tickets/:id/comments/attachments` – upload comment attachments.

Responses should match the mapping logic located in `frontend/src/components/TicketingCanvasDemo.tsx`.
