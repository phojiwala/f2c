const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');

// --- Import necessary helper functions ---
const { flattenNodes, findLogoNode } = require('../lib/figma-node-helpers'); // Adjust path if needed
const { fetchFrameThumbnails } = require('../lib/figma-api'); // Adjust path if needed
const { generateHtmlFromNodes } = require('../lib/html-generator'); // Adjust path if needed
// --- End imports ---

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
    // --- Get selectedNodeId from request body ---
    const { fileKey, accessToken, selectedNodeId } = req.body;

    if (!selectedNodeId) {
      return res.status(400).json({ error: 'selectedNodeId is required' });
    }
    // --- End getting selectedNodeId ---

    // Fetch only the nodes for the selected frame/component
    const nodeResponse = await axios.get(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${selectedNodeId}`, {
      headers: { 'X-Figma-Token': accessToken }
    });

    // --- Check if the node was found ---
    if (!nodeResponse.data.nodes || !nodeResponse.data.nodes[selectedNodeId] || !nodeResponse.data.nodes[selectedNodeId].document) {
        console.error('Selected node not found in Figma response:', selectedNodeId, nodeResponse.data);
        return res.status(404).json({ error: `Node ${selectedNodeId} not found in file ${fileKey}` });
    }
    // --- End node check ---

    // Get the actual node data for the selected frame
    const selectedFrameNode = nodeResponse.data.nodes[selectedNodeId].document;
    // Use the children of the selected frame/component for generation
    const frameNodesToProcess = selectedFrameNode.children || [selectedFrameNode]; // Handle cases where the node itself is the target

    // Flatten nodes for searching (logo, etc.)
    const allNodes = flattenNodes(frameNodesToProcess);

    const logoNode = findLogoNode(allNodes);
    console.log('API_GEN: Found logoNode:', logoNode ? `ID: ${logoNode.id}` : 'None'); // Backend log

    const imageNodeIdsToFetch = [];
    if (logoNode && logoNode.id) {
      imageNodeIdsToFetch.push(logoNode.id);
    }
    // --- Log the IDs we are *about* to fetch ---
    console.log('API_GEN: Attempting to fetch image URLs for IDs:', imageNodeIdsToFetch);

    let imageUrlMap = new Map(); // Initialize map
    if (imageNodeIdsToFetch.length > 0) {
      try {
          // --- Log *before* the actual API call ---
          console.log(`API_GEN: Calling fetchFrameThumbnails with fileKey: ${fileKey}, ids: ${JSON.stringify(imageNodeIdsToFetch)}`);
          imageUrlMap = await fetchFrameThumbnails(fileKey, imageNodeIdsToFetch, accessToken);
          // --- Log the result *immediately* after the call ---
          console.log('API_GEN: fetchFrameThumbnails returned map:', JSON.stringify(Array.from(imageUrlMap.entries())));
      } catch (fetchError) {
          console.error("API_GEN: Error calling fetchFrameThumbnails:", fetchError.response ? fetchError.response.data : fetchError.message);
          // Keep imageUrlMap as empty Map on error
      }
    } else {
        console.log("API_GEN: No image node IDs found to fetch.");
    }

    // --- Log the map *just before* passing it to the generator ---
    console.log('API_GEN: Passing this imageUrlMap to generateHtmlFromNodes:', JSON.stringify(Array.from(imageUrlMap.entries())));
    const generatedHtml = generateHtmlFromNodes(frameNodesToProcess, imageUrlMap);

    res.json({ html: generatedHtml });

  } catch (error) {
    console.error('API_GEN: Error in /api/figma/generate endpoint:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate code' });
  }
});

// Remove or comment out the old extractComponents function if no longer needed
// function extractComponents(figmaData) { ... }

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
