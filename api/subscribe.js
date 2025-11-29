export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const response = await fetch(
      "https://api.beehiiv.com/v2/publications/ebbe4851-b5f1-47ab-b1a7-a056b51f17cd/subscribers",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": process.env.BEEHIIV_API_KEY,
        },
        body: JSON.stringify({
          email,
          send_welcome_email: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data });
    }

    return res.status(200).json({ success: true, subscriber: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
