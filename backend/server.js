const express = require("express"); // Import express
const cors = require("cors"); // Import CORS

const app = express(); // Create an Express app
app.use(cors()); // Enable CORS so frontend can connect

// Route for testing
app.get("/", (req, res) => {
  res.send("Backend is working 🚀");
});

// Start the server
const PORT = 5000; // Port number
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
