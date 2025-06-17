require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/connectDb');
const configMiddlewares = require('./config/configMiddlewares');


const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
// Configure middlewares
configMiddlewares(app);

// setting the session
app.use(
  session({
    secret: 'SESSION_SECRET',
    resave: false,
    saveUninitialized: true
  })
);

// initialize passport
app.use(passport.initialize());
app.use(passport.session());

// loading authentication strategies(Google, Facebook)
// require('./auth/GoogleStrategy')(passport);
// require("./auth/FacebookStrategy")(passport);

// Initialize routes
routes(app);


// Connect to the database
connectDB();



// 
// connectRedis();








