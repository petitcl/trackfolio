# 🚀 Quick Start Guide

## Test the App Immediately

### 1. Start Development Server
```bash
cd webapp
npm run dev
```

### 2. Open Browser
Visit: http://localhost:3000

### 3. Demo Login
- Click "Continue with Email"  
- Email: `test@trackfolio.com`
- Password: `testpassword123`

**Note**: This uses mock data - no database required!

## What You'll See

### Demo Portfolio (~$548K)
- **Stocks**: Apple, Microsoft 
- **Crypto**: Bitcoin (with manual pricing)
- **Real Estate**: House worth $465K
- **Collectibles**: Vintage watch collection
- **Private Equity**: Startup shares
- **Cash**: Available balance

### Features Working
✅ **Authentication**: Login/logout flow  
✅ **Dashboard**: Portfolio overview with P&L  
✅ **Holdings Table**: All positions with current values  
✅ **Responsive Design**: Mobile-friendly interface  
✅ **PWA Ready**: Can be installed on mobile  
✅ **Mock Data**: Full test portfolio with realistic numbers

## Next: Connect Real Database

1. Follow setup guide in `/docs/SETUP-INSTRUCTIONS.md`
2. Create Supabase project and run SQL scripts
3. Update `.env.local` with your database credentials
4. Restart the app to use live data

## File Structure

```
webapp/
├── src/
│   ├── app/           # Next.js pages
│   ├── components/    # React components  
│   ├── lib/          # Utilities & Supabase setup
│   └── middleware.ts # Auth protection
├── public/           # Static files & PWA manifest
└── .env.local       # Environment variables
```

## Available Scripts

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production server  
- `npm run lint` - Code linting

---

**Ready to track your portfolio!** 📈