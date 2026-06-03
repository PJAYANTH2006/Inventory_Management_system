# High-Precision Inventory & Order Management System

Welcome to the **AasaMedChem Inventory and Order Management System**. This application is a hackathon project built as a Next.js (App Router) system, using a Neon-hosted PostgreSQL database managed with Prisma ORM, designed to handle large-scale chemical inventory calculations with high-precision decimal operations and role-based routing access.

---

## Live URL
The application is deployed on Vercel at: **[https://inventory-management-system-medchem.vercel.app](https://inventory-management-system-medchem.vercel.app)** *(replace with actual Vercel URL once deployed)*

---

## 🌟 Tech Stack & System Architecture

The application is structured into three layers interacting in a server-client request lifecycle:

1.  **Frontend (Next.js - React Client Components)**:
    *   Responsive, dark glassmorphic dashboard interface built entirely using custom **Vanilla CSS** and global styling tokens.
    *   Equipped with real-time UI unit conversion previews, search filtering, and cart handlers that dynamically calculate pricing as the user types.
    *   Secured routing using Next.js client redirections and backend checks.
2.  **Backend (Next.js API Routes & Edge Middleware)**:
    *   Edge-compatible custom JWT Session authentication with credentials stored in secure `HttpOnly` cookies.
    *   Endpoint validation handlers (e.g. validating requested quantities against database stock levels, confirming dimension compatibility).
    *   Shared connection pooling utilizing PostgreSQL Pg client adapter for **Prisma 7**.
3.  **Database (Neon PostgreSQL & Prisma ORM)**:
    *   Hosted serverless PostgreSQL database on Neon.
    *   Managed through Prisma Client. All numeric quantity and pricing fields are modeled as high-precision decimals (`Decimal(28, 8)`) to preserve floating-point accuracy.

```
+------------------+         REST API (HttpOnly JWT Cookie)        +--------------------+
|  React Frontend  | <===========================================> |   Next.js API &    |
| (Dashboard/Cart) |                                               | Middleware Routing |
+------------------+                                               +--------------------+
                                                                             ||
                                                                       Prisma Client (v7)
                                                                             ||
                                                                             \/
                                                                   +--------------------+
                                                                   |  Neon PostgreSQL   |
                                                                   | (Decimal(28, 8))   |
                                                                   +--------------------+
```

---

## 📐 Unit Storage and Conversion Strategy

To prevent floating-point anomalies and conversion discrepancies, we enforce a strict, consistent internal storage and calculation model.

### 1. Internal Base Storage Units
Every product belongs to a specific **Dimension Group**. All inventory stock levels are stored internally in the database using the dimension's **Base Storage Unit**:

*   **WEIGHT**: Stored in **Grams (g)**.
*   **VOLUME**: Stored in **Milliliters (mL)**.
*   **COUNT**: Stored in **Items (count)**.

*Example*: If a product has a physical stock of 5 kilograms, the database stores the value `5000.00000000` (grams) in the `stock` field.

### 2. Base Conversion Factors
Our utility module `src/lib/units.ts` manages all conversions using conversion constants relative to the base unit:
*   `1 kg = 1000 g`
*   `1 L = 1000 mL`
*   `1 item = 1 item`

### 3. Price Storage
*   Prices and rates are stored as rates in INR relative to a **Price Unit** defined per product.
*   *Example*: A solvent can be priced at ₹150.00 per Liter (`L`), while a reagent can be priced at ₹45.00 per Kilogram (`kg`). The database stores:
    *   `price`: `150.00000000`
    *   `priceUnit`: `'L'`
    *   `dimension`: `'VOLUME'`

### 4. Pricing Calculations & Verification Flow
When a user selects an ordering unit (e.g., ordering `g` when the base pricing is set in `kg`), the system applies conversions using the **Base Storage Unit** as the mathematical intermediate. This ensures maximum consistency:

$$\text{Price} = \text{Ordered Quantity (in base units)} \times \frac{\text{Pricing Rate}}{\text{Pricing Unit Size (in base units)}}$$

**Mathematical Step-by-Step Example (Order 500g of a product priced at ₹200.00/kg)**:
1.  **Convert ordered quantity to base unit**: $500 \text{ g} \times 1 = 500 \text{ g}$ base.
2.  **Calculate pricing unit size in base**: $1 \text{ kg} \times 1000 = 1000 \text{ g}$ base.
3.  **Compute rate per base unit**: $\frac{₹200.00}{1000 \text{ g}} = ₹0.20 \text{ per gram}$.
4.  **Calculate total price**: $500 \text{ g} \times ₹0.20 \text{ per gram} = ₹100.00$.

### 5. Conversion Locations
*   **Frontend**: Handled inside `src/app/seller/page.tsx` on input change. Shows a live audit breakdown detailing the converted quantities and rate calculations as the user drafts their order.
*   **Backend Validation**: Handled in `/api/orders` POST. The server re-evaluates the mathematical conversion using `src/lib/units.ts`, validates stock, and executes a database transaction to decrement inventory and create order records atomically.
*   **Admin Audit**: Handled in `/admin/page.tsx`. Admin cards show the full audit breakdown: the seller's original choice, the converted base unit subtraction, and the price calculation formula.

---

## 💾 Database Schema

Here is a summary of the schema defined in [schema.prisma](file:///c:/Users/ASUS/OneDrive/Desktop/Inventory_management/prisma/schema.prisma):

### 1. `User` Table
Stores login credentials, roles, and profiles.
*   `id` (`String`, UUID Primary Key)
*   `email` (`String`, Unique)
*   `passwordHash` (`String`)
*   `name` (`String`)
*   `role` (`Role` Enum: `ADMIN`, `SELLER`)

### 2. `Product` Table
Stores inventory levels, base pricing, and dimension groups.
*   `id` (`String`, UUID Primary Key)
*   `name` (`String`)
*   `sku` (`String`, Unique)
*   `description` (`String?`)
*   `category` (`String?`)
*   `dimension` (`Dimension` Enum: `WEIGHT`, `VOLUME`, `COUNT`)
*   `stock` (`Decimal(28, 8)`) - Stored in grams, milliliters, or items.
*   `price` (`Decimal(28, 8)`) - Rate amount in INR.
*   `priceUnit` (`Unit` Enum: `g`, `kg`, `mL`, `L`, `items`)
*   `minStockAlert` (`Decimal(28, 8)`) - Threshold count in base unit.

### 3. `Order` Table
Stores quotation records.
*   `id` (`String`, UUID Primary Key)
*   `userId` (`String`, Foreign Key to User)
*   `status` (`OrderStatus` Enum: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`)
*   `totalPrice` (`Decimal(28, 8)`)

### 4. `OrderItem` Table
Stores snapshot details of items in a quotation.
*   `id` (`String`, UUID Primary Key)
*   `orderId` (`String`, Foreign Key to Order, Cascade Delete)
*   `productId` (`String`, Foreign Key to Product)
*   `orderedQuantity` (`Decimal(28, 8)`) - Original quantity input by user.
*   `orderedUnit` (`Unit` Enum) - Original unit chosen by user.
*   `baseQuantity` (`Decimal(28, 8)`) - Converted base unit count for inventory check.
*   `priceAtOrder` (`Decimal(28, 8)`) - Price rate snapshot.
*   `priceUnitAtOrder` (`Unit` Enum)
*   `calculatedPrice` (`Decimal(28, 8)`) - Final computed item cost in INR.

---

## 🛠️ Local Setup Instructions

Follow these steps to run the application on your local machine:

### Prerequisite: Node.js & Neon DB
Ensure you have **Node.js (v20+)** and a PostgreSQL database connection string (preferably from [Neon](https://neon.tech)).

### 1. Clone the repository
```bash
git clone https://github.com/PJAYANTH2006/Inventory_Management_system.git
cd Inventory_Management_system
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file in the root of the project:
```env
# Your Neon PostgreSQL connection string (for Prisma 7 migrations and runtime)
DATABASE_URL="postgres://[username]:[password]@[neon-host]/[db-name]?sslmode=require"

# Any secure random string (minimum 32 characters recommended)
JWT_SECRET="YOUR_SECRET_JWT_KEY_HERE"
```

### 4. Apply migrations and generate client
Generate the Prisma 7 client and push the schema directly to your database:
```bash
npx prisma generate
npx prisma db push
```

### 5. Seed the database
Populate the database with demo users and products:
```bash
npx prisma db seed
```

### 6. Start the development server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Demo Login Credentials

The seeder populates two testing accounts with distinct dashboard access:

### 1. Admin Portal
*   **Email**: `admin@aasamedchem.com`
*   **Password**: `admin123`
*   **Capabilities**: Manage products (Create, Edit, Delete), view stock levels and highlight warnings below limits, view incoming orders, and click **Approve** (commits stock deduction) or **Reject** (refunds stock).

### 2. Seller Portal
*   **Email**: `seller@aasamedchem.com`
*   **Password**: `seller123`
*   **Capabilities**: Search/filter items, place orders by choosing any unit, view real-time pricing conversions, and track order status history.

---

## 🚀 Deployment on Vercel

To deploy or redeploy this project on Vercel:

1.  **Configure environment variables** in the Vercel Dashboard project settings:
    *   Add `DATABASE_URL` with your Neon connection string.
    *   Add `JWT_SECRET` with your session secret.
2.  **Add a postinstall command** in `package.json` scripts if needed so Vercel builds the Prisma Client during deployment:
    *   Make sure `"postinstall": "prisma generate"` is in `package.json` `"scripts"` (this ensures client is available to the serverless build environment).
3.  Deploy using Git integration (automatic on pushes to `main`) or through the CLI:
    ```bash
    npm install -g vercel
    vercel --prod
    ```
