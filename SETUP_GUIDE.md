# EV Charging Station Management System - Setup Guide

## Database Setup Issue

The database password authentication is failing. Please follow these steps:

### Option 1: Reset Supabase Database Password

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Click **Reset database password**
5. Copy the new password
6. Update your `.env` file with the new password

### Option 2: Verify Current Password

1. Go to Supabase dashboard
2. Settings → Database
3. Note down the correct password
4. Update `.env` file:

```env
DB_PASSWORD=YOUR_ACTUAL_PASSWORD_HERE
```

**Note:** If your password contains special characters like `@`, `#`, `%`, you need to:
- Use the plain password in `DB_PASSWORD` (without encoding)
- Use URL-encoded password in `DATABASE_URL` (with %40 for @, %23 for #)

### After Updating Password

1. Run the setup command:

```bash
npm run create:superadmin
```

This will:
- Create all database tables (tenants, users, charging_sessions, expenses)
- Create a super admin user

2. Start the development server:

```bash
npm run dev
```

3. Open http://localhost:3000

4. Login with:
   - Username: `superadmin`
   - Password: `Admin@123`

## Next Steps After Successful Setup

### 1. Change Super Admin Password
After first login, change the default password immediately.

### 2. Create Your First Tenant

As super admin:
1. Go to **Dashboard** → **Manage Tenants**
2. Click **Create New Tenant**
3. Fill in tenant details:
   - Tenant Name
   - Station Name
   - Email
   - Phone
   - Address
   
4. Create Tenant Admin Account:
   - Username
   - Email
   - Password
   - Full Name

### 3. Configure Station Settings

Login as tenant admin and configure:
- Electricity Rate (Rs/kWh)
- Monthly Staff Cost
- Monthly Rent
- Other Fixed Costs
- NEA Cost Rate

### 4. Start Recording Charging Sessions

1. Go to **Charging Sessions**
2. Click **New Session**
3. Enter:
   - Vehicle Number
   - Arrival SOC %
   - Departure SOC %
   - Rate per %
   - Charger Type (GBT 40kW / CCS2 80kW)
   - Payment Method (Cash / Bank-QR / Credit)

The system automatically calculates:
- Charged %
- kWh used
- Electricity cost
- Net contribution

## Project Structure

```
charging-management-system/
├── src/
│   ├── config/
│   │   └── database.ts          # Database configuration
│   ├── models/                  # Sequelize models
│   │   ├── Tenant.ts
│   │   ├── User.ts
│   │   ├── ChargingSession.ts
│   │   ├── Expense.ts
│   │   └── index.ts
│   ├── middleware/
│   │   └── auth.ts              # Authentication middleware
│   ├── utils/
│   │   ├── jwt.ts               # JWT utilities
│   │   └── calculations.ts      # Charging calculations
│   ├── pages/
│   │   ├── api/                 # API routes
│   │   │   ├── auth/
│   │   │   ├── tenants/
│   │   │   └── sessions/
│   │   ├── index.tsx            # Login page
│   │   ├── dashboard.tsx        # Main dashboard
│   │   └── _app.tsx
│   └── styles/
│       └── globals.css
├── scripts/
│   └── createSuperAdmin.js      # Setup script
├── .env                         # Environment variables
├── package.json
└── README.md
```

## Features Implemented

✅ Multi-tenant architecture
✅ Role-based access control (Super Admin, Tenant Admin, Operator)
✅ Tenant creation and management
✅ User authentication with JWT
✅ Charging session recording
✅ Automatic calculations (kWh, cost, profit)
✅ Payment tracking (Cash, Bank/QR, Credit)
✅ Visit number tracking per vehicle
✅ Responsive UI with Tailwind CSS

## Features To Be Implemented

📋 Complete dashboard with real-time statistics
📋 Vehicle history and reports
📋 Expense management
📋 Daily closing reports
📋 Monthly P&L statements
📋 Credit collection tracking
📋 Export to Excel/PDF
📋 Rate master configuration
📋 User management UI

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Tenants (Super Admin)
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create new tenant
- `GET /api/tenants/:id` - Get tenant details
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Deactivate tenant

### Charging Sessions
- `GET /api/sessions` - List sessions (tenant-specific)
- `POST /api/sessions` - Create new session
- Supports filtering by date range, vehicle number
- Automatic pagination

## Troubleshooting

### Database Connection Issues
- Verify Supabase project is active
- Check database password is correct
- Ensure your IP is allowed in Supabase (Settings → Database → Connection Pooling)

### Login Issues
- Ensure super admin was created successfully
- Check browser console for errors
- Verify JWT_SECRET is set in .env

### Module Not Found Errors
- Run `npm install` to install all dependencies
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

## Support

For issues or questions:
1. Check this guide first
2. Review the README.md
3. Check database connection and credentials
4. Ensure all dependencies are installed

## Database Schema

### tenants
- id, name, stationName, email, phone, address
- subscriptionStatus, subscriptionExpiry
- electricityRate, monthlyStaffCost, monthlyRent
- otherFixedCost, neaCostRate, defaultPaymentStatus

### users
- id, tenantId, username, email, password
- role (super_admin | tenant_admin | operator)
- fullName, isActive, lastLogin

### charging_sessions
- id, tenantId, date, time, vehicleNo
- arrivalSoc, departureSoc, chargedPercent
- ratePerPercent, chargeAmount, visitNo
- chargerType, paymentMethod, paymentStatus
- usedKwh, electricityRate, electricityCost
- netContribution, creditPaid, outstanding
- settlementMethod, settlementDate, companyBrand

### expenses
- id, tenantId, date, expenseType
- description, paymentMethod, amount
- paidTo, voucherRef, remarks

---

**Remember:** Always backup your database before making schema changes in production!
