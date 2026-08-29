import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from './config/database';
import { User } from './models/User';
import { Category } from './models/Category';
import { Supplier } from './models/Supplier';
import { Customer } from './models/Customer';
import { Product } from './models/Product';
import { ROLES } from './constants/roles';
import { CUSTOMER_TYPES, CUSTOMER_STATUSES } from './constants/statuses';

async function seed() {
  console.log('🌱 Connecting to MongoDB for seeding...');
  await connectDB();

  console.log('🧹 Clearing existing collections...');
  await User.deleteMany({});
  await Category.deleteMany({});
  await Supplier.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});

  const hashedPassword = await bcrypt.hash('Password@123', 10);

  // 1. Users
  await User.create({
    name: 'Admin User',
    email: 'admin@erp.com',
    password: hashedPassword,
    role: ROLES.ADMIN,
  });

  await User.create({
    name: 'Sales User',
    email: 'sales@erp.com',
    password: hashedPassword,
    role: ROLES.SALES,
  });

  const userWarehouse = await User.create({
    name: 'Warehouse Manager',
    email: 'warehouse@erp.com',
    password: hashedPassword,
    role: ROLES.WAREHOUSE,
  });

  await User.create({
    name: 'Accounts Manager',
    email: 'accounts@erp.com',
    password: hashedPassword,
    role: ROLES.ACCOUNTS,
  });

  console.log('✅ Users created');

  // 2. Categories
  const catElectronics = await Category.create({
    name: 'Electronics',
    description: 'Gadgets, devices, and accessories',
  });

  const catApparel = await Category.create({
    name: 'Apparel',
    description: 'Clothing and fashion garments',
  });

  const catOffice = await Category.create({
    name: 'Office Supplies',
    description: 'Stationery, paper, and desk items',
  });

  console.log('✅ Categories created');

  // 3. Suppliers
  const supplier1 = await Supplier.create({
    name: 'Apex Wholesalers',
    companyName: 'Apex Tech Pvt Ltd',
    mobile: '9876543210',
    email: 'contact@apex.com',
    gstNumber: '27ABCDE1234F1Z5',
    address: 'Plot 42, Industrial Area, Mumbai',
  });

  const supplier2 = await Supplier.create({
    name: 'Global Fabrics',
    companyName: 'Global Textiles Inc',
    mobile: '9876543211',
    email: 'info@globalfabrics.com',
    gstNumber: '27FGHIJ5678K1Z2',
    address: 'Textile Hub, Surat',
  });

  console.log('✅ Suppliers created');

  // 4. Customers
  await Customer.create({
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    mobile: '9123456789',
    type: CUSTOMER_TYPES.RETAIL,
    status: CUSTOMER_STATUSES.ACTIVE,
  });

  await Customer.create({
    name: 'Priya Patel',
    email: 'priya@acme.com',
    mobile: '9123456790',
    type: CUSTOMER_TYPES.WHOLESALE,
    status: CUSTOMER_STATUSES.ACTIVE,
    businessName: 'Acme Traders',
    gstNumber: '27LMNOP9012Q1Z8',
  });

  console.log('✅ Customers created');

  // 5. Products
  const productsData = [
    {
      name: 'Wireless Ergonomic Mouse',
      sku: 'ELEC-MOUSE-001',
      category: catElectronics.name,
      costPrice: 450,
      unitPrice: 799,
      sellingPrice: 799,
      gstRate: 18,
      currentStock: 45,
      minimumStock: 10,
      unit: 'pcs',
      warehouseLocation: 'Shelf A-1',
      supplier: supplier1._id,
    },
    {
      name: 'Mechanical Gaming Keyboard',
      sku: 'ELEC-KEYB-002',
      category: catElectronics.name,
      costPrice: 1800,
      unitPrice: 2999,
      sellingPrice: 2999,
      gstRate: 18,
      currentStock: 15,
      minimumStock: 5,
      unit: 'pcs',
      warehouseLocation: 'Shelf A-2',
      supplier: supplier1._id,
    },
    {
      name: 'Cotton Oxford Shirt (L)',
      sku: 'APP-SHIRT-001',
      category: catApparel.name,
      costPrice: 400,
      unitPrice: 1199,
      sellingPrice: 1199,
      gstRate: 5,
      currentStock: 30,
      minimumStock: 8,
      unit: 'pcs',
      warehouseLocation: 'Rack B-1',
      supplier: supplier2._id,
    },
    {
      name: 'A4 Printing Paper Ream (500 Sheets)',
      sku: 'OFF-PAPER-001',
      category: catOffice.name,
      costPrice: 180,
      unitPrice: 280,
      sellingPrice: 280,
      gstRate: 12,
      currentStock: 3,
      minimumStock: 10,
      unit: 'box',
      warehouseLocation: 'Rack B-5',
      supplier: supplier1._id,
    },
  ];

  for (const prod of productsData) {
    await Product.create({
      ...prod,
      createdBy: userWarehouse._id,
    });
  }

  console.log('✅ Products created');
  console.log('🎉 Seed completed successfully!');

  await disconnectDB();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
