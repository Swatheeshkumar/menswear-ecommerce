const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { URL } = require("url");

require("dotenv").config({ path: path.join(__dirname, "backend", ".env") });

const port = process.env.PORT || 3000;
const rootDirectory = __dirname;
const databasePath = path.join(rootDirectory, "data", "db.json");
const mongoUri = process.env.MONGO_URI;
const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const adminTokens = new Set();
const defaultCategories = [
    { id: "shirts", name: "Shirts", image: "shirts.jpg", page: "shirts.html", enabled: true },
    { id: "tshirts", name: "T-Shirts", image: "tshirts.jpg", page: "tshirts.html", enabled: true },
    { id: "trousers", name: "Trousers", image: "trousers.jpg", page: "trousers.html", enabled: true },
    { id: "jackets", name: "Jackets", image: "jackets.jpg", page: "jackets.html", enabled: true },
    { id: "jeans", name: "Jeans", image: "jeans.jpg", page: "jeans.html", enabled: false },
    { id: "accessories", name: "Accessories", image: "accessories.jpg", page: "accessories.html", enabled: true }
];
const mimeTypes = {
    ".css": "text/css",
    ".html": "text/html",
    ".jpg": "image/jpeg",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png"
};

if (!mongoUri || mongoUri.includes("<db_password>")) {
    console.error("MongoDB is not configured. Replace <db_password> in backend/.env.");
} else {
    mongoose
        .connect(mongoUri)
        .then(() => console.log("MongoDB connected successfully."))
        .catch((error) => console.error(`MongoDB connection failed: ${error.message}`));
}

function readDatabase() {
    return JSON.parse(fs.readFileSync(databasePath, "utf8"));
}

function writeDatabase(database) {
    fs.writeFileSync(databasePath, `${JSON.stringify(database, null, 2)}\n`);
}

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    });
    response.end(JSON.stringify(data));
}

function getRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1_000_000) request.destroy();
        });
        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });
        request.on("error", reject);
    });
}

function hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
}

