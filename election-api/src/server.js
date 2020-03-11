const express = require('express');
const { createVote } = require('./controllers/voteController');
const PORT = process.env.PORT || 5000;

// create express instance
const app = express();

// use JSON bodyparser
app.use(express.json());

// entry point
app.get('/', (req, res) => res.status(200).send('OK'));

// POST vote
app.post('/vote', (req, res) => createVote(req, res));

// start the server
app.listen(PORT, () => {
  console.log(`Election API running on port ${PORT}`);
});


