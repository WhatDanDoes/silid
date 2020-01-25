// src/App.js
// See: https://auth0.com/docs/quickstart/spa/react/01-login
import React, { useState } from 'react';
import { Redirect } from 'react-router-dom';
import { BrowserRouter, HashRouter, Route, Switch } from 'react-router-dom';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Home from './routes/Home';
import Agent from './routes/Agent';
import Organization from './routes/Organization';
import OrganizationInfo from './routes/OrganizationInfo';
import Team from './routes/Team';
import { AuthProvider, useAuthState } from './auth/Auth';
import Callback from './callback/Callback';
import { parseQuery } from './utils/parseQuery';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const [message, setMessage] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const handleAuthentication = (props: any) => {
    setLoggingIn(true);
  };

  return (
    <div className="App">
      { loggingIn ?
        <AuthProvider>
          <HashRouter>
            <Route
              path="/"
              render={props => <Home message={message} {...props} />}
            />
            <Switch>
              <PrivateRoute path="/agent/:id" component={Agent} redirect="/" />
            </Switch>
          </HashRouter>
        </AuthProvider>
      :
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6">
              Identity
            </Typography>
            <Button
              id="login-button"
              color="inherit"
              onClick={() => {
                setLoggingIn(true);
              }}
            >
              Login
            </Button>
          </Toolbar>
        </AppBar>
      }
    </div>
  );
}

//          <PrivateRoute path="/agent" auth={agent} component={Agent} redirect="/" />
//          <PrivateRoute path="/organization/:id" auth={agent} component={OrganizationInfo} redirect="/" />
//          <PrivateRoute path="/organization" auth={agent} component={Organization} redirect="/" />
//          <PrivateRoute path="/team/:id" auth={agent} component={Team} redirect="/" />

//      <BrowserRouter>
//        <Route
//            path="/callback*"
//            render={props => {
//              console.log('props');
//              console.log(props);
////              handleAuthentication(props);
//              return <Callback {...props} />;
//            }}
//          />
//      </BrowserRouter>



export default App;
