import { latestData } from "./upload";

export default function handler(req, res) {
  res.status(200).json(latestData);
}
