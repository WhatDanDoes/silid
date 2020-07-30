// src/App.js
// See: https://auth0.com/docs/quickstart/spa/react/01-login
import React, { useState } from 'react';
import { HashRouter, Route, Switch } from 'react-router-dom';
import Home from './routes/Home';
import AgentDirectory from './routes/AgentDirectory';
import Agent from './routes/Agent';
import Organization from './routes/Organization';
import OrganizationInfo from './routes/OrganizationInfo';
import Team from './routes/Team';
import TeamInfo from './routes/TeamInfo';
import { AuthProvider } from './auth/Auth';
import { AdminProvider } from './auth/Admin';
import PrivateRoute from './components/PrivateRoute';
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles';
import { IntlProvider, FormattedMessage } from "react-intl";

/**
 * Localization
 */
const messages = {
  eng: {
    profileTable: {
      header: 'Profile',
      email: 'Email',
      providerLocale: 'Provider Locale',
      silLocale: 'SIL Locale',
      Roles: 'Roles',
    },
    teamsTable: {
      header: 'Teams',
      name: 'Name',
      leader: 'Leader',
      empty: 'No records to display',
    },
    socialData: {
      header: 'Social Data',
    }
  },
  tlh: {
    profileTable: {
      header: 'tlhIlHal De\'',
      email: 'De\'wI\' QIn',
      providerLocale: 'Latlh Hol',
      silLocale: 'SIL Hol',
      Roles: 'Naw\'',
    },
    teamsTable: {
      header: 'Ghom',
      name: 'Pong',
      leader: 'DevwI\'',
      empty: 'Pagh ta',
    },
    socialData: {
      header: 'BoS De\'',
    }

  },
};

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
        <AdminProvider>
          <IntlProvider locale='eng' messages={messages['eng']}>
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
                  <PrivateRoute path="/organization/admin" component={Organization} redirect="/" />
                  <PrivateRoute path="/organization/:id" component={OrganizationInfo} redirect="/" />
                  <PrivateRoute path="/organization" component={Organization} redirect="/" />
                  <PrivateRoute path="/team/admin" component={Team} redirect="/" />
                  <PrivateRoute path="/team/:id" component={TeamInfo} redirect="/" />
                  <PrivateRoute path="/team" component={Team} redirect="/" />
                </Switch>
              </HashRouter>
            </ThemeProvider>
          </IntlProvider>
        </AdminProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
