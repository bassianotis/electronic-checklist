# Raspberry Pi Deployment Guide

This guide details how to host your Task Management application on a Raspberry Pi.

## Prerequisites

1.  **Raspberry Pi**: Running Raspberry Pi OS (any version 64-bit recommended, but 32-bit works with the tailored Dockerfile).
2.  **Docker & Docker Compose**: Installed on the Pi.
    ```bash
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    # Log out and back in
    ```

## 1. Transfer Files

You need to move the project files to your Raspberry Pi.

**Option A: Git Clone (Recommended)**
Push your code to a private repo and clone it on the Pi.

**Option B: SCP (Direct Copy)**
From your development machine:
```bash
# Compress the project (excluding node_modules and data)
tar --exclude='node_modules' --exclude='data' --exclude='.git' -czf tasks-app.tar.gz .

# Copy to Pi (replace user@pi-ip with your details)
scp tasks-app.tar.gz user@192.168.1.X:~/tasks-app.tar.gz

# On the Pi:
mkdir ~/tasks-app
mv tasks-app.tar.gz ~/tasks-app
cd ~/tasks-app
tar -xzf tasks-app.tar.gz
```

Create a `.env` file in the project directory (use `.env.example` as a template).
This file keeps your secrets safe and is not committed to Git.

```bash
cp .env.example .env
nano .env
```

**Required variables in `.env`:**
```ini
JWT_SECRET=your-secure-random-string
REGISTRATION_CODE=my-secret-code
COOKIE_SECURE=false  # Keep false for HTTP/Local Network
```

## 3. Build and Run

Inside the project directory on your Pi:

```bash
docker compose up -d --build
```

This will:
1.  Build the Docker image (may take 5-10 mins on a Pi).
2.  Start the container.
3.  Ensure it restarts automatically on boot (`restart: unless-stopped`).

## 4. Access the App

Open your browser and navigate to:
`http://<your-pi-ip>:3000`

## 5. First Time Setup

1.  You will be redirected to the **Login** screen.
2.  Click **Register**.
3.  Enter a username and password.
4.  Enter the **Invite Code** (default: `123456` or what you set in `docker-compose.yml`).
5.  Click **Create Account**.

## 6. Backups

Your data is stored in a Docker volume named `task-list-prototype_task_data` (mapped to `/app/data` inside the container).

**To backup manually:**
```bash
# Create a backup of the SQLite database
docker compose cp web:/app/data/tasks.db ./tasks.db.backup
```

**To restore:**
Stop the container, replace the file, and restart.
