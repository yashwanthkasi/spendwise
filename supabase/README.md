# Supabase setup

1. Create a new Supabase project at https://supabase.com (free tier is fine).
2. Copy **Project URL** and **anon key** from Project Settings → API into your local `.env`:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...
   ```

3. Apply the schema. Easiest path: open Supabase **SQL Editor**, paste the entire contents of `migrations/0001_init.sql`, and run it once. (If you use the Supabase CLI, `supabase db push` works too.)
4. In **Authentication → Providers**, keep Email enabled. For local dev, also turn OFF "Confirm email" temporarily so signup flows straight through.
5. Sign up in the app → a Personal group, a profile, and ~25 default categories are auto-created by the `handle_new_user` trigger.

## Resetting

To wipe the schema during development, run in SQL Editor:

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated;
```

…then re-run `0001_init.sql`.
