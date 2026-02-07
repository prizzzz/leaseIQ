require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

// --- POSTGRES CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // FIX: Standardizing SSL to avoid the warning message
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
        ? false 
        : { 
            rejectUnauthorized: false,
            sslmode: 'verify-full' // Prepare for future pg versions
          }
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// FIX: ROOT ROUTE (Solves 404 on http://localhost:5000)
app.get('/', (req, res) => {
    res.json({ status: "Online", message: "LeaseIQ API is running" });
});

const JWT_SECRET = process.env.JWT_SECRET || "lease_iq_super_secret_2026";

// --- AUTH ROUTES ---

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) return res.status(400).json({ message: "User already exists." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        const token = jwt.sign({ userId: newUser.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token, user: newUser.rows[0] });
    } catch (error) {
        res.status(500).json({ message: "Signup error", error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: "Invalid credentials." });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: "Login error", error: error.message });
    }
});

// --- LEASE DATA ROUTES ---

app.post('/api/leases/save', async (req, res) => {
    try {
        const { userId, data } = req.body;
        const query = `
            INSERT INTO leases (id, user_id, car_name, summary, chat_history)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET
            car_name = EXCLUDED.car_name,
            summary = EXCLUDED.summary,
            chat_history = EXCLUDED.chat_history;
        `;
        const values = [
            data.id, 
            userId, 
            data.carName, 
            JSON.stringify(data.summary || {}), 
            JSON.stringify(data.chatHistory || [])
        ];
        await pool.query(query, values);
        res.status(200).json({ message: "Saved" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/leases/:userId', async (req, res) => {
    try {
        const { userId } = req.params; 
        const result = await pool.query(
            'SELECT id, car_name as "carName", summary, chat_history as "chatHistory" FROM leases WHERE user_id = $1 ORDER BY created_at DESC', 
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).send("Fetch error");
    }
});

app.delete('/api/leases/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM leases WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: "Lease not found" });
        res.status(200).json({ message: "Lease deleted from PostgreSQL" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

app.post('/api/simulator/chat', async (req, res) => {
    try {
        const { message, file_id, threadId } = req.body;
        const msg = message.toLowerCase();

        const result = await pool.query(
            'SELECT car_name, summary FROM leases WHERE id = $1', 
            [file_id]
        );
        
        const lease = result.rows[0];
        const carName = lease ? lease.car_name : "this vehicle";
        const monthly = lease?.summary?.monthlyPayment;
        const paymentText = monthly ? `${monthly} payment` : "monthly payment";
            
        let reply = "";

        if (threadId === "thread-2") {
            if (msg.includes("match") || msg.includes("better") || msg.includes("beat")) {
                reply = `If you have a written quote for that ${carName}, send it over. If your ${paymentText} is real, I’ll do my best to beat it by at least $10-$15 a month.`;
            } else if (msg.includes("discount") || msg.includes("cheaper")) {
                reply = `We are aggressive on our ${carName} pricing right now. Since you're comparing offers, tell me the best number you've seen and I'll see if my manager can top it.`;
            } else {
                reply = `I want to win your business on this ${carName}. What would it take for you to stop shopping and sign with me today?`;
            }
        } else {
            if (msg.includes("discount")) {
                reply = `I understand budget is important for this ${carName}. If we can get that ${paymentText} down a bit, are you prepared to sign today?`;
            } else if (msg.includes("fees")) {
                reply = `The fees on the ${carName} are standard, but let me see if I can waive the doc fee for you.`;
            } else {
                reply = `Regarding your request for the ${carName}, let me check with my manager and get back to you.`;
            }
        }
        res.json({ assistant_message: reply });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch simulator data" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));


















































// require('dotenv').config(); 
// const express = require('express');
// const cors = require('cors');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { Pool } = require('pg');

// const app = express();

// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
//     ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
//         ? false 
//         : { rejectUnauthorized: false }
// });

// app.use(cors());
// app.use(express.json());

// const JWT_SECRET = process.env.JWT_SECRET || "lease_iq_super_secret_2026";

// // --- AUTH ROUTES ---

// app.post('/api/auth/signup', async (req, res) => {
//     try {
//         const { name, email, password } = req.body;
//         const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
//         if (userExists.rows.length > 0) return res.status(400).json({ message: "User already exists." });

//         const hashedPassword = await bcrypt.hash(password, 10);
//         const newUser = await pool.query(
//             'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
//             [name, email, hashedPassword]
//         );
//         const token = jwt.sign({ userId: newUser.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
//         res.status(201).json({ token, user: newUser.rows[0] });
//     } catch (error) {
//         res.status(500).json({ message: "Signup error", error: error.message });
//     }
// });

// app.post('/api/auth/login', async (req, res) => {
//     try {
//         const { email, password } = req.body;
//         const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
//         const user = result.rows[0];

//         if (!user || !(await bcrypt.compare(password, user.password))) {
//             return res.status(400).json({ message: "Invalid credentials." });
//         }

//         const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
//         // CRITICAL: Ensure ID is returned here for App.jsx to use
//         res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
//     } catch (error) {
//         res.status(500).json({ message: "Login error", error: error.message });
//     }
// });

// // --- LEASE DATA ROUTES ---

// app.post('/api/leases/save', async (req, res) => {
//     try {
//         const { userId, data } = req.body;
//         const query = `
//             INSERT INTO leases (id, user_id, car_name, summary, chat_history)
//             VALUES ($1, $2, $3, $4, $5)
//             ON CONFLICT (id) DO UPDATE SET
//             car_name = EXCLUDED.car_name,
//             summary = EXCLUDED.summary,
//             chat_history = EXCLUDED.chat_history;
//         `;
//         const values = [
//             data.id, 
//             userId, 
//             data.carName, 
//             JSON.stringify(data.summary || {}), 
//             JSON.stringify(data.chatHistory || [])
//         ];
//         await pool.query(query, values);
//         res.status(200).json({ message: "Saved" });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// app.get('/api/leases/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params; 
//         const result = await pool.query(
//             'SELECT id, car_name as "carName", summary, chat_history as "chatHistory" FROM leases WHERE user_id = $1 ORDER BY created_at DESC', 
//             [userId]
//         );
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).send("Fetch error");
//     }
// });

// // server.js
// app.delete('/api/leases/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const result = await pool.query('DELETE FROM leases WHERE id = $1', [id]);
        
//         if (result.rowCount === 0) {
//             return res.status(404).json({ message: "Lease not found" });
//         }
        
//         res.status(200).json({ message: "Lease deleted from PostgreSQL" });
//     } catch (err) {
//         console.error("Delete Error:", err.message);
//         res.status(500).json({ error: "Failed to delete" });
//     }
// });


// // Add this to server.js
// // server.js
// app.post('/api/simulator/chat', async (req, res) => {
//     try {
//         // 1. Destructure threadId from the request body
//         const { message, file_id, threadId } = req.body;
//         const msg = message.toLowerCase();

//         // 2. Fetch the specific data for THIS PDF
//         const result = await pool.query(
//             'SELECT car_name, summary FROM leases WHERE id = $1', 
//             [file_id]
//         );
        
//         const lease = result.rows[0];
//         const carName = lease ? lease.car_name : "this vehicle";
//         const monthly = lease?.summary?.monthlyPayment;
//         const paymentText = monthly ? `${monthly} payment` : "monthly payment";
            
//         let reply = "";

//         // 3. LOGIC BRANCHING BASED ON THREAD (DEALER TYPE)
        
//         if (threadId === "thread-2") {
//             // --- DEALER B: THE COMPETITOR (Offer Comparison) ---
//             if (msg.includes("match") || msg.includes("better") || msg.includes("other dealer")) {
//                 reply = `If you have a written quote for that ${carName}, send it over. If your ${paymentText} is real, I’ll do my best to beat it by at least $10-$15 a month.`;
//             } else if (msg.includes("discount") || msg.includes("cheaper")) {
//                 reply = `We are aggressive on our ${carName} pricing right now. Since you're comparing offers, tell me the best number you've seen and I'll see if my manager can top it.`;
//             }else if (msg.includes("match") || msg.includes("better") || msg.includes("other dealer") || msg.includes("beat")) {
//                 reply = `If you have a written quote for that ${carName}, send it over. If your ${paymentText} is real, I’ll do my best to beat it by at least $10-$15 a month.`;
//             }
//              else {
//                 reply = `I want to win your business on this ${carName}. What would it take for you to stop shopping and sign with me today?`;
//             }
//         } else {
//             // --- DEALER A: THE EXPLAINER (Lease Questions / Default) ---
//             if (msg.includes("discount")) {
//                 reply = `I understand budget is important for this ${carName}. If we can get that ${paymentText} down a bit, are you prepared to sign today?`;
//             } else if (msg.includes("fees")) {
//                 reply = `The fees on the ${carName} are standard, but let me see if I can waive the doc fee for you.`;
//             } else {
//                 reply = `Regarding your request for the ${carName}, let me check with my manager and get back to you.`;
//             }
//         }

//         res.json({ assistant_message: reply });
//     } catch (error) {
//         console.error("Simulator Error:", error);
//         res.status(500).json({ error: "Failed to fetch contract data" });
//     }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));












// require('dotenv').config(); // 1. ADD THIS LINE (Must be at the very top)
// const express = require('express');
// const cors = require('cors');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { Pool } = require('pg');

// const app = express();

// // --- POSTGRES CONNECTION ---
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
//     ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
//         ? false 
//         : { rejectUnauthorized: false }
// });

// app.use(cors());
// app.use(express.json());

// const JWT_SECRET = process.env.JWT_SECRET || "lease_iq_super_secret_2026";

// // --- ROUTES (Signup & Login stay exactly the same as yours) ---
// // Add this right above app.listen
// app.get('/test-db', async (req, res) => {
//     try {
//         const result = await pool.query('SELECT NOW()');
//         res.json({ 
//             status: "Success", 
//             message: "Database is connected!", 
//             time: result.rows[0].now 
//         });
//     } catch (err) {
//         console.error("Connection error details:", err.message);
//         res.status(500).json({ 
//             status: "Error", 
//             message: "Database connection failed", 
//             error: err.message 
//         });
//     }
// });


// app.get('/api/leases', async (req, res) => {
//     try {
//         // In a real app, you get 'userId' from the JWT token
//         const { userId } = req.query; 
//         const result = await pool.query('SELECT * FROM leases WHERE user_id = $1', [userId]);
//         res.json(result.rows);
//     } catch (err) {
//         res.status(500).send("Error fetching data");
//     }
// });


// app.post('/api/auth/signup', async (req, res) => {
//     try {
//         const { name, email, password } = req.body;
//         const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
//         if (userExists.rows.length > 0) {
//             return res.status(400).json({ message: "User already exists." });
//         }
//         const hashedPassword = await bcrypt.hash(password, 10);
//         const newUser = await pool.query(
//             'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
//             [name, email, hashedPassword]
//         );
//         const token = jwt.sign({ userId: newUser.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
//         res.status(201).json({ token, user: newUser.rows[0] });
//         } catch (error) {
//             console.error("DEBUG ERROR:", error.message);
//             res.status(500).json({ 
//                 message: "Server Database Error", 
//                 error: error.message // This sends the ACTUAL error as JSON
//             });
//         }
// });

// app.post('/api/auth/login', async (req, res) => {
//     try {
//         const { email, password } = req.body;
//         const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
//         const user = result.rows[0];
//         if (!user || !(await bcrypt.compare(password, user.password))) {
//             return res.status(400).json({ message: "Invalid credentials." });
//         }
//         const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
//         res.json({ token, user: { name: user.name, email: user.email } });
//     } catch (error) {
//         console.error("DEBUG ERROR:", error.message);
//         res.status(500).json({ 
//             message: "Server Database Error", 
//             error: error.message // This sends the ACTUAL error as JSON
//         });
//     }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 LeaseIQ Backend running on port ${PORT}`));



























