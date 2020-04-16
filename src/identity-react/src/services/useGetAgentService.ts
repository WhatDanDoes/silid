import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Agent } from '../types/Agent';

const useAgentService = (id: number, getCached: boolean) => {
  const [result, setResult] = useState<Service<Agent>>({
    status: 'loading'
  });

  useEffect(() => {
    let url = '/agent';
    if (id) {
      url = `${url}/${id}${getCached ? '/cached' : ''}`;
    }

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    fetch(url, { headers })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: response.socialProfile }))
      .catch(error => setResult({ status: 'error', error }));
  }, [id, getCached]);

  return result;
};

export default useAgentService;
