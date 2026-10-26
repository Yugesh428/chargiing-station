# Quick Fix - Database Password Issue

## The Problem
The password `Yugesh@123#` is not working. You need the correct Supabase database password.

## How to Get the Correct Password

### Option 1: Get Password from Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project (the one with host: `db.mnsuoejdhivaolgpolke.supabase.co`)
3. Click **Settings** (gear icon in sidebar)
4. Click **Database**
5. Scroll down to **Connection string** section
6. Look for **Connection string** or **Database password**
7. Either:
   - Copy the password shown there, OR
   - Click **Reset Database Password** to create a new one

### Option 2: Reset Password (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → Database
4. Scroll down and click **Reset Database Password**
5. Copy the NEW password that appears
6. Save it somewhere safe!

## Update .env File

Once you have the correct password:

1. Open `.env` file in your project
2. Update BOTH lines:

```env
# In DATABASE_URL, use URL-encoded password (%40 for @, %23 for #, etc.)
DATABASE_URL=postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@db.mnsuoejdhivaolgpolke.supabase.co:5432/postgres

# In DB_PASSWORD, use the PLAIN password (not encoded)
DB_PASSWORD=YOUR_PLAIN_PASSWORD_HERE
```

**Example:**
If your password is `MyPass@123#`, then:
```env
DATABASE_URL=postgresql://postgres:MyPass%40123%23@db.mnsuoejdhivaolgpolke.supabase.co:5432/postgres
DB_PASSWORD=MyPass@123#
```

## URL Encoding Reference

If your password has special characters, encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- ` ` (space) → `%20`

## After Updating Password

Run these commands:

```bash
# Create database tables and super admin
npm run create:superadmin

# Start the application
npm run dev
```

Then visit http://localhost:3000 and login with:
- Username: `superadmin`
- Password: `Admin@123`

## Still Not Working?

### Check Connection Pooling Settings

1. In Supabase Dashboard → Settings → Database
2. Look for **Connection Pooling** section
3. Note the connection details
4. Make sure you're using **Direct Connection** (port 5432), not pooler (port 6543)

### Test Connection Manually

Try connecting with psql or any PostgreSQL client to verify the password works:

```bash
psql "postgresql://postgres:YOUR_PASSWORD@db.mnsuoejdhivaolgpolke.supabase.co:5432/postgres"
```

## Alternative: Use Connection String Directly

If you have the full working connection string from Supabase, you can test it by temporarily modifying `scripts/createSuperAdmin.js`:

```javascript
// Replace this line:
const sequelize = new Sequelize(
  process.env.DB_NAME || 'postgres',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false,
  }
);

// With this:
const sequelize = new Sequelize('postgresql://postgres:ACTUAL_PASSWORD@db.mnsuoejdhivaolgpolke.supabase.co:5432/postgres', {
  dialect: 'postgres',
  logging: console.log, // Enable logging to see what's happening
});
```

This will help you test if the connection string format works.
