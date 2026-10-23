import crypto from "crypto";
import { Pool, PoolClient } from "pg";
import { User, Order, UserRole, UserStatus, PrintJob, MenuProduct, BeanBatch, WishlistItem } from "./types.ts";

export interface StoredUser extends User {
  salt: string;
  passwordHash: string;
}

let pool: Pool | null = null;

function database(): Pool {
  if (!pool) throw new Error("PostgreSQL is not initialized");
  return pool;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash("sha256").update(password + salt).digest("hex");
}

export function normalizeUsername(username: string): string {
  return username.trim().normalize("NFKC");
}

export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}

export async function initDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. JSON fallback storage has been removed.");
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_SIZE) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 12_000,
  });
  pool.on("error", (error) => console.error("PostgreSQL pool error:", error));
  await pool.query("select 1");
  console.log("🚀 Supabase PostgreSQL connection verified successfully!");
}

function mapUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    bio: row.bio || "",
    avatar: row.avatar || "",
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function mapStoredUser(row: any): StoredUser {
  return { ...mapUser(row), salt: row.salt, passwordHash: row.passwordHash };
}

const userColumns = `id, username, name, email, role, status, bio, avatar,
  created_at as "createdAt"`;
const storedUserColumns = `${userColumns}, salt, password_hash as "passwordHash"`;

export async function getAllUsers(): Promise<User[]> {
  const { rows } = await database().query(`select ${userColumns} from public.users order by created_at desc`);
  return rows.map(mapUser);
}

