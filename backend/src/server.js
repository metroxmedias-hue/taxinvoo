import dotenv from 'dotenv';
import app from './app.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, () => {
  console.log(`Metrox backend running on port ${PORT}`);
});
