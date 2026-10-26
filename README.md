# EV Charging Station Management System

A comprehensive Next.js-based multi-tenant EV charging station management system with Supabase PostgreSQL and Sequelize ORM.

## Features

- 🔐 **Multi-tenant Architecture**: Super admin can create and manage multiple charging station tenants
- 👥 **Role-based Access Control**: Super Admin, Tenant Admin, and Operator roles
- ⚡ **Charging Session Management**: Record and track charging sessions with automatic calculations
- 💰 **Financial Tracking**: Revenue, expenses, and profit/loss reporting
- 📊 **Analytics Dashboard**: Real-time KPIs and performance metrics
- 🚗 **Vehicle Management**: Track repeat visits and vehicle charging history
- 💳 **Payment Methods**: Cash, Bank/QR, and Credit with outstanding tracking

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Sequelize
- **Authentication**: JWT, bcryptjs

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase account)
- npm or yarn package manager

## Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd charging-management-system
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and update with your Supabase credentials:

```bash
DATABASE_URL=postgresql://postgres:Yugesh%40123%23@db.sgisuubdfafpmhhdfpse.supabase.co:5432/postgres

DB_HOST=db.sgisuubdfafpmhhdfpse.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=Yugesh@123#

JWT_SECRET=your-secret-key-change-this-in-production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Initialize database and create super admin**

```bash
npm run create:superadmin
```

This will:
- Create all necessary database tables
- Create a super admin account with credentials:
  - Username: `superadmin`
  - Password: `Admin@123`

5. **Start development server**

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Database Schema

### Tables

1. **tenants** - Charging station tenants
   - Station information, settings, subscription status
   
2. **users** - System users
   - Authentication, roles, tenant association
   
3. **charging_sessions** - Charging records
   - SOC levels, rates, payments, electricity consumption
   
4. **expenses** - Station expenses
   - NEA bills, staff costs, rent, etc.

## User Roles

### Super Admin
- Create and manage tenants
- View all tenant data
- System-wide configuration

### Tenant Admin
- Manage their station's data
- Create operator accounts
- Configure station settings
- View reports and analytics

### Operator
- Record charging sessions
- View session history
- Limited access to reports

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Tenants (Super Admin only)
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create new tenant
- `GET /api/tenants/:id` - Get tenant details
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Deactivate tenant

### Charging Sessions
- `GET /api/sessions` - List sessions (filtered by tenant)
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `PUT /api/sessions/:id` - Update session

## Usage

### First Login

1. Navigate to `http://localhost:3000`
2. Login with:
   - Username: `superadmin`
   - Password: `Admin@123`
3. **Change the password immediately after first login**

### Creating a Tenant

1. Login as super admin
2. Go to "Manage Tenants"
3. Click "Create New Tenant"
4. Fill in:
   - Tenant name and station details
   - Admin user credentials
5. The tenant admin can now login and manage their station

### Recording a Charging Session

1. Login as tenant admin or operator
2. Go to "Charging Sessions"
3. Click "New Session"
4. Enter:
   - Vehicle number
   - Arrival and departure SOC %
   - Rate per %
   - Charger type (GBT/CCS2)
   - Payment method
5. System automatically calculates:
   - Charged %
   - Charge amount
   - kWh used
   - Electricity cost
   - Net contribution

## Automatic Calculations

The system automatically calculates:
- **Charged %** = Departure SOC - Arrival SOC
- **Charge Amount** = Charged % × Rate per %
- **Used kWh** = (Charged % × Battery Capacity) / 100
- **Electricity Cost** = Used kWh × Electricity Rate
- **Net Contribution** = Charge Amount - Electricity Cost
- **Outstanding** = Charge Amount - Credit Paid (for credit transactions)

## Build for Production

```bash
npm run build
npm start
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run create:superadmin` - Create super admin (run once)

## Security Notes

1. Change the JWT_SECRET in production
2. Update super admin password after first login
3. Use HTTPS in production
4. Keep database credentials secure
5. Regularly backup your database

## Support

For issues or questions, please refer to the documentation or contact support.

## License

ISC
# chargiing-station
