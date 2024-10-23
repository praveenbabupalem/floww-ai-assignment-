const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

// Initialize the app
const app = express();


// Middleware
app.use(bodyParser.json()); // To parse JSON requests

// Initialize SQLite database
const db = new sqlite3.Database(path.resolve(__dirname, 'database.db'), (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create the 'categories' table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense'))
            )
        `);

        // Create the 'transactions' table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                description TEXT,
                FOREIGN KEY (category) REFERENCES categories(name)
            )
        `);
    }
});


// Start the server
app.listen(3000, () => {
    console.log(`Server is running on http://localhost:${3000}`);
});

app.post('/transactions', (req, res) => {
    const { type, category, amount, date, description } = req.body;

    // Validate required fields
    if (!type || !category || !amount || !date) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const sql = `INSERT INTO transactions (type, category, amount, date, description) VALUES (?, ?, ?, ?, ?)`;
    const params = [type, category, amount, date, description];

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        res.status(201).json({
            "message": "Transaction added",
            "transactionId": this.lastID
        });
    });
});

app.get('/transactions', (req, res) => {
    const sql = `SELECT * FROM transactions`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        res.status(200).json(rows);
    });
});

app.get('/transactions/:id', (req, res) => {
    const { id } = req.params;

    const sql = `SELECT * FROM transactions WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.status(200).json(row);
    });
});

app.put('/transactions/:id', (req, res) => {
    const { id } = req.params;
    const { type, category, amount, date, description } = req.body;

    const sql = `UPDATE transactions SET type = ?, category = ?, amount = ?, date = ?, description = ? WHERE id = ?`;
    const params = [type, category, amount, date, description, id];

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.status(200).json({ message: "Transaction updated successfully" });
    });
});

app.delete('/transactions/:id', (req, res) => {
    const { id } = req.params;

    const sql = `DELETE FROM transactions WHERE id = ?`;
    db.run(sql, id, function(err) {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.status(200).json({ message: "Transaction deleted successfully" });
    });
});

app.get('/summary', (req, res) => {
    const { startDate, endDate, category } = req.query;

    let sql = `SELECT 
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS totalIncome,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS totalExpense,
                    (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) - 
                     SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)) AS balance
                FROM transactions
                WHERE 1=1`;

    const params = [];

    // Apply date range filter
    if (startDate) {
        sql += ` AND date >= ?`;
        params.push(startDate);
    }
    if (endDate) {
        sql += ` AND date <= ?`;
        params.push(endDate);
    }

    // Apply category filter
    if (category) {
        sql += ` AND category = ?`;
        params.push(category);
    }

    db.get(sql, params, (err, row) => {
        if (err) {
            return res.status(400).json({ "error": err.message });
        }
        res.status(200).json(row);
    });
});

