import { fetchFrameThumbnails } from './lib/figma-api';
import { generateHtmlFromNodes } from './lib/html-generator'; // Or your generator function
import { findLogoNode } from './lib/figma-node-helpers'; // Helper to find the logo

// 1. Find the logo node within the selected frame's nodes
const logoNode = findLogoNode(selectedFrameNodes); // Make sure findLogoNode can find RECTANGLEs too
const imageNodeIdsToFetch = [];
if (logoNode) {
    imageNodeIdsToFetch.push(logoNode.id);
}
// Add other image node IDs if needed...

// 2. Fetch the image URLs for these specific nodes
let imageUrlMap = new Map();
if (imageNodeIdsToFetch.length > 0) {
    imageUrlMap = await fetchFrameThumbnails(fileKey, imageNodeIdsToFetch, accessToken);
    console.log("Fetched Image URLs:", imageUrlMap);
}

// 3. Pass the map to your HTML generator
const generatedHtml = generateHtmlFromNodes(selectedFrameNodes, imageUrlMap);

// --- Send generatedHtml back to the client ---