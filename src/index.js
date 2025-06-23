const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/connectDb');
const configMiddlewares = require('./config/configMiddlewares');
const setupRoutes = require('./config/routes');
// const startServer = require('./config/startServer'); // <- this file
const otherRoutes = require('./config/otherRoutes');

const app = express();

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '30mb' }));

configMiddlewares(app);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Load all routes
app.set('trust proxy', 1);
setupRoutes(app);

// Connect DB and then start the server
connectDB().then(() => {
    otherRoutes(app); // <- Start server only after DB connection
});
