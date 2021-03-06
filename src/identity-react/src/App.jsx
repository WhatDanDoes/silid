// src/App.js
// See: https://auth0.com/docs/quickstart/spa/react/01-login
import React, { useState } from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import Home from './routes/Home';
import AgentDirectory from './routes/AgentDirectory';
import Agent from './routes/Agent';
import { AuthProvider } from './auth/Auth';
import { AdminProvider } from './auth/Admin';
import PrivateRoute from './components/PrivateRoute';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { LanguageProvider } from './components/LanguageProvider';

/**
 * Colour everything SIL blue
 */
const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#005c99',
    },
  },
});

function App() {
  const [message] = useState('');

  return (
    <div className="App">
      <AuthProvider>
        <LanguageProvider>
          <AdminProvider>
            <ThemeProvider theme={theme}>
              <HashRouter>
                <Route
                  path="/"
                  render={props => <Home message={message} {...props} />}
                />
                <Switch>
                  <PrivateRoute path="/agent/admin" component={AgentDirectory} redirect="/" />
                  <PrivateRoute path="/agent/:id" component={Agent} redirect="/" />
                  <PrivateRoute path="/agent" component={Agent} redirect="/" />
                </Switch>
              </HashRouter>
            </ThemeProvider>
          </AdminProvider>
        </LanguageProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
