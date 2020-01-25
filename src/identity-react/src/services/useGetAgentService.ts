import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Agent } from '../types/Agent';

const useAgentService = (id: number) => {
  const [result, setResult] = useState<Service<Agent>>({
    status: 'loading'
  });

  let url = '/agent';
  if (id) {
    url = `${url}/${id}`;
  }

  const headers = new Headers();
  headers.append('Access-Control-Allow-Credentials', 'true');
  headers.append('Content-Type', 'application/json; charset=utf-8');

  useEffect(() => {
    fetch(url, { headers })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: response }))
      .catch(error => setResult({ status: 'error', error }));
  }, []);

  return result;
};

export default useAgentService;
