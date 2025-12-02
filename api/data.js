// In pages/api/data.js POST response
return res.status(200).json({
  success: true,
  message: "Data received successfully!",
  data: latestData,   // <-- rename from latestData to data
});
