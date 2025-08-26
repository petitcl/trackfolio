# Supabase Database Setup Instructions

## Steps to Set Up Your Supabase Database

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose your organization and give the project a name (e.g., "trackfolio")
3. Generate a strong password for your database
4. Select a region close to you
5. Wait for the project to be created

### 2. Run Database Scripts
Execute these SQL scripts in order using the Supabase SQL Editor:

1. **Database Setup**: Copy and paste `database-setup.sql` into the SQL Editor and run
2. **Row Level Security**: Copy and paste `row-level-security.sql` and run  
3. **Sample Data**: Copy and paste `sample-data.sql` and run (see notes below)

### 3. Create Test User
1. Go to **Authentication > Users** in your Supabase dashboard
2. Click **"Add user"** 
3. Add a test user with:
   - Email: `test@trackfolio.com` (or any email you prefer)
   - Password: `testpassword123` (or any secure password)
   - Confirm password
4. Click **"Create user"**
5. **Copy the User ID (UUID)** from the users table

### 4. Update Sample Data
1. Open `sample-data.sql`
2. Replace ALL instances of `'TEST_USER_UUID'` with the actual UUID you copied
3. Use Find & Replace: Find `'TEST_USER_UUID'` → Replace with `'your-actual-uuid-here'`
4. Re-run the sample data script in Supabase SQL Editor

### 5. Test the Setup
1. Run the queries in `test-queries.sql` (remember to replace TEST_USER_UUID)
2. You should see:
   - Portfolio holdings with current quantities
   - Cash balance
   - Transaction history
   - P/L calculations

## Expected Sample Portfolio

After setup, your test user should have:
- **Apple (AAPL)**: 105 shares
- **Microsoft (MSFT)**: 25 shares  
- **Google (GOOGL)**: 16 shares
- **Tesla (TSLA)**: 25 shares
- **VTI ETF**: 35 shares
- **Bitcoin**: 0.2 BTC
- **Ethereum**: 2.5 ETH
- **Cash**: ~$1,875

Total portfolio value: ~$35,420

## Environment Variables for Next.js

Once your Supabase project is ready, you'll need these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these in: **Settings > API** in your Supabase dashboard

## Authentication Setup

Enable Google OAuth:
1. Go to **Authentication > Providers**
2. Enable **Google** provider
3. Add your Google OAuth credentials (you'll set this up later when building the app)

## Troubleshooting

### Common Issues:
1. **"relation does not exist"** - Make sure you ran `database-setup.sql` first
2. **"permission denied"** - Check that RLS policies were created correctly
3. **"TEST_USER_UUID not found"** - Make sure you replaced all instances with real UUID
4. **No data returned** - Verify the user UUID matches exactly (no extra quotes/spaces)

### Verify Setup:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check if sample data loaded
SELECT COUNT(*) FROM transactions;
SELECT COUNT(*) FROM symbols;
```

The database is now ready for your Next.js application!