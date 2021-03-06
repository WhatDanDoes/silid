import { useEffect, useState } from 'react';

const useGetAgentDirectoryService = (page) => {
  const [result, setResult] = useState({
    status: 'loading'
  });

  useEffect(() => {
    setResult({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    fetch(`/agent/admin/${page}`, { headers, credentials: 'include', mode: 'no-cors' })
      .then(response => response.json())
      .then(response => {
        if (response.message) {
          setResult({ status: 'loaded', payload: response });
        }
        else {
          setResult({ status: 'loaded', payload: { results: response } });
        }
      })
      .catch(error => setResult({ status: 'error', error }));

  }, [page]);

  return result;
};

export default useGetAgentDirectoryService;
