import express from 'express';
import routes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'metrox-taxinvoo-backend' });
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
