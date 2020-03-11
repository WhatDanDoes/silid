import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuthState } from '../auth/Auth';

const PrivateRoute = ({ component: Component, ...rest }) => {
  const {agent} = useAuthState();

  return (
    <Route {...rest} render={(props) => (
      agent
        ? <Component {...props} />
        : <Redirect to='/' />
    )} />
  );
};

export default PrivateRoute;
