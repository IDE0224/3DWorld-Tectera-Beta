// The main web app file.

// Server port
const PORT = 80

// Imports
var express = require('express')
var http = require('http')
var createError = require('http-errors')
var bodyParser = require('body-parser')
var passport = require('passport')
var session = require('express-session')
var sessionStore = require('connect-sqlite3')(session)
var path = require('path')
var csrf = require('csurf')

// App files
var runApp = require("./app/run.js")
var initSocketIO = require("./app/socketio.js")
var ai = require("./app/ai.js")
var database = require("./database.js")

// Web server
var app = express()
var server = http.createServer(app)
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json())

// User login sessions
app.use(session({
  secret: 'session',
  resave: false,
  saveUninitialized: false,
  store: new sessionStore({ db: './database/sessions.db', dir: '.' })
}));

app.use(passport.authenticate('session')
app.use(function (req, res, next) {
  var msgs = req.session.messages || []
  res.locals.messages = msgs
  res.locals.hasMessages = !!msgs.length
  req.session.messages = []
  next();
});

// CSRF
app.use(csrf())
app.use(function (req, res, next) {
  res.locals.csrfToken = req.csrfToken()
  next()
})

// Routes
app.use('/', require('./index.js'))
app.use('/', require('./auth.js'))

// Init
runApp(app);
initSocketIO(server, database, ai)

// Errors
app.use(function (req, res, next) {
  next(createError(404));
});
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  res.status(err.status || 500);
  res.render('error');
});

// Start
server.listen(PORT);
console.log(`Web server listening at http://127.0.0.1:${PORT}`);

// Export
module.exports = app;
