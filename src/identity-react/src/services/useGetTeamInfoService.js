import { useEffect, useState } from 'react';
import { useAdminState } from '../auth/Admin';

const useTeamInfoService = (id) => {
  const admin = useAdminState();

  const [result, setResult] = useState({
    status: 'loading'
  });

  useEffect(() => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    fetch(`/team/${id}${admin.isEnabled ? '/admin' : ''}`, { headers })
      .then(response => response.json())
      .then(response => {
        if (response.message) {
          setResult({ status: 'error', error: response.message })
        }
        else {
          setResult({ status: 'loaded', payload: response })
        }
      })
      .catch(error => setResult({ status: 'error', error }));
  }, [id, admin.isEnabled]);

  return result;
};

export default useTeamInfoService;
