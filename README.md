# Electronic Checklist

A self-hosted weekly task manager with routines, ideas, and multi-device sync.

## Features

- **Weekly Task Board** – Organize tasks by week with drag-and-drop reordering
- **Routines** – Create recurring tasks (weekly, biweekly, monthly, annually)
- **Ideas Bucket** – Capture ideas without scheduling them
- **Archive** – Keep your board clean while retaining access to completed tasks
- **Rich Notes** – Markdown-style notes with lists and line breaks
- **Multi-Device Sync** – Real-time sync across browsers and devices
- **Authentication** – Password protection with invite codes for registration

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Express.js, Node.js
- **Database**: SQLite
- **Drag & Drop**: dnd-kit

## Getting Started

### Prerequisites

- Node.js 20+

### Development

Install dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

In a separate terminal, start the backend:

```bash
npm run server
```

Open http://localhost:5173 and register with the default invite code.

## Docker Deployment

Build and run with Docker Compose:

```bash
docker-compose up -d
```

Access the app at http://localhost:4000

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Host port (maps to container port 3000) |
| `JWT_SECRET` | ⚠️ Required | Strong secret for session tokens |
| `REGISTRATION_CODE` | ⚠️ Required | Invite code for new user registration |
| `COOKIE_SECURE` | `false` | Set to `true` if hosting with HTTPS |
| `TZ` | `UTC` | Timezone for the server |

## Security & Self-Hosting

For production deployment, you **must** configure these environment variables:

### JWT_SECRET
Generate a strong random secret:
```bash
openssl rand -base64 32
```

### REGISTRATION_CODE
Set a private invite code that users need to register:
```bash
REGISTRATION_CODE=your-secret-invite-code
```

### COOKIE_SECURE
Set to `true` when hosting with HTTPS:
```bash
COOKIE_SECURE=true
```

## Persistent Data

Mount a volume to `/app/data` to persist the SQLite database across container restarts. This is configured by default in `docker-compose.yml`.

## License

GNU General Public License v3.0
