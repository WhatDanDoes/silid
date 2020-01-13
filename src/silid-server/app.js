require('dotenv-flow').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const serverless = require("serverless-http");

var indexRouter = require('./routes/index');
var agentRouter = require('./routes/agent');
var organizationRouter = require('./routes/organization');
var teamRouter = require('./routes/team');

const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');


var app = express();

/**
 * SPA client route
 */
app.use('/', indexRouter);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  app.use(express.static(path.join(__dirname, 'build')));
}
else {
  app.use(express.static(path.join(__dirname, 'public')));
}

/**
 * Access Token verification
 */
const protocol = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e' ? 'http' : 'https';
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${protocol}://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
  }),

  audience: process.env.AUTH0_AUDIENCE,
  issuer: `${protocol}://${process.env.AUTH0_DOMAIN}/`,
  requestProperty: 'agent',
  algorithm: ['RS256']
});

app.use(checkJwt);

/**
 * Routes
 */
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
