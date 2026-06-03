const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  // Hash passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const sellerPasswordHash = await bcrypt.hash('seller123', 10);

  // Create Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@aasamedchem.com',
      name: 'Admin User',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const seller = await prisma.user.create({
    data: {
      email: 'seller@aasamedchem.com',
      name: 'John Seller',
      passwordHash: sellerPasswordHash,
      role: 'SELLER',
    },
  });

  console.log(`Created users: Admin (${admin.email}), Seller (${seller.email})`);

  // Create Products
  const products = [
    {
      name: 'Ethanol (Absolute)',
      sku: 'SOL-ETH-001',
      description: 'High purity analytical grade ethanol.',
      category: 'Solvents',
      dimension: 'VOLUME',
      stock: 50000.00000000, // 50 Liters stored in mL
      price: 150.00000000,    // 150 INR
      priceUnit: 'L',         // per Liter
      minStockAlert: 10000.00000000, // 10 L alert
    },
    {
      name: 'Acetone',
      sku: 'SOL-ACE-002',
      description: 'Industrial and lab grade cleaning solvent.',
      category: 'Solvents',
      dimension: 'VOLUME',
      stock: 20000.00000000, // 20 Liters stored in mL
      price: 180.00000000,    // 180 INR
      priceUnit: 'L',         // per Liter
      minStockAlert: 5000.00000000,
    },
    {
      name: 'Sodium Chloride',
      sku: 'REA-NAC-001',
      description: 'Reagent grade NaCl for laboratory applications.',
      category: 'Reagents',
      dimension: 'WEIGHT',
      stock: 25000.00000000, // 25 kg stored in grams
      price: 45.00000000,     // 45 INR
      priceUnit: 'kg',        // per kg
      minStockAlert: 5000.00000000,
    },
    {
      name: 'Aspirin Powder (Acetylsalicylic Acid)',
      sku: 'API-ASP-002',
      description: 'API grade Aspirin powder for pharmaceutical formulation.',
      category: 'Active Pharmaceutical Ingredients',
      dimension: 'WEIGHT',
      stock: 2000.00000000,  // 2 kg stored in grams
      price: 750.00000000,    // 750 INR
      priceUnit: 'kg',        // per kg
      minStockAlert: 500.00000000,
    },
    {
      name: 'Borosilicate Glass Beakers (250mL)',
      sku: 'LAB-BEA-250',
      description: 'Heat resistant borosilicate glass beakers with graduations.',
      category: 'Labware',
      dimension: 'COUNT',
      stock: 120.00000000,   // 120 items
      price: 199.00000000,    // 199 INR
      priceUnit: 'items',     // per item
      minStockAlert: 20.00000000,
    },
    {
      name: 'Digital Magnetic Stirrer with Hotplate',
      sku: 'EQP-MAG-STR',
      description: 'Lab hotplate magnetic stirrer with speed range 100-1500 RPM.',
      category: 'Lab Equipment',
      dimension: 'COUNT',
      stock: 12.00000000,    // 12 items
      price: 4500.00000000,   // 4500 INR
      priceUnit: 'items',     // per item
      minStockAlert: 2.00000000,
    },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }

  console.log(`Successfully seeded ${products.length} products!`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
