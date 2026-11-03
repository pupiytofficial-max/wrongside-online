const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'WRONGSIDE.html'));
});

app.listen(PORT, () => {
  console.log(`WRONGSIDE (mobile) server running on port ${PORT}`);
});
