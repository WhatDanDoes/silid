require('dotenv-flow').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');
const cors = require('cors');
const jsonwebtoken = require('jsonwebtoken');

const getManagementClient = require('./lib/getManagementClient');
const apiScope = require('./config/apiPermissions');

/**
 * Routes
 */
const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
const agentRouter = require('./routes/agent');
const roleRouter = require('./routes/role');
const localeRouter = require('./routes/locale');
const timezoneRouter = require('./routes/timezone');

const app = express();

// Cookies won't be set in production unless you trust the proxy behind which this software runs
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  app.set('trust proxy', 1);
}

/**
 * view engine setup
 */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Set up database-managed sessions
 */
const db = require('./models');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const store = new SequelizeStore({ db: db.sequelize });

/**
 * Note the cookie configuration...
 *
 * In order to logout of every Identity/Auth0-managed app, a logout request is
 * sent to each application's `/logout` endpoint from an `iframe`. Cookies only
 * accompany these requests if `SameSite=None; Secure`.
 */
const sessionConfig = {
  name: 'silid-server',
  secret: process.env.AUTH0_CLIENT_SECRET, // This seemed convenient
  store: store,
  resave: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
  },
  saveUninitialized: true
};

if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  sessionConfig.cookie.httpOnly = false;
  sessionConfig.cookie.sameSite = 'none';
  sessionConfig.cookie.secure = true;
}

app.use(session(sessionConfig));

/**
 * SPA client route
 *
 * Express handles Auth0 login and the subsequent session. If an agent is not
 * authenticated, a sign-on landing page is presented. If an agent is
 * authenticated, the client app is delivered
 */
app.use('/', indexRouter);

if (process.env.NODE_ENV === 'e2e') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

if (
  process.env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'staging' ||
  process.env.TEST_BUILD
) {
  app.use(express.static(path.join(__dirname, 'build')));
  app.use(express.static(path.join(__dirname, 'public')));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

/**
 * passport-auth0
 */
const Auth0Strategy = require('passport-auth0');
const passport = require('passport');

const strategy = new Auth0Strategy(
  {
    domain: process.env.AUTH0_CUSTOM_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  function(accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user

    /**
     * 2020-3-19 https://community.auth0.com/t/how-to-check-role-of-user-in-express-application/27525/8
     */
    let decoded = jsonwebtoken.decode(accessToken);

    const managementClient = getManagementClient(apiScope.read.users);
    managementClient.getUser({id: profile.user_id}).then(agent => {
      if (!agent.user_metadata) {
        agent.user_metadata = {};
      }

      agent.scope = decoded.permissions;

      return done(null, agent);
    }).catch(err => {
      return done(err);
    });
  }
);

passport.use(strategy);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(idToken, done) {
  done(null, idToken);
});

app.use(passport.initialize());
app.use(passport.session());

/**
 * Use routes
 */
app.use('/', authRouter);
app.use('/agent', agentRouter);
app.use('/role', roleRouter);
app.use('/locale', localeRouter);
app.use('/timezone', timezoneRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  console.error('ERROR', err);
  res.status(err.statusCode || 500).json(err);
});

module.exports = app;
