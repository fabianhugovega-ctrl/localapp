export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/config?select=id&limit=1';
  await fetch(url, {
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + process.env.VITE_SUPABASE_ANON_KEY,
    }
  });
  res.status(200).json({ ok: true });
}
