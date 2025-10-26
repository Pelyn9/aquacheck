export default function handler(req, res) {
  res.status(200).json({
    ph: 7.4,
    turbidity: 3.2,
    temperature: 28.5,
    tds: 450
  });
}
