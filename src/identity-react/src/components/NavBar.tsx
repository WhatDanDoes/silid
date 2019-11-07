// src/components/NavBar.tsx
import React from 'react';
import { useAuth0 } from '../react-auth0-wrapper';
import { Link } from 'react-router-dom';

const NavBar = () => {
  const { isAuthenticated, logout } = useAuth0();

  return (
    <div>
      {isAuthenticated && <button onClick={() => logout()}>Logout</button>}
      {isAuthenticated && (
        <span>
          <Link to="/">Home</Link>&nbsp;
          <Link to="/profile">Profile</Link>
          <Link to="/external-api">External API</Link>
        </span>
      )}
    </div>
  );
};

export default NavBar;
