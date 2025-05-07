// This file contains functions for generating HTML from Figma nodes

import { findLogoNode } from './figma-node-helpers';

/**
 * Generates HTML from Figma nodes
 * @param nodes - Array of Figma nodes to generate HTML from
 * @param imageUrlMap - Map of node IDs to image URLs
 * @returns Generated HTML string
 */
export function generateHtmlFromNodes(nodes, imageUrlMap) {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return '<div>No content to generate</div>';
  }

  // Start with a basic HTML structure
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated from Figma</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
`;

  // Find the logo node
  const logoNode = findLogoNode(nodes);
  if (logoNode && imageUrlMap) {
    const logoUrl = getImageUrl(logoNode, imageUrlMap);
    if (logoUrl) {
      html += `    <header>
      <img src="${logoUrl}" alt="Logo" style="max-height: 60px;">
    </header>
`;
    }
  }

  // Process the main content
  html += processNodes(nodes, imageUrlMap);

  // Close the HTML structure
  html += `  </div>
</body>
</html>
`;

  return html;
}

/**
 * Gets the image URL for a node from the image URL map
 * @param node - Figma node
 * @param imageUrlMap - Map of node IDs to image URLs
 * @returns Image URL if found, otherwise null
 */
function getImageUrl(node, imageUrlMap) {
  if (!node || !imageUrlMap) return null;

  // Check if the node ID is directly in the map
  if (imageUrlMap.has(node.id)) {
    return imageUrlMap.get(node.id);
  }

  // Check if the node has an image fill
  if (node.fills?.some((fill) => fill.type === 'IMAGE' && fill.imageRef)) {
    const imageFill = node.fills.find(
      (fill) => fill.type === 'IMAGE' && fill.imageRef
    );
    if (imageFill && imageUrlMap.has(imageFill.imageRef)) {
      return imageUrlMap.get(imageFill.imageRef);
    }
  }

  return null;
}

/**
 * Processes an array of Figma nodes to generate HTML
 * @param nodes - Array of Figma nodes
 * @param imageUrlMap - Map of node IDs to image URLs
 * @returns Generated HTML string
 */
function processNodes(nodes, imageUrlMap) {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  let html = '';

  // Process each node
  nodes.forEach(node => {
    if (!node) return;

    // Process based on node type
    switch (node.type) {
      case 'TEXT':
        html += processTextNode(node);
        break;
      case 'RECTANGLE':
      case 'FRAME':
        html += processContainerNode(node, imageUrlMap);
        break;
      case 'IMAGE':
        html += processImageNode(node, imageUrlMap);
        break;
      default:
        // Process children if available
        if (node.children && Array.isArray(node.children)) {
          html += processNodes(node.children, imageUrlMap);
        }
    }
  });

  return html;
}

/**
 * Processes a text node to generate HTML
 * @param node - Figma text node
 * @returns Generated HTML string
 */
function processTextNode(node) {
  if (!node || !node.characters) return '';

  // Determine the appropriate HTML tag based on text properties
  let tag = 'p';
  if (node.style) {
    if (node.style.fontSize >= 24) {
      tag = 'h1';
    } else if (node.style.fontSize >= 20) {
      tag = 'h2';
    } else if (node.style.fontSize >= 16) {
      tag = 'h3';
    }
  }

  // Generate inline styles
  let styles = '';
  if (node.style) {
    if (node.style.fontWeight) styles += `font-weight: ${node.style.fontWeight}; `;
    if (node.style.fontSize) styles += `font-size: ${node.style.fontSize}px; `;
    if (node.style.textAlignHorizontal) styles += `text-align: ${node.style.textAlignHorizontal.toLowerCase()}; `;
  }

  return `    <${tag} style="${styles}">${node.characters}</${tag}>\n`;
}

/**
 * Processes a container node (RECTANGLE or FRAME) to generate HTML
 * @param node - Figma container node
 * @param imageUrlMap - Map of node IDs to image URLs
 * @returns Generated HTML string
 */
function processContainerNode(node, imageUrlMap) {
  if (!node) return '';

  let html = '';

  // Check if this container has an image fill
  const imageUrl = getImageUrl(node, imageUrlMap);
  if (imageUrl) {
    html += `    <div style="${generateNodeStyles(node)}">
      <img src="${imageUrl}" alt="Image" style="width: 100%; height: 100%; object-fit: cover;">
    </div>\n`;
  } else {
    // Start container div
    html += `    <div style="${generateNodeStyles(node)}">
`;

    // Process children if available
    if (node.children && Array.isArray(node.children)) {
      html += processNodes(node.children, imageUrlMap);
    }

    // Close container div
    html += `    </div>
`;
  }

  return html;
}

/**
 * Processes an image node to generate HTML
 * @param node - Figma image node
 * @param imageUrlMap - Map of node IDs to image URLs
 * @returns Generated HTML string
 */
function processImageNode(node, imageUrlMap) {
  if (!node) return '';

  const imageUrl = getImageUrl(node, imageUrlMap);
  if (!imageUrl) return '';

  return `    <img src="${imageUrl}" alt="Image" style="${generateNodeStyles(node)}">
`;
}

/**
 * Generates CSS styles for a node
 * @param node - Figma node
 * @returns CSS style string
 */
function generateNodeStyles(node) {
  if (!node) return '';

  let styles = '';

  // Position and size
  if (node.absoluteBoundingBox) {
    if (node.absoluteBoundingBox.width) styles += `width: ${node.absoluteBoundingBox.width}px; `;
    if (node.absoluteBoundingBox.height) styles += `height: ${node.absoluteBoundingBox.height}px; `;
  }

  // Background color
  if (node.fills && Array.isArray(node.fills)) {
    const solidFill = node.fills.find(fill => fill.type === 'SOLID');
    if (solidFill && solidFill.color) {
      const { r, g, b } = solidFill.color;
      const opacity = solidFill.opacity !== undefined ? solidFill.opacity : 1;
      styles += `background-color: rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity}); `;
    }
  }

  // Border
  if (node.strokes && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID' && stroke.color) {
      const { r, g, b } = stroke.color;
      const opacity = stroke.opacity !== undefined ? stroke.opacity : 1;
      styles += `border: ${node.strokeWeight || 1}px solid rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${opacity}); `;
    }
  }

  // Border radius
  if (node.cornerRadius) {
    styles += `border-radius: ${node.cornerRadius}px; `;
  }

  return styles;
}