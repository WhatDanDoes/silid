import React from 'react';
import Auth from '../auth/Auth';
import AppBar from '../components/Appbar';

interface IProps  {
  auth: Auth;
}
  const Home = (props: IProps) => {
    console.log('test');
    const { auth } = props;

    return (
      <div className="home">
      <AppBar {...props} />
        {
          auth.isAuthenticated() && (
              <h4>
                You are logged in!
              </h4>
            )
        }
        {
          !auth.isAuthenticated() && (
              <h4>
                You are not logged in! Please log in to continue.
              </h4>
            )
        }
      </div>
    );
  }


export default Home;
