import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import axios from 'axios';

function getNodeType(node: any) {
  if (node.type === 'TEXT') return 'text';
  if (node.type === 'RECTANGLE' && node.cornerRadius && node.cornerRadius > 10) return 'button';
  if (node.type === 'RECTANGLE' && node.width < 30 && node.height < 30) return 'checkbox';
  if (node.type === 'VECTOR' || node.type === 'IMAGE') return 'image';
  if (node.type === 'FRAME' || node.type === 'COMPONENT') return 'container';
  return 'unknown';
}

function groupByRows(nodes: any[]) {
  if (!nodes || nodes.length === 0) return [];
  nodes = nodes.filter(n => n.absoluteBoundingBox);
  nodes.sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y);
  const rows: any[][] = [];
  let currentRow: any[] = [];
  let lastY = null;
  for (const node of nodes) {
    const y = node.absoluteBoundingBox.y;
    if (lastY === null || Math.abs(y - lastY) < 30) {
      currentRow.push(node);
    } else {
      rows.push(currentRow);
      currentRow = [node];
    }
    lastY = y;
  }
  if (currentRow.length) rows.push(currentRow);
  return rows;
}

function generateBootstrapJSX(node: any, parentType: string = ''): string {
  const nodeType = getNodeType(node);
  if (nodeType === 'container') {
    // Layout: use Bootstrap card or row/col
    const children = node.children ? groupByRows(node.children).map(row =>
      `<div class="row mb-3">
        ${row.map(child => `<div class="col">${generateBootstrapJSX(child, nodeType)}</div>`).join('\n')}
      </div>`
    ).join('\n') : '';
    return `<div class="card p-4 mb-4">${children}</div>`;
  }
  if (nodeType === 'text') {
    // If parent is container, treat as heading or label
    if (parentType === 'container' && node.style?.fontSize >= 20) {
      return `<h2 class="mb-3">${node.characters}</h2>`;
    }
    return `<label class="form-label">${node.characters}</label>`;
  }
  if (nodeType === 'button') {
    return `<button class="btn btn-primary w-100">${node.children?.[0]?.characters || 'Button'}</button>`;
  }
  if (nodeType === 'checkbox') {
    // Find label sibling
    return `<div class="form-check">
      <input class="form-check-input" type="checkbox" />
      <label class="form-check-label">${node.characters || ''}</label>
    </div>`;
  }
  if (nodeType === 'image') {
    return `<img src="#" alt="image" class="img-fluid mb-3" />`;
  }
  // Fallback for unknown
  return '';
}

