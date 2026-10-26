import sequelize from '../config/database';
import Tenant from './Tenant';
import User from './User';
import ChargingSession from './ChargingSession';
import Expense from './Expense';

// Define associations
User.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(User, { foreignKey: 'tenantId', as: 'users' });

ChargingSession.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(ChargingSession, { foreignKey: 'tenantId', as: 'chargingSessions' });

Expense.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(Expense, { foreignKey: 'tenantId', as: 'expenses' });

// Sync database
export const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Create tables if they don't exist
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

export { sequelize, Tenant, User, ChargingSession, Expense };
