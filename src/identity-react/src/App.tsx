// src/App.js
// See: https://auth0.com/docs/quickstart/spa/react/01-login
import React, { useState } from 'react';
import { Redirect } from 'react-router-dom';
import { BrowserRouter, HashRouter, Route, Switch } from 'react-router-dom';
import Home from './routes/Home';
import Agent from './routes/Agent';
import Organization from './routes/Organization';
import OrganizationInfo from './routes/OrganizationInfo';
import Team from './routes/Team';
import Auth from './auth/Auth';
import Callback from './callback/Callback';
import { parseQuery } from './utils/parseQuery';
import PrivateRoute from './components/PrivateRoute';

const auth = new Auth();

function App() {
  const [message, setMessage] = useState('');

  const handleAuthentication = (props: any) => {
    const { location } = props;
    if (location.search !== '') {
      const params = parseQuery(location.search);
      if (params.inviteId && typeof params.inviteId === 'string') {
        localStorage.setItem('inviteId', params.inviteId);
      }
    }
    if (/access_token|id_token|error/.test(location.hash)) {
      auth.handleAuthentication().then(res => {
        console.log(res);
      }).catch(err => {
        console.log(err);
        setMessage('Something went terribly wrong');
      });
    }
  };

  return (
    <div className="App">
      <HashRouter>
        <Route
          path="/"
          render={props => <Home auth={auth} message={message} {...props} />}
        />
        <Switch>
          <PrivateRoute path="/agent/:id" auth={auth} component={Agent} redirect="/" />
          <PrivateRoute path="/agent" auth={auth} component={Agent} redirect="/" />
          <PrivateRoute path="/organization/:id" auth={auth} component={OrganizationInfo} redirect="/" />
          <PrivateRoute path="/organization" auth={auth} component={Organization} redirect="/" />
          <PrivateRoute path="/team/:id" auth={auth} component={Team} redirect="/" />
        </Switch>
      </HashRouter>
    </div>
  );
}
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
