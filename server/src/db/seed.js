import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';
import { initializeDatabase } from './init.js';

export async function seedDatabase() {
  await initializeDatabase();

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Reset existing rows cleanly for repeatable seeding
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE Orders');
    await connection.query('TRUNCATE TABLE Messages');
    await connection.query('TRUNCATE TABLE Negotiations');
    await connection.query('TRUNCATE TABLE Crops');
    await connection.query('TRUNCATE TABLE BazaarPrices');
    await connection.query('TRUNCATE TABLE Users');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    const defaultPasswordHash = await bcrypt.hash('Khamari@123', 10);

    // 1. Seed Users: 2 Farmers, 2 Wholesale Buyers, 1 Local Bazaar Committee Verifier
    const users = [
      [
        'Abdur Rahim Mondol',
        'rahim@khamari.local',
        '+8801711000001',
        defaultPasswordHash,
        'FARMER',
        'Mondol Krishi Khamar',
        'Bogura',
        true,
      ],
      [
        'Karim Uddin Bepari',
        'karim@khamari.local',
        '+8801711000002',
        defaultPasswordHash,
        'FARMER',
        'Padma Agro Harvest',
        'Rajshahi',
        true,
      ],
      [
        'Tariqul Islam Chowdhury',
        'buyer1@khamari.local',
        '+8801811000003',
        defaultPasswordHash,
        'BUYER',
        'Karwan Bazar Agro Wholesale',
        'Dhaka - Karwan Bazar',
        true,
      ],
      [
        'Nadia Rahman',
        'buyer2@khamari.local',
        '+8801811000004',
        defaultPasswordHash,
        'BUYER',
        'Dhaka Metro Wholesale & Mess Supply',
        'Dhaka - Mohakhali',
        true,
      ],
      [
        'Haji Shamsul Haque',
        'verifier@khamari.local',
        '+8801911000005',
        defaultPasswordHash,
        'BAZAAR_COMMITTEE',
        'Bogura & Regional Bazaar Price Committee',
        'Bogura',
        true,
      ],
    ];

    const userIds = {};
    for (const u of users) {
      const [res] = await connection.execute(
        `INSERT INTO Users (
           full_name, email, phone, password_hash, role, organization_name, region, is_verified
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        u
      );
      userIds[u[1]] = res.insertId;
    }

    const verifierId = userIds['verifier@khamari.local'];
    const farmer1Id = userIds['rahim@khamari.local'];
    const farmer2Id = userIds['karim@khamari.local'];
    const buyer1Id = userIds['buyer1@khamari.local'];
    const buyer2Id = userIds['buyer2@khamari.local'];

    const today = new Date().toISOString().slice(0, 10);

    // 2. Seed Daily Bazaar Baseline Commodity Prices
    const bazaarPrices = [
      [
        'Potato (Diamond)',
        'Bogura',
        'KG',
        24.0,
        27.0,
        30.0,
        verifierId,
        today,
        'Peak winter harvest arrival; strong cold-storage quality.',
      ],
      [
        'Onion (Deshi)',
        'Rajshahi',
        'KG',
        62.0,
        68.0,
        74.0,
        verifierId,
        today,
        'Dry cured deshi bulbs verified at Rajshahi wholesale yard.',
      ],
      [
        'Miniket Rice',
        'Bogura',
        'KG',
        58.0,
        62.0,
        66.0,
        verifierId,
        today,
        'Mill-polished grade A Miniket wholesale corridor.',
      ],
      [
        'Tomato (Deshi)',
        'Rajshahi',
        'KG',
        35.0,
        40.0,
        46.0,
        verifierId,
        today,
        'Fresh vine-ripened crates; moderate supply today.',
      ],
    ];

    const priceIds = {};
    for (const bp of bazaarPrices) {
      const [res] = await connection.execute(
        `INSERT INTO BazaarPrices (
           crop_category, bazaar_region, unit, min_price, modal_price, max_price,
           verified_by, effective_date, market_notes
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        bp
      );
      priceIds[bp[0]] = res.insertId;
    }

    // 3. Seed Active Crop Listings with harvest dates, quantities, and fair-price indicators
    const crops = [
      [
        farmer1Id,
        priceIds['Potato (Diamond)'],
        'Bogura Fresh Diamond Potatoes (Grade A)',
        'Potato (Diamond)',
        'Diamond',
        'Bogura',
        2500.0,
        50.0,
        'KG',
        27.0,
        500.0,
        5.0,
        today,
        'GRADE_A',
        'AVAILABLE',
      ],
      [
        farmer1Id,
        priceIds['Miniket Rice'],
        'Bogura Parboiled Miniket Rice (50 KG Sacks)',
        'Miniket Rice',
        'BRRI-28 Miniket',
        'Bogura',
        4000.0,
        100.0,
        'KG',
        61.5,
        1000.0,
        4.0,
        today,
        'GRADE_A',
        'AVAILABLE',
      ],
      [
        farmer2Id,
        priceIds['Onion (Deshi)'],
        'Rajshahi Sun-Cured Deshi Onions',
        'Onion (Deshi)',
        'Taherpuri',
        'Rajshahi',
        1800.0,
        50.0,
        'KG',
        67.0,
        400.0,
        6.0,
        today,
        'GRADE_A',
        'AVAILABLE',
      ],
      [
        farmer2Id,
        priceIds['Tomato (Deshi)'],
        'Rajshahi Farm-Fresh Deshi Tomatoes',
        'Tomato (Deshi)',
        'Ratan',
        'Rajshahi',
        1200.0,
        40.0,
        'KG',
        39.0,
        300.0,
        5.0,
        today,
        'GRADE_B',
        'AVAILABLE',
      ],
    ];

    const cropIds = {};
    for (const c of crops) {
      const [res] = await connection.execute(
        `INSERT INTO Crops (
           farmer_id, bazaar_price_id, title, crop_category, variety, bazaar_region,
           quantity_available, min_order_quantity, unit, base_price_per_unit,
           bulk_threshold_qty, bulk_discount_pct, harvest_date, quality_grade, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c
      );
      cropIds[c[3]] = res.insertId;
    }

    // 4. Seed one active Negotiation + initial Messages
    const [negRes] = await connection.execute(
      `INSERT INTO Negotiations (
         crop_id, buyer_id, farmer_id, requested_quantity, current_offer_price,
         last_offered_by, status
       ) VALUES (?, ?, ?, ?, ?, 'BUYER', 'OPEN')`,
      [cropIds['Potato (Diamond)'], buyer1Id, farmer1Id, 600.0, 26.0]
    );
    const negotiationId = negRes.insertId;

    await connection.execute(
      `INSERT INTO Messages (
         negotiation_id, sender_id, message_type, content, offered_unit_price, offered_quantity
       ) VALUES (?, ?, 'BID_OFFER', ?, ?, ?)`,
      [
        negotiationId,
        buyer1Id,
        'Interested in 600 KG of Bogura Diamond Potatoes at ৳26/KG for immediate dispatch.',
        26.0,
        600.0,
      ]
    );

    await connection.execute(
      `INSERT INTO Messages (
         negotiation_id, sender_id, message_type, content
       ) VALUES (?, ?, 'TEXT', ?)`,
      [
        negotiationId,
        farmer1Id,
        'Freshly graded batch is ready at the Bogura collection point. Can discuss transport pickup.',
      ]
    );

    // 5. Seed one completed sample Order for receipt inspection
    await connection.execute(
      `INSERT INTO Orders (
         receipt_number, crop_id, negotiation_id, buyer_id, farmer_id,
         quantity_ordered, unit, unit_price_agreed, subtotal_amount,
         discount_amount, total_amount, pricing_strategy_used,
         receipt_type, payment_status, order_status, delivery_address
       ) VALUES (?, ?, NULL, ?, ?, ?, 'KG', ?, ?, ?, ?, ?, ?, 'ESCROW_HELD', 'CONFIRMED', ?)`,
      [
        'KHM-20261115-10001',
        cropIds['Onion (Deshi)'],
        buyer2Id,
        farmer2Id,
        500.0,
        67.0,
        33500.0,
        2010.0,
        31490.0,
        'BULK_TIER_DISCOUNT',
        'BAZAAR_CERTIFIED',
        'Mohakhali Central Wholesale Shed 4, Dhaka',
      ]
    );

    await connection.commit();

    console.log('[Seed] Successfully seeded Khamari database:');
    console.log('  - Users: 2 Farmers, 2 Wholesale Buyers, 1 Bazaar Committee Verifier (password: Khamari@123)');
    console.log('  - BazaarPrices: 4 verified commodities (Potato, Onion, Miniket Rice, Tomato)');
    console.log('  - Crops: 4 active harvest listings with fair-price benchmarks');
    console.log('  - Negotiations & Orders: 1 active negotiation room, 1 sample certified order');
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Failed:', err.message);
      await pool.end();
      process.exit(1);
    });
}
