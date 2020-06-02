import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';
import { useAdminState } from '../auth/Admin';

const useTeamInfoService = (id: number) => {
  const admin = useAdminState();

  const [result, setResult] = useState<Service<Team>>({
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
  }, [id]);

  return result;
};

export default useTeamInfoService;
