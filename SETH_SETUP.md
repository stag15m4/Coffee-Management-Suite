# iPad Dev Setup — Coffee Management Suite

## What you need

- iPad with Safari
- GitHub account (sign up at github.com if you don't have one)
- Ask Kara to add you as a collaborator on the repo

## One-time setup

### 1. Open the project in Codespaces

- Go to `github.com/stag15m4/Coffee-Management-Suite` in Safari
- Tap the green **Code** button
- Tap the **Codespaces** tab
- Tap **"Create codespace on migrate-off-replit"**
- Wait for VS Code to load in your browser (~2 min first time)

### 2. Update Node.js

Open a terminal (tap the ☰ menu → Terminal → New Terminal) and run:

```
nvm install 20
nvm use 20
```

Verify with:

```
node -v
```

Should show v20.x.x.

### 3. Install dependencies

```
npm install
```

### 4. Create your .env file

```
cp .env.example .env
```

Open `.env` from the file explorer and fill in these values (get them from Kara):

```
VITE_USE_MOCK_DATA=true
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NODE_ENV=development
PORT=5001
```

### 5. Start the dev server

```
npm run dev
```

A popup will appear saying a port is available — tap **"Open in Browser"** to preview the app.

### 6. Install the Claude extension

- Tap the **Extensions** icon (squares) in the left sidebar
- Search for **"Claude"**
- Install the one by **Anthropic**
- A Claude chat panel will appear — use it to ask Claude to make code changes

## Daily workflow

1. Go to `github.com/codespaces` and tap your existing codespace to reopen it
2. Pull the latest changes first:
   ```
   git pull
   ```
3. Open the Claude panel and tell it what to build or fix
4. Run `npm run dev` in the terminal to preview changes
5. When done, commit and push:
   ```
   git add -A
   git commit -m "describe what you changed"
   git push
   ```

## Stopping your Codespace (saves free hours)

1. Go to **github.com/codespaces** in a new tab
2. Find your codespace in the list
3. Tap the **three dots** (···) next to it
4. Tap **Stop codespace**

## Important notes

- **Always `git pull` before starting** to get the latest changes
- **Always `git push` when done** so others can get your changes
- Your Codespace saves your work even if you close Safari, but **commit often**
- The `.env` file is local to your Codespace and won't be pushed to GitHub (intentional — it has secrets)
- Free tier gives you **120 core-hours/month** — stop your Codespace when you're done to conserve hours
- If your Codespace gets deleted, just create a new one and redo steps 2–4 (your code is safe in GitHub)
