// Only the reset endpoint's explicit 204 response allows local data to be cleared.
export async function restartDemoRequest(apiUrl: string, fetcher: typeof fetch = fetch): Promise<void> {
  let response: Response;
  try {
    response = await fetcher(`${apiUrl}/demo/data`, { method: 'DELETE' });
  } catch {
    throw new Error('Could not reach the Moodi backend. No device data was cleared.');
  }
  if (response.status === 204) return;
  if (response.status === 404) {
    const healthy = await fetcher(`${apiUrl}/health`).then(async result => {
      if (!result.ok) return false;
      const body: unknown = await result.json();
      return body !== null && typeof body === 'object' && 'status' in body && body.status === 'ok';
    }).catch(() => false);
    throw new Error(healthy
      ? 'Restart demo is disabled or missing on this backend. Use an updated development backend. No device data was cleared.'
      : 'The configured backend address is unavailable. Check that the backend and any ngrok tunnel are running. No device data was cleared.');
  }
  throw new Error('Could not clear backend demo data. No device data was cleared.');
}
