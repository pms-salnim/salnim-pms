# Vercel Environment Variables Setup

## Required Variables

Add these to your Vercel project in **Settings → Environment Variables**:

```
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_[YOUR_PUBLISHABLE_KEY]
SUPABASE_SERVICE_ROLE_KEY=eyJ[YOUR_SERVICE_ROLE_KEY]
```

## How to Get These Values

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API → Project URLs**
   - Copy `Project URL` → Set as `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` key → Set as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - Copy `service_role secret` → Set as `SUPABASE_SERVICE_ROLE_KEY`

## Steps to Add to Vercel

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project (salnim-pms)
3. Click **Settings** → **Environment Variables**
4. Add each variable:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://your-project.supabase.co`
   - **Select Production, Preview, Development** (or leave default)
   - Click **Save**
5. Repeat for other two variables
6. **Important**: Redeploy after adding variables (Vercel will prompt)

## Verification

After adding variables and redeploying:
- Check Vercel deployment logs should show build success
- App should load without "supabaseKey is required" error

## Optional Variables

For deployment-specific configurations:
```
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production
```