function handleApi(request, response, requestUrl) {
    if (request.method === "OPTIONS") {
        response.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        });
        response.end();
        return true;
    }

    if (requestUrl.pathname === "/api/health" && request.method === "GET") {
        sendJson(response, 200, { ok: true, service: "swatheesh-menswear" });
        return true;
    }

    if (requestUrl.pathname === "/api/admin/login" && request.method === "POST") {
        getRequestBody(request)
            .then((body) => {
                if (body.email !== adminEmail || body.password !== adminPassword) {
                    sendJson(response, 401, { error: "Admin email or password is incorrect." });
                    return;
                }
                const token = crypto.randomBytes(32).toString("hex");
                adminTokens.add(token);
                sendJson(response, 200, { token });
            })
            .catch(() => sendJson(response, 400, { error: "Invalid request body." }));
        return true;
    }

    if (requestUrl.pathname === "/api/products" && request.method === "GET") {
        sendJson(response, 200, readDatabase().products);
        return true;
    }

    if (requestUrl.pathname === "/api/categories" && request.method === "GET") {
        sendJson(response, 200, readDatabase().categories || defaultCategories);
        return true;
    }

    if (requestUrl.pathname === "/api/orders" && request.method === "GET") {
        if (!adminTokens.has(request.headers.authorization?.replace("Bearer ", ""))) {
            sendJson(response, 401, { error: "Admin login required." });
            return true;
        }
        sendJson(response, 200, readDatabase().orders);
        return true;
    }

    if (!["/api/users/register", "/api/users/login", "/api/orders", "/api/products", "/api/categories"].includes(requestUrl.pathname)) {
        return false;
    }

    getRequestBody(request)
        .then((body) => {
            const database = readDatabase();

            if (requestUrl.pathname === "/api/categories" && request.method === "PUT") {
                if (!adminTokens.has(request.headers.authorization?.replace("Bearer ", ""))) {
                    sendJson(response, 401, { error: "Admin login required." });
                    return;
                }
                const categories = database.categories || defaultCategories;
                const categoryIndex = categories.findIndex((item) => item.id === body.id);
                if (categoryIndex < 0) {
                    sendJson(response, 404, { error: "Category not found." });
                    return;
                }
                categories[categoryIndex] = {
                    ...categories[categoryIndex],
                    name: String(body.name || "").trim(),
                    image: String(body.image || "").trim(),
                    page: String(body.page || "").trim(),
                    enabled: Boolean(body.enabled)
                };
                database.categories = categories;
                writeDatabase(database);
                sendJson(response, 200, categories[categoryIndex]);
                return;
            }

            if (requestUrl.pathname === "/api/products" && ["POST", "PUT", "DELETE"].includes(request.method) && !adminTokens.has(request.headers.authorization?.replace("Bearer ", ""))) {
                sendJson(response, 401, { error: "Admin login required." });
                return;
            }

            if (requestUrl.pathname === "/api/users/register" && request.method === "POST") {
                const email = String(body.email || "").trim().toLowerCase();
                if (!/^\S+@gmail\.com$/i.test(email) || String(body.password || "").length < 6) {
                    sendJson(response, 400, { error: "Use a Gmail address and a password with at least 6 characters." });
                    return;
                }
                if (database.users.some((user) => user.email === email)) {
                    sendJson(response, 409, { error: "An account with this email already exists." });
                    return;
                }
                const user = {
                    id: crypto.randomUUID(),
                    name: String(body.name || "").trim(),
                    email,
                    passwordHash: hashPassword(body.password),
                    createdAt: new Date().toISOString()
                };
                database.users.push(user);
                writeDatabase(database);
                sendJson(response, 201, { id: user.id, name: user.name, email: user.email });
                return;
            }

            if (requestUrl.pathname === "/api/users/login" && request.method === "POST") {
                const email = String(body.email || "").trim().toLowerCase();
                const user = database.users.find((item) => item.email === email);
                if (!user || user.passwordHash !== hashPassword(String(body.password || ""))) {
                    sendJson(response, 401, { error: "Email or password is incorrect." });
                    return;
                }
                sendJson(response, 200, { id: user.id, name: user.name, email: user.email });
                return;
            }

            if (requestUrl.pathname === "/api/orders" && request.method === "POST") {
                if (!body.customer || !Array.isArray(body.items) || body.items.length === 0) {
                    sendJson(response, 400, { error: "Customer details and order items are required." });
                    return;
                }
                const order = {
                    id: `SW-${Date.now().toString().slice(-6)}`,
                    customer: body.customer,
                    items: body.items,
                    total: Number(body.total || 0),
                    status: "pending",
                    createdAt: new Date().toISOString()
                };
                database.orders.push(order);
                writeDatabase(database);
                sendJson(response, 201, order);
                return;
            }

            if (requestUrl.pathname === "/api/products" && request.method === "PUT") {
                const productIndex = database.products.findIndex((item) => item.id === body.id);
                if (productIndex < 0) {
                    sendJson(response, 404, { error: "Product not found." });
                    return;
                }
                const product = {
                    ...database.products[productIndex],
                    name: String(body.name || "").trim(),
                    category: String(body.category || "").trim().toLowerCase(),
                    price: Number(body.price),
                    stock: Number(body.stock),
                    extraFields: Array.isArray(body.extraFields) ? body.extraFields : [],
                    image: String(body.image || "").trim(),
                    updatedAt: new Date().toISOString()
                };
                if (!product.name || !product.category || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(product.stock) || product.stock < 0 || !product.image) {
                    sendJson(response, 400, { error: "Name, category, valid price, stock, and image filename are required." });
                    return;
                }
                database.products[productIndex] = product;
                writeDatabase(database);
                sendJson(response, 200, product);
                return;
            }

            if (requestUrl.pathname === "/api/products" && request.method === "DELETE") {
                const productId = body.id || requestUrl.searchParams.get("id");
                const productIndex = database.products.findIndex((item) => item.id === productId);
                if (productIndex < 0) {
                    sendJson(response, 404, { error: "Product not found." });
                    return;
                }
                database.products.splice(productIndex, 1);
                writeDatabase(database);
                sendJson(response, 200, { ok: true });
                return;
            }

            if (requestUrl.pathname === "/api/products" && request.method === "POST") {
                const product = {
                    id: crypto.randomUUID(),
                    name: String(body.name || "").trim(),
                    category: String(body.category || "").trim().toLowerCase(),
                    price: Number(body.price),
                    stock: Number(body.stock),
                    extraFields: Array.isArray(body.extraFields) ? body.extraFields : [],
                    image: String(body.image || "").trim(),
                    createdAt: new Date().toISOString()
                };
                if (!product.name || !product.category || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(product.stock) || product.stock < 0 || !product.image) {
                    sendJson(response, 400, { error: "Name, category, valid price, stock, and image filename are required." });
                    return;
                }
                database.products.push(product);
                writeDatabase(database);
                sendJson(response, 201, product);
                return;
            }

            sendJson(response, 405, { error: "Method not allowed." });
        })
        .catch(() => sendJson(response, 400, { error: "Invalid request body." }));

    return true;
}

function serveStatic(request, response, requestUrl) {
    const requestedPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const filePath = path.normalize(path.join(rootDirectory, requestedPath));
    if (!filePath.startsWith(rootDirectory)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, file) => {
        if (error) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }
        response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
        response.end(file);
    });
}

const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (!handleApi(request, response, requestUrl)) serveStatic(request, response, requestUrl);
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Swatheesh Menswear running at http://localhost:${port}`);
    console.log(`Mobile access: http://<your-pc-ip>:${port}`);
});
