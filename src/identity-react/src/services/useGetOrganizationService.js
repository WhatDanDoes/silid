import { useEffect, useState } from 'react';
import { useAdminState } from '../auth/Admin';

const useOrganizationService = () => {
  const admin = useAdminState();

  const [result, setResult] = useState({
    status: 'loading'
  });

  useEffect(() => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    let url = '/organization';
    if (admin.isEnabled) {
      url += '/admin';
    }

    fetch(url, { headers, credentials: 'include', mode: 'no-cors' })
      .then(response => response.json())
      .then(response => {
        if (response.error) {
          setResult({ status: 'loaded', payload: response });
        }
        else {
          setResult({ status: 'loaded', payload: { results: response } });
        }
      })
      .catch(error => setResult({ status: 'error', error }));
  }, [admin.isEnabled]);

  return result;
};

export default useOrganizationService;
