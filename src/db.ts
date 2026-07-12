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

const DB_FILE_PATH = path.join(process.cwd(), "coffee-shop-db.json");

// Database state indicators
export let useMySQL = false;
export let mysqlPool: mysql.Pool | null = null;

// Password hashing helper matching previous implementation
export function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
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
          username VARCHAR(255) UNIQUE NOT NULL,
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
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt, salt, passwordHash FROM users WHERE LOWER(username) = LOWER(?)",
      [username]
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
  const found = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  return found || null;
}

// Get stored user by Email
export async function getStoredUserByEmail(email: string): Promise<StoredUser | null> {
  if (useMySQL && mysqlPool) {
    const [rows]: [any[], any] = await mysqlPool.query(
      "SELECT id, username, name, email, role, status, bio, createdAt, salt, passwordHash FROM users WHERE LOWER(email) = LOWER(?)",
      [email]
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
  const found = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
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

export async function cleanupExpiredPrintJobs(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (useMySQL && mysqlPool) {
    try {
      const thresholdTime = fiveMinutesAgo.toISOString();
      await mysqlPool.query("DELETE FROM print_jobs WHERE status = 'pending' AND timestamp < ?", [thresholdTime]);
    } catch (e) {
      console.error("Failed to clean up expired print jobs in MySQL:", e);
    }
    return;
  }

  const db = await readJsonDb();
  if (db.printJobs) {
    const originalLength = db.printJobs.length;
    db.printJobs = db.printJobs.filter(j => {
      if (j.status !== 'pending') return true;
      const jobTime = new Date(j.timestamp);
      return jobTime.getTime() >= fiveMinutesAgo.getTime();
    });
    if (db.printJobs.length !== originalLength) {
      await writeJsonDb(db);
    }
  }
}

export async function getAllPrintJobs(): Promise<PrintJob[]> {
  await cleanupExpiredPrintJobs();
  if (useMySQL && mysqlPool) {
    try {
      const [jobs]: [any[], any] = await mysqlPool.query(
        "SELECT id, orderId, buyerName, buyerUsername, totalPrice, timestamp, status FROM print_jobs ORDER BY timestamp DESC"
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
        "INSERT INTO print_jobs (id, orderId, buyerName, buyerUsername, totalPrice, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [job.id, job.orderId || null, job.buyerName, job.buyerUsername, job.totalPrice, job.timestamp, job.status]
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
  return [
    {
      id: "PRT-2849-01",
      buyerName: "爱丽丝",
      buyerUsername: "alice",
      totalPrice: 68,
      items: [
        { name: "★独家手作★ 耶加雪菲 · 阳光日晒", price: 38, size: "大杯的大口满足 (Large)", sugar: "三分糖 (微甜微醇)", milk: "香浓冰鲜牛奶", temp: "少冰 (少冰爽口)", notes: "请附打包纸架" },
        { name: "法式手作重乳酪芝士", price: 30, size: "例份", sugar: "半糖 (半糖恰到合适)", milk: "香浓冰鲜牛奶", temp: "常温状态" }
      ],
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'completed'
    },
    {
      id: "PRT-9213-02",
      buyerName: "鲍勃",
      buyerUsername: "bob",
      totalPrice: 24,
      items: [
        { name: "香醇生椰乳拿铁", price: 24, size: "大杯的大口满足 (Large)", sugar: "半糖 (半糖恰到合适)", milk: "生椰厚醇乳 (椰丝清香)", temp: "常温状态", notes: "多去冰" }
      ],
      timestamp: new Date().toISOString(),
      status: 'pending'
    }
  ];
}
