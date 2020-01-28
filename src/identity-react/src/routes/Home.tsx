import React from 'react';
import AppBar from '../components/Appbar';

interface IProps {
  message?: string;
  logout: any;
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
