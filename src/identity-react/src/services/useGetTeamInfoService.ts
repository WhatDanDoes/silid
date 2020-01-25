import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';

const useTeamInfoService = (id: number) => {
  const [result, setResult] = useState<Service<Team>>({
    status: 'loading'
  });

  const headers = new Headers();
  headers.append('Access-Control-Allow-Credentials', 'true');
  headers.append('Content-Type', 'application/json; charset=utf-8');

  useEffect(() => {
    fetch(`/team/${id}`, { headers })
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
  }, []);

  return result;
};

export default useTeamInfoService;
