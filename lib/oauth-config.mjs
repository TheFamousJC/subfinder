export function googleClientError(id) {
  if(typeof id!=='string' || !/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id.trim())) return 'Enter the complete Google OAuth Client ID ending in .apps.googleusercontent.com. A Gmail address, project ID, API key, or client secret cannot be used as the Client ID.';
  return null;
}
