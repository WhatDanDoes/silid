require('dotenv-flow').config();
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const logger = require('morgan');
const cors = require('cors');
//const serverless = require("serverless-http");


const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
const agentRouter = require('./routes/agent');
const organizationRouter = require('./routes/organization');
const teamRouter = require('./routes/team');

//const jwt = require('express-jwt');
//const jwksRsa = require('jwks-rsa');


var app = express();

/**
 * SPA client route
 */
//app.use('/', indexRouter);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.AUTH0_CLIENT_SECRET, // This seemed convenient
  resave: true,
  //cookie: { secure: false},
  saveUninitialized: true
}));

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  app.use(express.static(path.join(__dirname, 'build')));
}
else {
  app.use(express.static(path.join(__dirname, 'public')));
}

/**
 * passport-auth0
 */
const Auth0Strategy = require('passport-auth0');
const passport = require('passport');

const strategy = new Auth0Strategy({
   domain:       process.env.AUTH0_DOMAIN,
   clientID:     process.env.AUTH0_CLIENT_ID,
   clientSecret: process.env.AUTH0_CLIENT_SECRET,
   callbackURL:  '/callback'
  },
  function(accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in the most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user
    return done(null, profile);
  }
);

passport.use(strategy);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(id, done) {
  done(null, user);
});


app.use(passport.initialize());
app.use(passport.session());


/**
 * Access Token verification
 */
//const protocol = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e' ? 'http' : 'https';
//const checkJwt = jwt({
//  secret: jwksRsa.expressJwtSecret({
//    cache: true,
//    rateLimit: true,
//    jwksRequestsPerMinute: 5,
//    jwksUri: `${protocol}://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
//  }),
//
//  audience: process.env.AUTH0_AUDIENCE,
//  issuer: `${protocol}://${process.env.AUTH0_DOMAIN}/`,
//  requestProperty: 'agent',
//  algorithm: ['RS256']
//});
//
//app.use(checkJwt);

/**
 * Routes
 */
app.use('/', authRouter);
app.use('/agent', agentRouter);
app.use('/organization', organizationRouter);
app.use('/team', teamRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  console.error("ERROR", err);
  res.status(err.status || 500).json(err);


//  // set locals, only providing error in development
//  res.locals.message = err.message;
//  res.locals.error = req.app.get('env') === 'development' ? err : {};
//
//  // render the error page
//  res.status(err.status || 500);
//  res.render('error');
});

module.exports = app;
