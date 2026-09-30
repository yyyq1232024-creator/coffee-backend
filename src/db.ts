import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import mysql from "mysql2/promise";
import { User, Order, UserRole, UserStatus, PrintJob } from "./types.ts";

export interface StoredUser extends User {
  salt: string;
  passwordHash: string;
}

interface JsonDatabase {
  users: StoredUser[];
  orders: Order[];
  printJobs?: PrintJob[];
}

const packageJsonPath = process.env.npm_package_json;
const projectRoot = packageJsonPath
  ? path.dirname(path.resolve(packageJsonPath))
  : process.cwd();
const DB_FILE_PATH = process.env.COFFEE_DB_FILE
  ? path.resolve(process.env.COFFEE_DB_FILE)
  : path.join(projectRoot, "coffee-shop-db.json");
const LEGACY_DB_FILE_PATH = path.join(projectRoot, "users-db.json");

// Database state indicators
export let useMySQL = false;
export let mysqlPool: mysql.Pool | null = null;

// Password hashing helper matching previous implementation
export function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

export function normalizeUsername(username: string): string {
  return username.trim().normalize("NFKC");
}

export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}

// Read JSON database from file (for fallback offline mode)
async function readJsonDb(): Promise<JsonDatabase> {
  try {
    const data = await fs.readFile(DB_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    // If file doesn't exist, return empty structure
    return { users: [], orders: [] };
  }
}

// Write JSON database to file
async function writeJsonDb(db: JsonDatabase): Promise<void> {
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
}

async function readStoredUsersFile(filePath: string): Promise<StoredUser[]> {
  try {
    const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
    const users = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
    return users.filter((user: StoredUser) =>
      Boolean(
        user?.id &&
        user?.username &&
        user?.email &&
        user?.salt &&
        /^[a-f0-9]{64}$/i.test(user?.passwordHash || "")
      )
    );
  } catch {
    return [];
  }
}

// Setup relational schema & pre-seed tables
export async function initSqliteDb(): Promise<void> {
  console.log("🔍 [Database Hub] Checking configuration options...");

  const dbHost = process.env.DB_HOST;
  
  if (dbHost) {
    console.log(`💡 Found DB_HOST "${dbHost}". Attempting to connect to MySQL database server...`);
    try {
      const dbUser = process.env.DB_USER || "root";
      const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "";
      const dbPort = Number(process.env.DB_PORT) || 3306;
      const dbName = process.env.DB_NAME || "coffee_shop";

      // 1. Establish initial connection with general host first, guaranteeing that schema is created beforehand if lack thereof
      const preConnection = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        port: dbPort,
      });

      console.log(`🔨 Check database exists: "CREATE DATABASE IF NOT EXISTS ${dbName}"`);
      await preConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await preConnection.end();

      // 2. Set up high performance database connection pool
      mysqlPool = mysql.createPool({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        port: dbPort,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Test active ping
      const connectionTest = await mysqlPool.getConnection();
      console.log("🚀 MySQL relational connection verified successfully!");
      connectionTest.release();

      useMySQL = true;

      // 3. Setup core tables using pure standard schema format
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          role VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          bio TEXT,
          createdAt VARCHAR(255) NOT NULL,
          salt VARCHAR(255) NOT NULL,
          passwordHash VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(255) PRIMARY KEY,
          buyerName VARCHAR(255) NOT NULL,
          buyerUsername VARCHAR(255) NOT NULL,
          totalPrice DOUBLE NOT NULL,
          orderTime VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id VARCHAR(255) PRIMARY KEY,
          orderId VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          price DOUBLE NOT NULL,
          size VARCHAR(255) NOT NULL,
          sugar VARCHAR(255) NOT NULL,
          milk VARCHAR(255) NOT NULL,
          temp VARCHAR(255) NOT NULL,
          notes TEXT,
          img VARCHAR(1000),
          FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS print_jobs (
          id VARCHAR(255) PRIMARY KEY,
          orderId VARCHAR(255),
          ownerUserId VARCHAR(255),
          buyerName VARCHAR(255) NOT NULL,
          buyerUsername VARCHAR(255) NOT NULL,
          totalPrice DOUBLE NOT NULL,
          timestamp VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS print_job_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          printJobId VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          price DOUBLE NOT NULL,
          size VARCHAR(255) NOT NULL,
          sugar VARCHAR(255) NOT NULL,
          milk VARCHAR(255) NOT NULL,
          temp VARCHAR(255) NOT NULL,
          notes TEXT,
          FOREIGN KEY (printJobId) REFERENCES print_jobs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [printJobOwnerColumns]: [any[], any] = await mysqlPool.query(
        "SHOW COLUMNS FROM print_jobs LIKE 'ownerUserId'"
      );
      if (printJobOwnerColumns.length === 0) {
        await mysqlPool.query(
          "ALTER TABLE print_jobs ADD COLUMN ownerUserId VARCHAR(255) NULL AFTER orderId"
        );
      }

      // Usernames are deliberately case-sensitive. Keep legacy databases aligned.
      await mysqlPool.query(
        "ALTER TABLE users MODIFY username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL"
      );

      // Accounts may have been created while MySQL was temporarily offline,
      // in which case older versions wrote them to a local JSON fallback.
      // Import only missing identities and never overwrite a MySQL password.
      const localUsers = [
        ...await readStoredUsersFile(DB_FILE_PATH),
        ...await readStoredUsersFile(LEGACY_DB_FILE_PATH),
      ];
      let importedUserCount = 0;

      for (const localUser of localUsers) {
        const username = normalizeUsername(localUser.username);
        const email = normalizeEmail(localUser.email);
        const [identityRows]: [any[], any] = await mysqlPool.query(
          "SELECT id FROM users WHERE BINARY username = BINARY ? OR LOWER(email) = LOWER(?) LIMIT 1",
          [username, email]
        );
        if (identityRows.length > 0) continue;

        const [idRows]: [any[], any] = await mysqlPool.query(
          "SELECT id FROM users WHERE id = ? LIMIT 1",
          [localUser.id]
        );
        const importedId = idRows.length > 0
          ? "user-id-" + crypto.randomBytes(8).toString("hex")
          : localUser.id;

        await mysqlPool.query(
          `INSERT INTO users (id, username, name, email, role, status, bio, createdAt, salt, passwordHash)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            importedId,
            username,
            localUser.name || username,
            email,
            localUser.role === "admin" ? "admin" : "user",
            localUser.status === "suspended" ? "suspended" : "active",
            localUser.bio || "",
            localUser.createdAt || new Date().toISOString(),
            localUser.salt,
            localUser.passwordHash,
          ]
        );
        importedUserCount += 1;
      }

      if (importedUserCount > 0) {
        console.log(`🔄 Migrated ${importedUserCount} local account(s) into MySQL.`);
      }

      // 4. Prepopulate database users if empty
      const [userCountRows]: [any[], any] = await mysqlPool.query("SELECT COUNT(*) as count FROM users");
      const userCount = userCountRows[0]?.count || 0;
      if (userCount === 0) {
        console.log("🌱 Pre-seeding MySQL users database...");
        const seedUsers = [
          {
            id: "admin-id-1",
            username: "admin",
            name: "系统管理员",
            email: "admin@example.com",
            role: "admin" as UserRole,
            status: "active" as UserStatus,
            bio: "系统最高管理员，拥有全部权属和CRUD编辑功能。",
            createdAt: new Date().toISOString(),
            password: "adminpassword"
          },
          {
            id: "user-id-alice",
            username: "alice",
            name: "爱丽丝",
            email: "alice@example.com",
            role: "user" as UserRole,
            status: "active" as UserStatus,
            bio: "手冲咖啡发烧友，极简主义界面设计师。",
            createdAt: new Date().toISOString(),
            password: "password123"
          },
          {
            id: "user-id-bob",
            username: "bob",
            name: "鲍勃",
            email: "bob@example.com",
            role: "user" as UserRole,
            status: "active" as UserStatus,
            bio: "专注于React and Node.js之全栈资深发烧友。",
            createdAt: new Date().toISOString(),
            password: "password123"
          }
        ];

        for (const u of seedUsers) {
          const salt = crypto.randomBytes(16).toString("hex");
          const passwordHash = hashPassword(u.password, salt);
          await mysqlPool.query(
            `INSERT INTO users (id, username, name, email, role, status, bio, createdAt, salt, passwordHash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [u.id, u.username, u.name, u.email, u.role, u.status, u.bio, u.createdAt, salt, passwordHash]
          );
        }
      }

      // 5. Prepopulate database orders if empty
      const [orderCountRows]: [any[], any] = await mysqlPool.query("SELECT COUNT(*) as count FROM orders");
      const orderCount = orderCountRows[0]?.count || 0;
      if (orderCount === 0) {
        console.log("🌱 Pre-seeding MySQL orders database...");
        const dates = [
          new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        ];

        const seedOrders = [
          {
            id: "ord-1",
            buyerName: "爱丽丝",
            buyerUsername: "alice",
            totalPrice: 68,
            orderTime: dates[0],
            type: "dine-in" as const,
            items: [
              { id: "itm-1", name: "★独家手作★ 耶加雪菲 · 阳光日晒", price: 38, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "香浓冰鲜牛奶", temp: "少冰 (少冰爽口)", notes: "请附打包纸架", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" },
              { id: "itm-2", name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态", notes: "", img: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?q=80&w=734&auto=format&fit=crop" }
            ]
          },
          {
            id: "ord-2",
            buyerName: "鲍勃",
            buyerUsername: "bob",
            totalPrice: 52,
            orderTime: dates[1],
            type: "take-away" as const,
            items: [
              { id: "itm-3", name: "香醇生椰乳拿铁", price: 24, size: "大杯的大口满足 (Large)", sugar: "半糖 (半糖恰到合适)", milk: "生椰厚醇乳 (椰丝清香)", temp: "常温状态", notes: "多去冰", img: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=687&auto=format&fit=crop" },
              { id: "itm-4", name: "京都静冈宇治抹茶慕斯", price: 28, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "标准温饮", notes: "", img: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?q=80&w=735&auto=format&fit=crop" }
            ]
          },
          {
            id: "ord-3",
            buyerName: "莫奈的调色盘",
            buyerUsername: "guest",
            totalPrice: 28,
            orderTime: dates[2],
            type: "dine-in" as const,
            items: [
              { id: "itm-5", name: "冰燕麦拿铁 · 低卡臻选", price: 28, size: "超大杯的饱满爽口 (Venti)", sugar: "三分糖 (微甜微醇)", milk: "低脂燕麦奶 (谷物浓郁)", temp: "少冰 (少冰爽口)", notes: "燕麦奶加量", img: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=684&auto=format&fit=crop" }
            ]
          },
          {
            id: "ord-4",
            buyerName: "微风过境",
            buyerUsername: "guest",
            totalPrice: 108,
            orderTime: dates[3],
            type: "dine-in" as const,
            items: [
              { id: "itm-6", name: "★独家手作★ 瑰夏之梦 · 大堂殿堂极配", price: 78, size: "大杯的大口满足 (Large)", sugar: "天然零蔗木糖纯素 (0%)", milk: "不含乳产品 (黑美式)", temp: "标准热饮 (最醇厚香气)", notes: "手冲精心冲滤", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" },
              { id: "itm-7", name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态", notes: "", img: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?q=80&w=734&auto=format&fit=crop" }
            ]
          },
          {
            id: "ord-5",
            buyerName: "不加糖的日常",
            buyerUsername: "guest",
            totalPrice: 18,
            orderTime: dates[4],
            type: "take-away" as const,
            items: [
              { id: "itm-8", name: "经典美式咖啡 · 意式原豆", price: 18, size: "中杯的轻盈体验 (Medium)", sugar: "天然零蔗木糖纯素 (0%)", milk: "不含乳产品 (黑美式)", temp: "常温状态", notes: "常温不加糖", img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=687&auto=format&fit=crop" }
            ]
          },
          {
            id: "ord-6",
            buyerName: "独立开发者小陈",
            buyerUsername: "guest",
            totalPrice: 42,
            orderTime: dates[5],
            type: "dine-in" as const,
            items: [
              { id: "itm-9", name: "悠然专属特调 · 雨林瑰夏", price: 42, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "生椰厚醇乳 (椰丝清香)", temp: "标准热饮 (最醇厚香气)", notes: "请准备两副吸贴 and 防护盒", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" }
            ]
          }
        ];

        for (const o of seedOrders) {
          await mysqlPool.query(
            "INSERT INTO orders (id, buyerName, buyerUsername, totalPrice, orderTime, type) VALUES (?, ?, ?, ?, ?, ?)",
            [o.id, o.buyerName, o.buyerUsername, o.totalPrice, o.orderTime, o.type]
          );

          for (const item of o.items) {
            await mysqlPool.query(
              `INSERT INTO order_items (id, orderId, name, price, size, sugar, milk, temp, notes, img)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [item.id, o.id, item.name, item.price, item.size, item.sugar, item.milk, item.temp, item.notes || "", item.img || ""]
            );
          }
        }
      }

    } catch (err: any) {
      console.warn("⚠️ [MySQL Pool Fail-safe] MySQL failed to connect. Error detail:", err.message);
      console.warn("🔄 Gracefully falling back to zero-overhead JSON File database.");
      useMySQL = false;
    }
  } else {
    console.log("🔄 DB_HOST not found. Defaulting to local workspace JSON file system storage.");
    useMySQL = false;
  }

  // File system initialization
  if (!useMySQL) {
    let db: JsonDatabase;
    try {
      await fs.access(DB_FILE_PATH);
      db = await readJsonDb();
    } catch {
      db = { users: [], orders: [] };
    }

    let modified = false;

    // Earlier versions stored users in users-db.json. Merge any accounts that
    // are missing from the current database so an upgrade does not make a
    // previously registered account appear to vanish.
    try {
      const legacyUsers = await readStoredUsersFile(LEGACY_DB_FILE_PATH);

      for (const legacyUser of legacyUsers) {
        if (!legacyUser?.username || !legacyUser?.email || !legacyUser?.salt || !legacyUser?.passwordHash) {
          continue;
        }

        const usernameKey = normalizeUsername(legacyUser.username);
        const emailKey = normalizeEmail(legacyUser.email);
        const alreadyPresent = db.users.some((user) =>
          normalizeUsername(user.username) === usernameKey ||
          normalizeEmail(user.email) === emailKey
        );

        if (!alreadyPresent) {
          db.users.push({
            ...legacyUser,
            username: normalizeUsername(legacyUser.username),
            email: emailKey,
          });
          modified = true;
        }
      }
    } catch {
      // No legacy database is a valid state for new installations.
    }

    // Seed mock JSON users
    if (db.users.length === 0) {
      console.log("🌱 Pre-seeding JSON users database...");
      const seedUsers = [
        {
          id: "admin-id-1",
          username: "admin",
          name: "系统管理员",
          email: "admin@example.com",
          role: "admin" as UserRole,
          status: "active" as UserStatus,
          bio: "系统最高管理员，拥有全部权属和CRUD编辑功能。",
          createdAt: new Date().toISOString(),
          password: "adminpassword"
        },
        {
          id: "user-id-alice",
          username: "alice",
          name: "爱丽丝",
          email: "alice@example.com",
          role: "user" as UserRole,
          status: "active" as UserStatus,
          bio: "手冲咖啡发烧友，极简主义界面设计师。",
          createdAt: new Date().toISOString(),
          password: "password123"
        },
        {
          id: "user-id-bob",
          username: "bob",
          name: "鲍勃",
          email: "bob@example.com",
          role: "user" as UserRole,
          status: "active" as UserStatus,
          bio: "专注于React and Node.js之全栈资深发烧友。",
          createdAt: new Date().toISOString(),
          password: "password123"
        }
      ];

      for (const u of seedUsers) {
        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = hashPassword(u.password, salt);
        db.users.push({
          id: u.id,
          username: u.username,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          bio: u.bio,
          createdAt: u.createdAt,
          salt,
          passwordHash
        });
      }
      modified = true;
    }

    // Seed mock JSON orders
    if (db.orders.length === 0) {
      console.log("🌱 Pre-seeding JSON orders database...");
      const dates = [
        new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      ];

      db.orders = [
        {
          id: "ord-1",
          buyerName: "爱丽丝",
          buyerUsername: "alice",
          totalPrice: 68,
          orderTime: dates[0],
          type: "dine-in" as const,
          items: [
            { id: "itm-1", name: "★独家手作★ 耶加雪菲 · 阳光日晒", price: 38, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "香浓冰鲜牛奶", temp: "少冰 (少冰爽口)", notes: "请附打包纸架", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" },
            { id: "itm-2", name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态", notes: "", img: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?q=80&w=734&auto=format&fit=crop" }
          ]
        },
        {
          id: "ord-2",
          buyerName: "鲍勃",
          buyerUsername: "bob",
          totalPrice: 52,
          orderTime: dates[1],
          type: "take-away" as const,
          items: [
            { id: "itm-3", name: "香醇生椰乳拿铁", price: 24, size: "大杯的大口满足 (Large)", sugar: "半糖 (半糖恰到合适)", milk: "生椰厚醇乳 (椰丝清香)", temp: "常温状态", notes: "多去冰", img: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=687&auto=format&fit=crop" },
            { id: "itm-4", name: "京都静冈宇治抹茶慕斯", price: 28, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "标准温饮", notes: "", img: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?q=80&w=735&auto=format&fit=crop" }
          ]
        },
        {
          id: "ord-3",
          buyerName: "莫奈的调色盘",
          buyerUsername: "guest",
          totalPrice: 28,
          orderTime: dates[2],
          type: "dine-in" as const,
          items: [
            { id: "itm-5", name: "冰燕麦拿铁 · 低卡臻选", price: 28, size: "超大杯的饱满爽口 (Venti)", sugar: "三分糖 (微甜微醇)", milk: "低脂燕麦奶 (谷物浓郁)", temp: "少冰 (少冰爽口)", notes: "燕麦奶加量", img: "https://images.unsplash.com/photo-1497515114629-f71d768fd07c?q=80&w=684&auto=format&fit=crop" }
          ]
        },
        {
          id: "ord-4",
          buyerName: "微风过境",
          buyerUsername: "guest",
          totalPrice: 108,
          orderTime: dates[3],
          type: "dine-in" as const,
          items: [
            { id: "itm-6", name: "★独家手作★ 瑰夏之梦 · 大堂殿堂极配", price: 78, size: "大杯的大口满足 (Large)", sugar: "天然零蔗木糖纯素 (0%)", milk: "不含乳产品 (黑美式)", temp: "标准热饮 (最醇厚香气)", notes: "手冲精心冲滤", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" },
            { id: "itm-7", name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态", notes: "", img: "https://images.unsplash.com/photo-1508737027454-e6454ef45afd?q=80&w=734&auto=format&fit=crop" }
          ]
        },
        {
          id: "ord-5",
          buyerName: "不加糖的日常",
          buyerUsername: "guest",
          totalPrice: 18,
          orderTime: dates[4],
          type: "take-away" as const,
          items: [
            { id: "itm-8", name: "经典美式咖啡 · 意式原豆", price: 18, size: "中杯的轻盈体验 (Medium)", sugar: "天然零蔗木糖纯素 (0%)", milk: "不含乳产品 (黑美式)", temp: "常温状态", notes: "常温不加糖", img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=687&auto=format&fit=crop" }
          ]
        },
        {
          id: "ord-6",
          buyerName: "独立开发者小陈",
          buyerUsername: "guest",
          totalPrice: 42,
          orderTime: dates[5],
          type: "dine-in" as const,
          items: [
            { id: "itm-9", name: "悠然专属特调 · 雨林瑰夏", price: 42, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "生椰厚醇乳 (椰丝清香)", temp: "标准热饮 (最醇厚香气)", notes: "请准备两副吸贴 and 防护盒", img: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=687&auto=format&fit=crop" }
          ]
        }
      ];
      modified = true;
    }

    if (modified || db.users.length === 0) {
      await writeJsonDb(db);
    }
  }
}

// Get all users safely (formatted, excluding passwordHash & salt)
export async function getAllUsers(): Promise<User[]> {
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt FROM users"
    );
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      bio: u.bio || "",
      createdAt: u.createdAt,
    }));
  }

  const db = await readJsonDb();
  return db.users.map(({ salt, passwordHash, ...safeUser }) => safeUser);
}

// Get raw user list with salt and passwordHash
export async function getRawUsers(): Promise<StoredUser[]> {
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt, salt, passwordHash FROM users"
    );
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      bio: u.bio || "",
      createdAt: u.createdAt,
      salt: u.salt,
      passwordHash: u.passwordHash,
    }));
  }

  const db = await readJsonDb();
  return db.users;
}

// Get a single user by ID safely
export async function getUserById(id: string): Promise<User | null> {
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt FROM users WHERE id = ?",
      [id]
    );
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      bio: u.bio || "",
      createdAt: u.createdAt,
    };
  }

  const db = await readJsonDb();
  const found = db.users.find((u) => u.id === id);
  if (!found) return null;
  const { salt, passwordHash, ...safeUser } = found;
  return safeUser;
}

// Get stored user by Username
export async function getStoredUserByUsername(username: string): Promise<StoredUser | null> {
  const normalizedUsername = normalizeUsername(username);
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt, salt, passwordHash FROM users WHERE BINARY username = BINARY ?",
      [normalizedUsername]
    );
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      bio: u.bio || "",
      createdAt: u.createdAt,
      salt: u.salt,
      passwordHash: u.passwordHash,
    };
  }

  const db = await readJsonDb();
  const found = db.users.find((u) => normalizeUsername(u.username) === normalizedUsername);
  return found || null;
}

// Get stored user by Email
export async function getStoredUserByEmail(email: string): Promise<StoredUser | null> {
  const normalizedEmail = normalizeEmail(email);
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt, salt, passwordHash FROM users WHERE LOWER(email) = LOWER(?)",
      [normalizedEmail]
    );
    if (!rows || rows.length === 0) return null;
    const u = rows[0];
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      status: u.status as UserStatus,
      bio: u.bio || "",
      createdAt: u.createdAt,
      salt: u.salt,
      passwordHash: u.passwordHash,
    };
  }

  const db = await readJsonDb();
  const found = db.users.find((u) => normalizeEmail(u.email) === normalizedEmail);
  return found || null;
}

// Add a new raw user
export async function insertUser(user: StoredUser): Promise<void> {
  if (useMySQL && mysqlPool) {
    await mysqlPool.query(
      `INSERT INTO users (id, username, name, email, role, status, bio, createdAt, salt, passwordHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.username,
        user.name,
        user.email,
        user.role,
        user.status,
        user.bio || "",
        user.createdAt,
        user.salt,
        user.passwordHash,
      ]
    );
    return;
  }

  const db = await readJsonDb();
  db.users.push(user);
  await writeJsonDb(db);
}

// Update a user's details
export async function updateUser(
  id: string,
  updates: Partial<StoredUser>
): Promise<void> {
  if (useMySQL && mysqlPool) {
    const fields: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id") {
        fields.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) return;

    params.push(id);
    await mysqlPool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      params
    );
    return;
  }

  const db = await readJsonDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index !== -1) {
    db.users[index] = {
      ...db.users[index],
      ...updates,
    };
    await writeJsonDb(db);
  }
}

// Delete user by ID
export async function deleteUserById(id: string): Promise<void> {
  if (useMySQL && mysqlPool) {
    await mysqlPool.query("DELETE FROM users WHERE id = ?", [id]);
    return;
  }

  const db = await readJsonDb();
  db.users = db.users.filter((u) => u.id !== id);
  await writeJsonDb(db);
}

// Retrieve all orders with items
export async function getAllOrders(): Promise<Order[]> {
  if (useMySQL && mysqlPool) {
    const [orders]: [any[], any] = await mysqlPool.query(
      "SELECT id, buyerName, buyerUsername, totalPrice, orderTime, type FROM orders ORDER BY orderTime DESC"
    );
    const [items]: [any[], any] = await mysqlPool.query(
      "SELECT id, orderId, name, price, size, sugar, milk, temp, notes, img FROM order_items"
    );

    return orders.map((o) => {
      const parentItems = items
        .filter((itm: any) => itm.orderId === o.id)
        .map((itm: any) => ({
          id: itm.id,
          name: itm.name,
          price: Number(itm.price),
          size: itm.size,
          sugar: itm.sugar,
          milk: itm.milk,
          temp: itm.temp,
          notes: itm.notes || "",
          img: itm.img || "",
        }));

      return {
        id: o.id,
        buyerName: o.buyerName,
        buyerUsername: o.buyerUsername,
        totalPrice: Number(o.totalPrice),
        orderTime: o.orderTime,
        type: o.type as "dine-in" | "take-away",
        items: parentItems,
      };
    });
  }

  const db = await readJsonDb();
  return [...db.orders].sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
}

// Insert checkout order
export async function insertOrder(order: Order): Promise<void> {
  if (useMySQL && mysqlPool) {
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Insert header
      await connection.query(
        "INSERT INTO orders (id, buyerName, buyerUsername, totalPrice, orderTime, type) VALUES (?, ?, ?, ?, ?, ?)",
        [order.id, order.buyerName, order.buyerUsername, order.totalPrice, order.orderTime, order.type]
      );

      // 2. Insert children
      for (const item of order.items) {
        await connection.query(
          `INSERT INTO order_items (id, orderId, name, price, size, sugar, milk, temp, notes, img)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, order.id, item.name, item.price, item.size, item.sugar, item.milk, item.temp, item.notes || "", item.img || ""]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    return;
  }

  const db = await readJsonDb();
  db.orders.push(order);
  await writeJsonDb(db);
}

// ==================== Print Jobs Database Helpers ====================

export async function getAllPrintJobs(): Promise<PrintJob[]> {
  if (useMySQL && mysqlPool) {
    try {
      const [jobs]: [any[], any] = await mysqlPool.query(
        "SELECT id, orderId, ownerUserId, buyerName, buyerUsername, totalPrice, timestamp, status FROM print_jobs ORDER BY timestamp DESC"
      );
      const [items]: [any[], any] = await mysqlPool.query(
        "SELECT printJobId, name, price, size, sugar, milk, temp, notes FROM print_job_items"
      );

      return jobs.map((j) => {
        const parentItems = items
          .filter((itm: any) => itm.printJobId === j.id)
          .map((itm: any) => ({
            name: itm.name,
            price: Number(itm.price),
            size: itm.size,
            sugar: itm.sugar,
            milk: itm.milk,
            temp: itm.temp,
            notes: itm.notes || "",
          }));

        return {
          id: j.id,
          orderId: j.orderId || undefined,
          ownerUserId: j.ownerUserId || undefined,
          buyerName: j.buyerName,
          buyerUsername: j.buyerUsername,
          totalPrice: Number(j.totalPrice),
          timestamp: j.timestamp,
          status: j.status as 'pending' | 'printing' | 'completed',
          items: parentItems,
        };
      });
    } catch (e) {
      console.error("Failed to fetch print jobs from MySQL:", e);
      return [];
    }
  }

  const db = await readJsonDb();
  if (!db.printJobs) {
    db.printJobs = getInitialSeededPrintJobs();
    await writeJsonDb(db);
  }
  // Sort print jobs descending by timestamp
  return [...db.printJobs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function insertPrintJob(job: PrintJob): Promise<void> {
  if (useMySQL && mysqlPool) {
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        "INSERT INTO print_jobs (id, orderId, ownerUserId, buyerName, buyerUsername, totalPrice, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [job.id, job.orderId || null, job.ownerUserId || null, job.buyerName, job.buyerUsername, job.totalPrice, job.timestamp, job.status]
      );

      for (const item of job.items) {
        await connection.query(
          `INSERT INTO print_job_items (printJobId, name, price, size, sugar, milk, temp, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [job.id, item.name, item.price, item.size, item.sugar, item.milk, item.temp, item.notes || ""]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    return;
  }

  const db = await readJsonDb();
  if (!db.printJobs) {
    db.printJobs = getInitialSeededPrintJobs();
  }
  db.printJobs.push(job);
  // Keep only last 50 print jobs to save storage
  if (db.printJobs.length > 50) {
    db.printJobs.shift();
  }
  await writeJsonDb(db);
}

export async function updatePrintJobStatus(id: string, status: 'pending' | 'printing' | 'completed'): Promise<void> {
  if (useMySQL && mysqlPool) {
    try {
      await mysqlPool.query("UPDATE print_jobs SET status = ? WHERE id = ?", [status, id]);
    } catch (e) {
      console.error("Failed to update print job status in MySQL:", e);
    }
    return;
  }

  const db = await readJsonDb();
  if (!db.printJobs) {
    db.printJobs = getInitialSeededPrintJobs();
  }
  const job = db.printJobs.find((j) => j.id === id);
  if (job) {
    job.status = status;
    await writeJsonDb(db);
  }
}

export async function clearPrintJobs(): Promise<void> {
  if (useMySQL && mysqlPool) {
    try {
      await mysqlPool.query("DELETE FROM print_jobs");
    } catch (e) {
      console.error("Failed to clear print jobs in MySQL:", e);
    }
    return;
  }

  const db = await readJsonDb();
  db.printJobs = [];
  await writeJsonDb(db);
}

export async function deletePrintJob(id: string): Promise<void> {
  if (useMySQL && mysqlPool) {
    try {
      await mysqlPool.query("DELETE FROM print_job_items WHERE printJobId = ?", [id]);
      await mysqlPool.query("DELETE FROM print_jobs WHERE id = ?", [id]);
    } catch (e) {
      console.error("Failed to delete print job in MySQL:", e);
    }
    return;
  }

  const db = await readJsonDb();
  if (db.printJobs) {
    db.printJobs = db.printJobs.filter((j) => j.id !== id);
    await writeJsonDb(db);
  }
}

function getInitialSeededPrintJobs(): PrintJob[] {
  return [];
}
