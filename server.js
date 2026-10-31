// Backend: a small Express server. It serves the web page and exposes two API routes.
const express = require('express');
const path = require('path');
const { calculate } = require('./queueModels');

const app = express();
app.use(express.json());                                    // read JSON sent by the page
app.use(express.static(__dirname));                         // serve frontend files from current directory

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Run the chosen single-server queue model
app.post('/api/calculate', (req, res) => {
  try {
    res.json(calculate(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });           // bad input -> readable message
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Petrol queue calculator running at http://localhost:${PORT}`));
