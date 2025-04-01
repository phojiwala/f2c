const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'figma_converter',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.post('/api/figma/fetch', async (req, res) => {
  try {
    const { fileKey, accessToken } = req.body;
    const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 'X-Figma-Token': accessToken }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching Figma file:', error);
    res.status(500).json({ error: 'Failed to fetch Figma data' });
  }
});

app.post('/api/figma/generate', async (req, res) => {
  try {
    const { fileKey, accessToken } = req.body;
    const response = await axios.get(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { 'X-Figma-Token': accessToken }
    });
    const components = extractComponents(response.data);
    res.json(components);
  } catch (error) {
    console.error('Error generating components:', error);
    res.status(500).json({ error: 'Failed to generate components' });
  }
});

function extractComponents(figmaData) {
  const components = [];
  function traverse(node) {
    if (node.type === 'FRAME' || node.type === 'COMPONENT') {
      components.push({
        name: node.name,
        type: node.type,
        styles: node.styles || {},
        children: node.children ? node.children.map(child => child.id) : []
      });
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  traverse(figmaData.document);
  return components;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
