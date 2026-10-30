export function Feedback({ error, message }: { error?: string; message?: string }) {
  if (error) return <p className="feedback error" role="alert">{error}</p>;
  if (message) return <p className="feedback" role="status">{message}</p>;
  return null;
}
