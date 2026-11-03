import sequelize from '../config/database';
import Tenant from './Tenant';
import User from './User';
import ChargingSession from './ChargingSession';
import Expense from './Expense';
import Vehicle from './Vehicle';
import VehicleQueue from './VehicleQueue';
import ChargerCategory from './ChargerCategory';
import Charger from './Charger';

// Define associations
User.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(User, { foreignKey: 'tenantId', as: 'users' });

ChargingSession.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(ChargingSession, { foreignKey: 'tenantId', as: 'chargingSessions' });

Expense.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(Expense, { foreignKey: 'tenantId', as: 'expenses' });

Vehicle.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(Vehicle, { foreignKey: 'tenantId', as: 'vehicles' });

// VehicleQueue associations
VehicleQueue.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(VehicleQueue, { foreignKey: 'tenantId', as: 'queueEntries' });

VehicleQueue.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
Vehicle.hasMany(VehicleQueue, { foreignKey: 'vehicleId', as: 'queueHistory' });

VehicleQueue.belongsTo(ChargingSession, { foreignKey: 'chargingSessionId', as: 'chargingSession' });
ChargingSession.hasOne(VehicleQueue, { foreignKey: 'chargingSessionId', as: 'queueEntry' });

// Staff tracking associations
VehicleQueue.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
VehicleQueue.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });
VehicleQueue.belongsTo(User, { foreignKey: 'calledBy', as: 'caller' });
VehicleQueue.belongsTo(User, { foreignKey: 'assignedBy', as: 'assigner' });
VehicleQueue.belongsTo(User, { foreignKey: 'cancelledBy', as: 'canceller' });

// ChargerCategory associations
ChargerCategory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(ChargerCategory, { foreignKey: 'tenantId', as: 'chargerCategories' });

// Charger associations
Charger.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(Charger, { foreignKey: 'tenantId', as: 'chargers' });

Charger.belongsTo(ChargerCategory, { foreignKey: 'categoryId', as: 'category' });
ChargerCategory.hasMany(Charger, { foreignKey: 'categoryId', as: 'chargers' });

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

export { 
  sequelize, 
  Tenant, 
  User, 
  ChargingSession, 
  Expense, 
  Vehicle, 
  VehicleQueue,
  ChargerCategory,
  Charger
};