export async function getRawUsers(): Promise<StoredUser[]> {
  const { rows } = await database().query(`select ${storedUserColumns} from public.users order by created_at desc`);
  return rows.map(mapStoredUser);
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await database().query(`select ${userColumns} from public.users where id = $1`, [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getStoredUserByUsername(username: string): Promise<StoredUser | null> {
  const { rows } = await database().query(
    `select ${storedUserColumns} from public.users where username = $1`,
    [normalizeUsername(username)]
  );
  return rows[0] ? mapStoredUser(rows[0]) : null;
}

export async function getStoredUserByEmail(email: string): Promise<StoredUser | null> {
  const { rows } = await database().query(
    `select ${storedUserColumns} from public.users where lower(email) = lower($1)`,
    [normalizeEmail(email)]
  );
  return rows[0] ? mapStoredUser(rows[0]) : null;
}

export async function insertUser(user: StoredUser): Promise<void> {
  await database().query(
    `insert into public.users
      (id, username, name, email, role, status, bio, avatar, created_at, salt, password_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [user.id, user.username, user.name, user.email, user.role, user.status, user.bio || "", user.avatar || "", user.createdAt, user.salt, user.passwordHash]
  );
}

const userUpdateColumns: Record<string, string> = {
  username: "username", name: "name", email: "email", role: "role", status: "status",
  bio: "bio", avatar: "avatar", createdAt: "created_at", salt: "salt", passwordHash: "password_hash",
};

export async function updateUser(id: string, updates: Partial<StoredUser>): Promise<void> {
  const entries = Object.entries(updates).filter(([key]) => userUpdateColumns[key]);
  if (!entries.length) return;
  const setClause = entries.map(([key], index) => `${userUpdateColumns[key]} = $${index + 1}`).join(", ");
  await database().query(
    `update public.users set ${setClause} where id = $${entries.length + 1}`,
    [...entries.map(([, value]) => value), id]
  );
}

export async function deleteUserById(id: string): Promise<void> {
  await database().query("delete from public.users where id = $1", [id]);
}

function mapOrder(order: any, itemRows: any[]): Order {
  return {
    id: order.id,
    buyerName: order.buyerName,
    buyerUsername: order.buyerUsername,
    totalPrice: Number(order.totalPrice),
    orderTime: new Date(order.orderTime).toISOString(),
    type: order.type,
    items: itemRows.filter((item) => item.orderId === order.id).map((item) => ({
      id: item.id, name: item.name, price: Number(item.price), size: item.size,
      sugar: item.sugar, milk: item.milk, temp: item.temp,
      notes: item.notes || "", img: item.img || "",
    })),
  };
}

export async function getAllOrders(): Promise<Order[]> {
  const [orders, items] = await Promise.all([
    database().query(`select id, buyer_name as "buyerName", buyer_username as "buyerUsername",
      total_price as "totalPrice", order_time as "orderTime", type
      from public.orders order by order_time desc`),
    database().query(`select id, order_id as "orderId", name, price, size, sugar, milk, temp, notes, img
      from public.order_items`),
  ]);
  return orders.rows.map((order) => mapOrder(order, items.rows));
}

async function insertOrderRows(client: PoolClient, order: Order): Promise<void> {
  await client.query(
    `insert into public.orders (id, buyer_name, buyer_username, total_price, order_time, type)
     values ($1,$2,$3,$4,$5,$6)`,
    [order.id, order.buyerName, order.buyerUsername, order.totalPrice, order.orderTime, order.type]
  );
  for (const item of order.items) {
    await client.query(
      `insert into public.order_items (id, order_id, name, price, size, sugar, milk, temp, notes, img)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [item.id, order.id, item.name, item.price, item.size, item.sugar, item.milk, item.temp, item.notes || "", item.img || ""]
    );
  }
}

export async function insertOrder(order: Order): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("begin");
    await insertOrderRows(client, order);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function mapBatch(row: any): BeanBatch | null {
  if (!row.batchId) return null;
  return {
    id: row.batchId, lotCode: row.lotCode, country: row.country, region: row.region,
    farm: row.farm, altitude: row.altitude, variety: row.variety, process: row.process,
    roastLevel: row.roastLevel,
    flavorNotes: Array.isArray(row.flavorNotes) ? row.flavorNotes : [],
    harvestSeason: row.harvestSeason, roastedAt: row.roastedAt,
    status: row.batchStatus, story: row.story, image: row.batchImage,
    latitude: Number(row.latitude), longitude: Number(row.longitude), profile: row.profile,
  };
}

export async function getMenuProducts(includeInactive = false): Promise<MenuProduct[]> {
  const { rows } = await database().query(
    `select p.id, p.name, p.price, p.category, p.img, p.description, p.stock, p.active,
      p.bean_batch_id as "beanBatchId", b.id as "batchId", b.lot_code as "lotCode",
      b.country, b.region, b.farm, b.altitude, b.variety, b.process,
      b.roast_level as "roastLevel", b.flavor_notes as "flavorNotes",
      b.harvest_season as "harvestSeason", b.roasted_at as "roastedAt",
      b.status as "batchStatus", b.story, b.image as "batchImage", b.latitude, b.longitude, b.profile
     from public.products p
     left join public.coffee_bean_batches b on b.id = p.bean_batch_id
     where ($1::boolean = true or p.active = true)
     order by p.id`,
    [includeInactive]
  );
  return rows.map((row) => ({
    id: Number(row.id), name: row.name, price: Number(row.price), category: row.category,
    img: row.img, desc: row.description, stock: Math.max(0, Number(row.stock)),
    active: Boolean(row.active), beanBatchId: row.beanBatchId || null, beanBatch: mapBatch(row),
  }));
}

export async function updateProductInventory(id: number, stock: number, active: boolean): Promise<MenuProduct | null> {
  const safeStock = Math.max(0, Math.floor(stock));
  const result = await database().query(
    "update public.products set stock = $1, active = $2 where id = $3 returning id",
    [safeStock, active, id]
  );
  if (!result.rowCount) return null;
  return (await getMenuProducts(true)).find((product) => product.id === id) || null;
}

export async function getWishlistByUserId(ownerUserId: string): Promise<WishlistItem[]> {
  const { rows } = await database().query(
    `select wish_id as "wishId", item_id as "itemId", name, price, category, img,
      sugar, milk, temp, size, notes, added_at as "addedAt"
     from public.wishlist_items where owner_user_id = $1 order by added_at desc`,
    [ownerUserId]
  );
  return rows.map((row) => ({
    ...row, itemId: row.itemId == null ? undefined : Number(row.itemId),
    price: Number(row.price), addedAt: new Date(row.addedAt).toISOString(),
  }));
}

export async function replaceWishlist(ownerUserId: string, items: WishlistItem[]): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("delete from public.wishlist_items where owner_user_id = $1", [ownerUserId]);
    for (const item of items) {
      await client.query(
        `insert into public.wishlist_items
          (wish_id, owner_user_id, item_id, name, price, category, img, sugar, milk, temp, size, notes, added_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [item.wishId, ownerUserId, item.itemId ?? null, item.name, item.price, item.category, item.img, item.sugar, item.milk, item.temp, item.size, item.notes || "", item.addedAt]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function insertOrderWithInventory(order: Order, productQuantities: Map<number, number>): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("begin");
    for (const [productId, quantity] of productQuantities) {
      const { rows } = await client.query(
        "select name, stock, active from public.products where id = $1 for update", [productId]
      );
      const product = rows[0];
      if (!product || !product.active) throw new Error("PRODUCT_UNAVAILABLE:商品已下架");
      if (Number(product.stock) < quantity) throw new Error(`INSUFFICIENT_STOCK:${product.name}:${product.stock}`);
    }
    await insertOrderRows(client, order);
    for (const [productId, quantity] of productQuantities) {
      await client.query("update public.products set stock = stock - $1 where id = $2", [quantity, productId]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAllPrintJobs(): Promise<PrintJob[]> {
  const [jobs, items] = await Promise.all([
    database().query(`select id, order_id as "orderId", owner_user_id as "ownerUserId",
      buyer_name as "buyerName", buyer_username as "buyerUsername", total_price as "totalPrice",
      timestamp, status from public.print_jobs order by timestamp desc`),
    database().query(`select print_job_id as "printJobId", name, price, size, sugar, milk, temp, notes
      from public.print_job_items`),
  ]);
  return jobs.rows.map((job) => ({
    id: job.id, orderId: job.orderId || undefined, ownerUserId: job.ownerUserId || undefined,
    buyerName: job.buyerName, buyerUsername: job.buyerUsername,
    totalPrice: Number(job.totalPrice), timestamp: new Date(job.timestamp).toISOString(), status: job.status,
    items: items.rows.filter((item) => item.printJobId === job.id).map((item) => ({
      name: item.name, price: Number(item.price), size: item.size, sugar: item.sugar,
      milk: item.milk, temp: item.temp, notes: item.notes || "",
    })),
  }));
}

export async function insertPrintJob(job: PrintJob): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into public.print_jobs
        (id, order_id, owner_user_id, buyer_name, buyer_username, total_price, timestamp, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [job.id, job.orderId || null, job.ownerUserId || null, job.buyerName, job.buyerUsername, job.totalPrice, job.timestamp, job.status]
    );
    for (const item of job.items) {
      await client.query(
        `insert into public.print_job_items (print_job_id, name, price, size, sugar, milk, temp, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [job.id, item.name, item.price, item.size, item.sugar, item.milk, item.temp, item.notes || ""]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePrintJobStatus(id: string, status: "pending" | "printing" | "completed"): Promise<void> {
  await database().query("update public.print_jobs set status = $1 where id = $2", [status, id]);
}

export async function clearPrintJobs(): Promise<void> {
  await database().query("delete from public.print_jobs");
}

export async function deletePrintJob(id: string): Promise<void> {
  await database().query("delete from public.print_jobs where id = $1", [id]);
}
