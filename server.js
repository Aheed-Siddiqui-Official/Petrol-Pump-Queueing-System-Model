// Backend: a small Express server. It serves the web page and exposes two API routes.
const express = require('express');
const path = require('path');
const { calculate } = require('./queueModels');
const petrolData = require('./petrolData');

const app = express();
app.use(express.json());                                    // read JSON sent by the page
app.use(express.static(__dirname));                         // serve frontend files from current directory

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route 1: our measured petrol pump numbers (used by the "Load petrol pump data" button)
app.get('/api/petrol-data', (req, res) => res.json(petrolData));

// Route 2: run the chosen queue model
app.post('/api/calculate', (req, res) => {
  try {
    res.json(calculate(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });           // bad input -> readable message
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Petrol queue calculator running at http://localhost:${PORT}`));
