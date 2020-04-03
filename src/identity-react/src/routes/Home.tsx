import React from 'react';
import AppBar from '../components/Appbar';

import { useAuthState } from '../auth/Auth';
import { Redirect } from 'react-router-dom';

interface IProps {
  message?: string;
}

const Home = (props: IProps) => {
  const {agent} = useAuthState();

  return (
    <div className="home">
      <AppBar {...props} />
      { props.message && (<h3>{props.message}</h3>) }
      { agent ?
        <Redirect to={{ pathname: '/agent', state: `Hello, ${agent.name}` }} />
      : ''}
    </div>
  );
};

export default Home;
