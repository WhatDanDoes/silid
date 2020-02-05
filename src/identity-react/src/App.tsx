// src/App.js
// See: https://auth0.com/docs/quickstart/spa/react/01-login
import React, { useState } from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import Home from './routes/Home';
import Agent from './routes/Agent';
import Organization from './routes/Organization';
import OrganizationInfo from './routes/OrganizationInfo';
import Team from './routes/Team';
import { AuthProvider } from './auth/Auth';
import PrivateRoute from './components/PrivateRoute';

function App() {
  const [message] = useState('');

  return (
    <div className="App">
      <AuthProvider>
        <HashRouter>
          <Route
            path="/"
            render={props => <Home message={message} {...props} />}
          />
          <Switch>
            <PrivateRoute path="/agent/:id" component={Agent} redirect="/" />
            <PrivateRoute path="/agent" component={Agent} redirect="/" />
            <PrivateRoute path="/organization/:id" component={OrganizationInfo} redirect="/" />
            <PrivateRoute path="/organization" component={Organization} redirect="/" />
            <PrivateRoute path="/team/:id" component={Team} redirect="/" />
          </Switch>
        </HashRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
