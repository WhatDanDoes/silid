import React from 'react';
import Auth from '../auth/Auth';
import AppBar from '../components/Appbar';

interface IProps {
  auth: Auth;
  message?: string;
}

const Home = (props: IProps) => {
  return (
    <div className="home">
      <AppBar {...props} />
      { props.message && (<h3>{props.message}</h3>) }
    </div>
  );
};

export default Home;
