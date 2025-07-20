// database.js: Creates and manages the database

// Imports
var sqlite3 = require('sqlite3');
var mkdirp = require('mkdirp');
var crypto = require('crypto');

// Create or open database
mkdirp.sync('./database/');
var db = new sqlite3.Database('./database/database.db');

// Hash password function
db.hashPassword = function(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256');
}

// Create tables
db.serialize(function() {
  // Create users table
  db.run("CREATE TABLE IF NOT EXISTS users ( \
    id INTEGER PRIMARY KEY, \
    username TEXT UNIQUE, \
    name TEXT, \
    email TEXT UNIQUE, \
    email_verified INTEGER, \
    hashed_password BLOB, \
    salt BLOB, \
    token TEXT, \
    login DATE \
  )");

  // Create times table
  db.run("CREATE TABLE IF NOT EXISTS times ( \
    owner_id INTEGER, \
    username TEXT, \
    time DATE NOT NULL, \
    status TEXT, \
    PRIMARY KEY (owner_id, time) \
  )");

  // Chat history
  const createTableQuery = `
  CREATE TABLE IF NOT EXISTS chat_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  db.run(createTableQuery, (err, result) => {
    if (err) throw err;
  });

  // Add user
  var salt = crypto.randomBytes(16);
  db.run('INSERT OR IGNORE INTO users (username, name, email, hashed_password, salt) VALUES (?, ?, ?, ?, ?)', [
    'admin@drinks.chat',
    'Tom',
    'admin@drinks.chat',
    db.hashPassword('Drinks256', salt),
    salt
  ]);

  // List users
  var query = "SELECT * FROM users";
  db.all(query, [], (err, rows) => {
    console.log("Users:");
    console.log(rows);
  });
});


// Rooms
db.storeMessage = function(room, username, message) {
  const query = 'INSERT INTO chat_history (room, username, message) VALUES (?, ?, ?)';
  db.all(query, [room, username, message], (err, result) => {
    if (err) throw err;
    console.log("Message in " + room + ": " + message);
  });
}

db.loadChatHistory = function(room, callback) {
  const query = 'SELECT * FROM chat_history WHERE room = ? ORDER BY timestamp';
  db.all(query, [room], (err, results) => {
    if (err) throw err;
    callback(results);
  });
}

// Export
module.exports = db;
