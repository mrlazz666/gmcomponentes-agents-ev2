const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
  path: path.join(__dirname, '.env')
});

const faqRoute = require('./routes/faq.route');
const recommendationRoute = require('./routes/recommendation.route');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'gmcomponentes_ia_demo_proxy' });
});

app.use('/api/faq', faqRoute);
app.use('/api/recommendation', recommendationRoute);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Groq proxy escuchando en http://localhost:${port}`);
});
