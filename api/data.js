// /api/data.js
export default function handler(req, res) {
  res.status(200).json({
    ph: 7.0,
    turbidity: 2.5,
    temperature: 29.2,
    tds: 150,
  });
}
