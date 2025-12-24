# GoSkinly - Premium Device Skins E-commerce

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Convex (serverless)
- **Styling:** Tailwind CSS + Radix UI
- **Payments:** PhonePe
- **Shipping:** RapidShyp
- **Notifications:** WhatsApp (AuthKey) + Email (MSG91)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Convex Backend
```bash
npx convex dev
```
This will prompt you to:
- Login to Convex
- Create a new project or link existing one

### 3. Setup Environment Variables
```bash
cp .env.example .env.local
```
Then fill in your API keys in `.env.local`

### 4. Run Development Server
```bash
npm run dev
```

## Deployment

### Deploy Backend (Convex)
```bash
npx convex deploy
```

### Deploy Frontend (Vercel)
1. Push code to GitHub
2. Connect repo in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Environment Variables

### Required for Convex (add in Convex Dashboard)
- `PHONEPE_MERCHANT_ID`
- `PHONEPE_SALT_KEY`
- `RAPIDSHYP_API_KEY`
- `MSG91_AUTH_TOKEN`
- `OPENAI_API_KEY`

### Required for Frontend (add in Vercel)
- `VITE_CONVEX_URL`
- `VITE_SITE_URL`
- `VITE_FB_PIXEL_ID`

## Project Structure
```
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Utility functions
├── convex/
│   ├── schema.ts       # Database schema
│   ├── products.ts     # Product queries/mutations
│   ├── orders.ts       # Order management
│   └── ...             # Other backend functions
└── public/             # Static assets
```

## Support
For issues, contact the development team.
