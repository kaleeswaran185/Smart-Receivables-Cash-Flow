import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'baaki-backend', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Baaki backend listening on port ${PORT}`);
});
