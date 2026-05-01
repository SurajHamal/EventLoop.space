// api/satellite.js
export default async function handler(req, res) {
    // Allow your GitHub Pages domain + localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { type, id } = req.query;
    const apiKey = process.env.N2YO_API_KEY;

    let url;
    if (type === 'tle') {
        url = `https://api.n2yo.com/rest/v1/satellite/tle/${id}&apiKey=${apiKey}`;
    } else {
        url = `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/90/0&apiKey=${apiKey}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (e) {
        res.status(500).json({ error: 'Fetch failed', detail: e.message });
    }
}