// Enhanced component extraction: preserve full node structure
function extractComponents(figmaData: any) {
  const components: any[] = [];
  function traverse(node: any) {
    if (node.type === 'FRAME' || node.type === 'COMPONENT') {
      components.push(node);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  traverse(figmaData.document);
  return components;
}

// Enhanced React component generator using Bootstrap
function generateReactComponent(component: any) {
  const jsx = generateBootstrapJSX(component);
  return {
    name: component.name.replace(/\s+/g, ''),
    code: `import React from 'react';

const ${component.name.replace(/\s+/g, '')} = () => (
  <>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-SgOJa3DmI69IUzQ2PVdRZhwQ+dy64/BUtbMJw1MZ8t5HZApcHrRKUc4W0kG879m7" crossOrigin="anonymous" />
    <div className="${component.name.replace(/\s+/g, '').toLowerCase()}">
      ${jsx}
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/js/bootstrap.bundle.min.js" integrity="sha384-k6d4wzSIapyDyv1kpU366/PK5hCdSbCRGRCMv+eplOQJWyd1fbcAu9OCUj5zNLiq" crossOrigin="anonymous"></script>
  </>
);

export default ${component.name.replace(/\s+/g, '')};
`
  };
}

// Helper: Detect field type by node and label text
function detectFieldType(label: string, node: any) {
  if (/password/i.test(label)) return 'password';
  if (/email/i.test(label)) return 'email';
  if (/date|time/i.test(label)) return 'datetime-local';
  if (/text|message/i.test(label)) return 'textarea';
  if (/checkbox/i.test(label) || node.type === 'RECTANGLE' && node.width < 30 && node.height < 30) return 'checkbox';
  return 'text';
}

// Helper: Find label for a node by spatial proximity
function findLabelForNode(node: any, siblings: any[]) {
  if (!node.absoluteBoundingBox) return null;
  const nodeBox = node.absoluteBoundingBox;
  let closest = null;
  let minDist = Infinity;
  for (const sib of siblings) {
    if (sib.type === 'TEXT' && sib.absoluteBoundingBox) {
      const sibBox = sib.absoluteBoundingBox;
      const dist = Math.abs(sibBox.y + sibBox.height - nodeBox.y);
      if (dist < 40 && sibBox.x < nodeBox.x + nodeBox.width && sibBox.x + sibBox.width > nodeBox.x) {
        if (dist < minDist) {
          minDist = dist;
          closest = sib;
        }
      }
    }
  }
  return closest;
}

// Main HTML generator using Bootstrap
function generateBootstrapForm(frame: any) {
  let html = `<form class="p-4 rounded shadow bg-white" style="max-width: 480px; margin: 2rem auto;">\n`;

  // Title
  if (frame.name) {
    html += `<h2 class="mb-4 text-center">${frame.name}</h2>\n`;
  }

  // Flatten all children for easier processing
  const nodes = (frame.children || []).slice();

  // Group by vertical position (simple heuristic)
  nodes.sort((a, b) => (a.absoluteBoundingBox?.y || 0) - (b.absoluteBoundingBox?.y || 0));

  // Process each node
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;

    // Label + Input
    if (node.type === 'RECTANGLE' && node.width > 60 && node.height > 20) {
      const labelNode = findLabelForNode(node, nodes);
      const label = labelNode ? labelNode.characters : '';
      const fieldType = detectFieldType(label, node);
      html += `<div class="mb-3">\n`;
      if (label) html += `<label class="form-label">${label}</label>\n`;
      if (fieldType === 'textarea') {
        html += `<textarea class="form-control"></textarea>\n`;
      } else {
        html += `<input type="${fieldType}" class="form-control" />\n`;
      }
      html += `</div>\n`;
      continue;
    }

    // Checkbox
    if (node.type === 'RECTANGLE' && node.width < 30 && node.height < 30) {
      const labelNode = findLabelForNode(node, nodes);
      const label = labelNode ? labelNode.characters : '';
      html += `<div class="form-check mb-3">\n`;
      html += `<input class="form-check-input" type="checkbox" />\n`;
      if (label) html += `<label class="form-check-label">${label}</label>\n`;
      html += `</div>\n`;
      continue;
    }

    // Button
    if (node.type === 'RECTANGLE' && node.fills && node.fills[0]?.color && node.width > 60 && node.height > 30) {
      // Find text child
      const textChild = (node.children || []).find((c: any) => c.type === 'TEXT');
      const btnText = textChild ? textChild.characters : 'Button';
      html += `<button type="submit" class="btn btn-primary w-100 mb-2">${btnText}</button>\n`;
      continue;
    }

    // Standalone text (subtitle, etc.)
    if (node.type === 'TEXT' && (!node.characters.match(/name|email|password|date|time|message|send|cancel/i))) {
      html += `<div class="mb-3">${node.characters}</div>\n`;
      continue;
    }
  }

  html += `</form>\n`;
  return html;
}

export async function POST(request: Request) {
  try {
    const { fileKey } = await request.json();
    const accessToken = request.headers.get('X-Figma-Token');

    if (!fileKey || !accessToken) {
      return NextResponse.json(
        { error: 'File key and access token are required' },
        { status: 400 }
      );
    }

    // Fetch Figma file data
    const response = await axios.get(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: { 'X-Figma-Token': accessToken }
      }
    );

    // Find the first frame/component
    const frame = (function findFirstFrame(node: any): any {
      if (node.type === 'FRAME' || node.type === 'COMPONENT') return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findFirstFrame(child);
          if (found) return found;
        }
      }
      return null;
    })(response.data.document);

    if (!frame) {
      return NextResponse.json({ error: 'No frame found' }, { status: 404 });
    }

    // Generate HTML using Bootstrap
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${frame.name || 'Figma Export'}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-SgOJa3DmI69IUzQ2PVdRZhwQ+dy64/BUtbMJw1MZ8t5HZApcHrRKUc4W0kG879m7" crossorigin="anonymous">
</head>
<body style="background:#f7f7fa;">
  ${generateBootstrapForm(frame)}
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/js/bootstrap.bundle.min.js" integrity="sha384-k6d4wzSIapyDyv1kpU366/PK5hCdSbCRGRCMv+eplOQJWyd1fbcAu9OCUj5zNLiq" crossorigin="anonymous"></script>
</body>
</html>`;

    // CSS: Only custom styles if needed (Bootstrap covers most)
    const css = '';

    return NextResponse.json({
      success: true,
      html,
      css,
      rawData: response.data
    });
  } catch (error) {
    console.error('Figma API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Figma data' },
      { status: 500 }
    );
  }
}