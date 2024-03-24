const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

class DbManager {
    constructor() {
        this.dbPath = path.join(__dirname, '../db/data.db');
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database', err.message);
            } else {
                console.log('Connected to database.');
                this.initializeDb();
            }
        });
    }

    initializeDb() {
        const usersTableSql = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                level TEXT CHECK( level IN ('admin','user') ) NOT NULL DEFAULT 'user',
                scannerconfig TEXT,
                allowedSystems TEXT
            )`;

        this.db.run(usersTableSql, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                console.log('Users table is ready.');
                this.ensureAdminExists();
            }
        });
    }

    ensureAdminExists() {
        this.db.get(`SELECT id FROM users`, (err, row) => {
            if (err) {
                console.error('Error checking for admin user', err.message);
            } else if (!row) {
                console.log('No users found, creating default admin...');
                this.addUser('admin', 'adminpass', 'admin', {}, {});
            }
        });
    }

    async addUser(username, password, level, scannerConfig, allowedSystems) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (username, password, level, scannerconfig, allowedSystems)
                     VALUES (?, ?, ?, ?, ?)`;

        this.db.run(sql, [username, hashedPassword, level, JSON.stringify(scannerConfig), JSON.stringify(allowedSystems)], (err) => {
            if (err) {
                console.error('Error adding user', err.message);
            } else {
                console.log('User added successfully.');
            }
        });
    }

    updateUser(username, { password, level, scannerConfig, allowedSystems }) {
        let updates = [];
        let sql = `UPDATE users SET `;
        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updates.push(`password = '${hashedPassword}'`);
        }
        if (level) updates.push(`level = '${level}'`);
        if (scannerConfig) updates.push(`scannerconfig = '${JSON.stringify(scannerConfig)}'`);
        if (allowedSystems) updates.push(`allowedSystems = '${JSON.stringify(allowedSystems)}'`);

        sql += updates.join(', ') + ` WHERE username = ?`;

        this.db.run(sql, [username], function(err) {
            if (err) {
                console.error('Error updating user', err.message);
            } else {
                console.log(`User ${username} updated successfully.`);
            }
        });
    }

    deleteUser(username) {
        const sql = `DELETE FROM users WHERE username = ?`;

        this.db.run(sql, [username], (err) => {
            if (err) {
                console.error('Error deleting user', err.message);
            } else {
                console.log(`User ${username} deleted successfully.`);
            }
        });
    }

    getUser(username, callback) {
        const sql = `SELECT * FROM users WHERE username = ?`;

        this.db.get(sql, [username], (err, row) => {
            if (err) {
                console.error('Error fetching user', err.message);
                callback(err, null);
            } else {
                callback(null, row);
            }
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing the database', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

module.exports = DbManager;