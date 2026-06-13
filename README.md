# Command Center

Personal command center for an AI business — dashboard, kanban content pipeline, calendar, todos, sources, and AI tools catalog. React + Vite + Supabase, deployed on Netlify.

## Tabs

- **Dashboard** — today's tasks, weekly posting count, what's in production
- **Kanban** — content pipeline (Ideas → Scripted → Filmed → Edited → Scheduled → Posted)
- **Calendar** — month view of posts and events, color-coded by platform
- **Todo** — tasks with category (AI brand / client / personal) and priority
- **Sources** — saved links with tags and search
- **AI Tools** — your stack with category, cost, use case, and rating

## One-time setup

### 1. Run the database schema in Supabase

1. Supabase dashboard → **SQL Editor** → **New query**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

This creates 5 tables, RLS policies (so each user only sees their own data), and indexes.

### 2. Configure auth in Supabase

1. Supabase dashboard → **Authentication → Providers → Email**
2. Either turn off "Confirm email" (faster — single user, your own app), or keep it on and confirm via email when you sign up

### 3. Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com), log in with GitHub
2. **Add new site → Import an existing project → GitHub → command-center**
3. Build settings auto-detect from `netlify.toml` (don't change them)
4. Before deploying, click **Add environment variables** and set:
   - `VITE_SUPABASE_URL` = `https://kznhxznshqckmulbtgdu.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your publishable key (`sb_publishable_…`)
5. Click **Deploy**

After ~30 seconds you get a URL like `command-center-xxxx.netlify.app`. Open it, sign up, and you're in.

### 4. Add to home screen (phone)

- **iOS Safari**: open the site → Share → Add to Home Screen
- **Android Chrome**: open the site → menu → Install app

The app runs full-screen, looks native, and syncs with your Mac through Supabase.

## Local development

```bash
cp .env.example .env
# edit .env with your Supabase url and anon key

npm install
npm run dev
```

Open http://localhost:5173

## Push updates

Any commit to `main` auto-deploys to Netlify.

```bash
git add .
git commit -m "your message"
git push
```
