import React from 'react';
import AppBar from '../components/Appbar';

import { useAuthState } from '../auth/Auth';
import { Redirect } from 'react-router-dom';

import { useLanguageProviderState } from '../components/LanguageProvider';

interface IProps {
  message?: string;
}

const Home = (props: IProps) => {
  const {agent} = useAuthState();

  const { messages } = useLanguageProviderState();

  return (
    <div className="home">
      <AppBar {...props} />
      { props.message && (<h3>{props.message}</h3>) }
      { agent ?
        <Redirect to={{ pathname: '/agent', state: `${messages['Hello'] || 'Hello'}, ${agent.name}` }} />
      : ''}
    </div>
  );
};

export default Home;
