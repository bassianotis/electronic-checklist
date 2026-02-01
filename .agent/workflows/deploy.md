---
description: How to deploy updates to the Raspberry Pi
---

Follow these steps to deploy the latest changes to your Raspberry Pi.

1.  **SSH into your Pi**:
    ```bash
    ssh user@your-pi-ip
    ```

2.  **Navigate to the project directory**:
    ```bash
    cd ~/Repositories/Tasks
    # (Or wherever you cloned the repo)
    ```

3.  **Pull the latest changes**:
    ```bash
    git pull origin main
    ```

4.  **Rebuild and Restart Docker**:
    ```bash
    docker compose up -d --build
    ```
    -   `up`: Creates and starts containers.
    -   `-d`: Detached mode (runs in background).
    -   `--build`: Forces a rebuild of the image with the new code.

5.  **Verify**:
    Check if it's running:
    ```bash
    docker compose ps
    ```
    Or view logs:
    ```bash
    docker compose logs -f web
    ```
