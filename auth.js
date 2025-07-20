var express = require('express');
var passport = require('passport');
var password = require('passport-local');
var crypto = require('crypto');
var email = require('@sendgrid/mail');

// Database
var db = require('./database.js');

var router = express.Router();

var EMAIL = "admin@drinks.chat";
var PASSWORD = "Drinks256";
var DOMAIN = "drinks.chat";
email.setApiKey("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");

passport.use(new password(function verify(username, password, cb) {
  // Query user
  username = username.toLowerCase();
  db.get('SELECT * FROM users WHERE username = ?', [username], function(err, row) {
	  
    if (err) { return cb(err); }
    if (!row) { return cb(null, false, { message: 'Incorrect email or password.' }); }

    // Check password
    var hashedPassword = db.hashPassword(password, row.salt);
    if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
      return cb(null, false, { message: 'Incorrect email or password.' });
    }

    // Update login date
    console.log("Login: " + username);
    db.run('UPDATE users SET login=DateTime() WHERE username=?', [username], function(err) {
      if (err) { return cb(err); }
      // Accept login
      return cb(null, row);
    });
  });
}));

// Set data stored in the session
passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user.id, username: user.username });
  });
});
passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

// Log in and sign up pages
router.get('/login',    function(req, res, next) { res.render('login');    });
router.get('/signup',   function(req, res, next) { res.render('signup');   });
router.get('/password', function(req, res, next) { res.render('password'); });
router.get('/reset',    function(req, res, next) { res.render('reset');    });

// Send email to reset password
router.post('/password', function(req, res, next) {
  // Query user
  username = req.body.username.toLowerCase();
  db.get('SELECT * FROM users WHERE username = ?', [username], function(err, row) {
    if (!row) { return res.render('password', {hasMessages: true, messages: ['No email. ' + username]}); }

    // Save token
    var token = crypto.randomBytes(16).toString('hex');
    db.run('UPDATE users SET token=? WHERE username=?', [token, username],
    function(err) {
      // Send reset password email
      var user = {username: username};
      sendEmail(user, 'password', token);

      // Show
      return res.render('password', {hasMessages: true, messages: ['Check your email: ' + username]});
    });
  });
});

// Reset password
router.post('/reset', function(req, res, next) {
  // Query user
  username = req.body.username.toLowerCase();
  db.get('SELECT * FROM users WHERE username = ?', [username], function(err, row) {
    if (err) { return next(err); }
    if (!row) { return res.render('reset', {hasMessages: true, messages: ['No email. ' + username]}); }

    // Check token
    console.log("Checking token: " + req.body.token);
    if (row.token == null || row.token == "" || req.body.token != row.token) {
      console.log("Bad token: " + req.body.token + ", " + row.token);
      return res.render('reset', {hasMessages: true, messages: ['Bad token: ' + req.body.token]});
    }
    console.log("Token ok: " + req.body.token + ", " + row.token);

    // Change to new password
    var salt = crypto.randomBytes(16);
    var hashedPassword = db.hashPassword(req.body.newpassword, salt);
    db.run('UPDATE users SET hashed_password=?, salt=? WHERE username=?', [hashedPassword, salt, username],
    function(err) {
    if (err) { return res.render('reset', {hasMessages: true, messages: ['Error updating password. ' + err]}); }
      // Log in
      var user = { username: username };
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
    });
  });
});

// Sign up
router.post('/signup', function(req, res, next) {
  var salt = crypto.randomBytes(16);
  var hashedPassword = db.hashPassword(req.body.password, salt);
  username = req.body.username.toLowerCase();
  db.run('INSERT INTO users (username, email, name, hashed_password, salt) VALUES (?, ?, ?, ?, ?)', [
      username, // username
      username, // email
      username, // name
      hashedPassword,
      salt
  ], function(err) {
    if (err) { return res.render('signup', {hasMessages: true, messages: ['Account exists, please log in.']}); }

    // Create user
    var user = {
      id: this.lastID,
      username: username
    };

    // Send validation email
    var token = crypto.randomBytes(16).toString('hex');
    sendEmail(user, 'validate', token);

    // Log in
    req.login(user, function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });
});

// Log in
router.post('/login/password', passport.authenticate('local', {
  successReturnToOrRedirect: '/',
  failureRedirect: '/login',
  failureMessage: true
}));

// Log out
router.all('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// List users
router.get('/api/list', function(req, res) {
  // Only allow admin to do so
  username = req.user.username.toLowerCase();
  if (req != null && req.user != null && username == EMAIL) {
    db.all('SELECT * FROM users', function(err, rows) {
      if (err) {
        console.error(err);
        res.status(500).send('Server error');
        return;
      }
      res.json(rows);
    });
  }
});

// Send email
function sendEmail(user, type, token) {
  // Check user email
  if (user == null) { console.log("No user"); return false; }
  if (user.email == null) user.email = user.username;
  console.log("Sending " + type + " email to " + user.email);
	
  // Type
  var link = `${DOMAIN}/confirm?email=${user.email}&token=${token}`;
  var subject = 'Welcome to Drinks';
  var html = '<h3>Hello!</h3><p>Click the link to confirm your email: <a href="' + link + '">Log in</a></p>';
  if (type == "password") {
    link = `${DOMAIN}/reset?email=${user.email}&token=${token}`;
    subject = 'Reset password';
    html = '<h3>Hello!</h3><p>You suck!</p><p>Click the link to reset your password: <a href="' + link + '">Reset password</a></p>';
  }

  // Send email
  var message = {
    to: user.email,
    from: EMAIL,
    subject: subject,
    html: html,
  };
  email.send(message, (error, result) => {
    if (error) {
	console.log("Error: " + error);
    }
  });
}

function confirmEmail(user) {
  // Confirm email
  console.log("Confirming email " + user.email);
  db.get('SELECT * FROM users WHERE email = ?', [user.email], function(err, row) {
      if (err) { return err; }
      if (!row) {
        db.run('INSERT INTO users (email, email_verified) VALUES (?, ?)', [user.email, 1], function(err) {
          if (err) { return err; }
	  return true;
        });
      } else {
        return row;
      }
    });
}

// Confirm
router.get('/confirm', function (req, res, next) {
  res.render('login');
});

// Export
module.exports = router;
