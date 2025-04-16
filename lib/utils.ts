// updated utils.ts with improved HTML/CSS generation logic
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toCSSUnit = (value) => {
  if (value === undefined || value === null) return '0px';
  return `${value}px`;
};

export function rgbaFromColor(color, opacity = 1) {
  if (!color) return 'rgba(0, 0, 0, 0)';
  const r = Math.round(Math.max(0, Math.min(1, color.r || 0)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g || 0)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b || 0)) * 255);
  const a = Math.max(0, Math.min(1, opacity ?? color.a ?? 1));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

const isInputPlaceholder = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase() || '';
  return /enter|type|your|e\.g\./.test(text) && !/\*$/.test(node.characters || '');
};
0
const isLabel = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase() || '';
  return /email|password|confirm|name|username|subject|message|phone/.test(text) && /\*$/.test(node.characters || '');
};

const isSubmitButton = (node) => {
  if ((node.type === 'FRAME' || node.type === 'RECTANGLE') && node.children?.length === 1 && node.children[0].type === 'TEXT') {
    const text = node.children[0].characters?.toLowerCase().trim() || '';
    if (/^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(text)) {
      return true;
    }
  }
  if (node.type === 'TEXT') {
    const text = node.characters?.toLowerCase().trim() || '';
    if (/^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(text) && node.fills?.[0]?.type === 'SOLID') {
      return true;
    }
  }
  return false;
};

const isCheckboxLabel = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase() || '';
  return /remember|agree|subscribe|i accept|keep me logged in/.test(text);
};

const isLink = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase() || '';
  return /forgot|reset|privacy|terms|learn more|click here|need help/.test(text);
};

const isTitle = (node) => {
  if (node.type !== 'TEXT') return false;
  const text = node.characters?.toLowerCase().trim() || '';
  const looksLikeButtonText = /^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(text);
  return node.style?.fontSize >= 20 || (node.style?.fontSize >= 16 && node.style?.fontWeight >= 600 && !looksLikeButtonText);
};

export function generateHtmlFromNodes(nodes, isRoot = true) {
  let html = '';
  let hasMainContainer = false;
  let inputCounter = 0;

  // Helper functions to detect node roles
  const isLabel = (node) =>
    node.type === 'TEXT' &&
    /email|password|address|user|name/i.test(node.characters) &&
    !/enter|remember|forgot|login|sign/i.test(node.characters);

  const isPlaceholder = (node) =>
    node.type === 'TEXT' &&
    /enter|type|your/i.test(node.characters) &&
    node.characters.length < 40;

  const isCheckboxLabel = (node) =>
    node.type === 'TEXT' && /remember/i.test(node.characters);

  const isButton = (node) =>
    node.type === 'TEXT' && /login|sign in|submit/i.test(node.characters);

  const isLink = (node) =>
    node.type === 'TEXT' && /forgot|register|sign up/i.test(node.characters);

  const isTitle = (node) =>
    node.type === 'TEXT' && /login|sign in|register|sign up/i.test(node.characters) && node.characters.length < 20;

  // Main recursive rendering
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // --- Semantic Title ---
    if (isTitle(node)) {
      html += `<h2 class="form-title">${node.characters}</h2>\n`;
      continue;
    }

    // --- Label + Input + Placeholder ---
    if (isLabel(node)) {
      let placeholder = '';
      // Look ahead for placeholder
      if (i + 1 < nodes.length && isPlaceholder(nodes[i + 1])) {
        placeholder = nodes[i + 1].characters;
        i++;
      }
      const labelText = node.characters.replace('*', '').trim();
      const inputType = /password/i.test(labelText) ? 'password' : 'email';
      const uniqueId = `input-${++inputCounter}`;
      html += `<div class="input-group">
  <label for="${uniqueId}" class="form-label">${labelText}<span class="required">*</span></label>
  <input type="${inputType}" id="${uniqueId}" class="form-input" placeholder="${placeholder}" required />
</div>\n`;
      continue;
    }

    // --- Checkbox ---
    if (isCheckboxLabel(node)) {
      html += `<label class="form-checkbox-label">
  <input type="checkbox" class="form-checkbox" />
  <span>${node.characters}</span>
</label>\n`;
      continue;
    }

    // --- Button ---
    if (isButton(node)) {
      html += `<button type="submit" class="form-button">${node.characters}</button>\n`;
      continue;
    }

    // --- Link ---
    if (isLink(node)) {
      html += `<a href="#" class="form-link">${node.characters}</a>\n`;
      continue;
    }

    // --- Containers (FRAME/GROUP/COMPONENT) ---
    if (
      (node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT') &&
      node.children &&
      node.children.length > 0
    ) {
      const childrenHtml = generateHtmlFromNodes(node.children, false);
      if (!hasMainContainer && isRoot) {
        html += `<form class="form-main-container">\n${childrenHtml}</form>\n`;
        hasMainContainer = true;
      } else {
        html += `<div class="container">\n${childrenHtml}</div>\n`;
      }
      continue;
    }

    // --- Fallback: Recursively render children if present ---
    if (node.children && node.children.length > 0) {
      html += generateHtmlFromNodes(node.children, false);
    }
  }

  return html;
}

export const generateCssFromStyles = (node) => {
  const styles = []
  const figmaId = node.id.replace(/[:;]/g, '-')
  const baseClass = `${node.type.toLowerCase()}-${figmaId}`
  const cssRules = []

  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox
    if (width > 5) cssRules.push(`width: ${toCSSUnit(width)}`)
    if (height > 5) cssRules.push(`height: ${toCSSUnit(height)}`)
  }

  if (node.fills?.[0]?.type === 'SOLID') {
    const fill = node.fills[0]
    if (node.type !== 'TEXT') {
      cssRules.push(
        `background-color: ${rgbaFromColor(fill.color, fill.opacity)}`
      )
    }
  }

  if (node.strokes?.[0] && node.strokeWeight) {
    const stroke = node.strokes[0]
    cssRules.push(
      `border: ${node.strokeWeight}px solid ${rgbaFromColor(
        stroke.color,
        stroke.opacity
      )}`
    )
  }

  if (node.cornerRadius) {
    cssRules.push(`border-radius: ${toCSSUnit(node.cornerRadius)}`)
  }

  if (node.type === 'TEXT' && node.style) {
    const s = node.style
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`)
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`)
    if (s.fontFamily)
      cssRules.push(`font-family: '${s.fontFamily}', sans-serif`)
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`)
    if (s.letterSpacing) cssRules.push(`letter-spacing: ${s.letterSpacing}px`)
    if (s.textAlignHorizontal)
      cssRules.push(`text-align: ${s.textAlignHorizontal.toLowerCase()}`)
  }

  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')}; }`)
  }

  if (node.children) {
    node.children.forEach((child) => {
      styles.push(generateCssFromStyles(child))
    })
  }

  return styles.join('\n')
}

export const detectComponentType = (frame) => {
  // ... (detectComponentType remains the same as previous version) ...
  const name = frame.name?.toLowerCase() || ''
  const children = frame.children || []

  const hasPasswordInput = children.some(
    (node) =>
      node.type === 'TEXT' &&
      node.characters?.toLowerCase().includes('password')
  )
  const hasEmailInput = children.some(
    (node) =>
      node.type === 'TEXT' && node.characters?.toLowerCase().includes('email')
  )
  const hasSubmitButton = children.some(
    (node) => isSubmitButton(node) || node.children?.some(isSubmitButton)
  )

  if (
    (name.includes('login') ||
      name.includes('signin') ||
      name.includes('log in')) &&
    hasPasswordInput &&
    hasSubmitButton
  ) {
    return 'login-form'
  }
  if (
    (name.includes('signup') ||
      name.includes('register') ||
      name.includes('sign up')) &&
    hasPasswordInput &&
    hasEmailInput &&
    hasSubmitButton
  ) {
    return 'signup-form'
  }
  return 'generic-container'
}

export const enhanceComponentStyles = (componentType, generatedCss) => {
  return `${generatedCss}

  .frame-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f7f7fa;
  }

  .form-main-container {
    background: #fff;
    padding: 32px 32px 24px 32px;
    border-radius: 16px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.08);
    max-width: 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: stretch;
  }

  .form-title {
    font-size: 22px;
    font-weight: 700;
    color: #111;
    text-align: center;
    margin-bottom: 16px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 14px;
    font-weight: 600;
    color: #222;
    margin-bottom: 2px;
  }

  .form-input {
    padding: 10px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 15px;
    background: #fff;
    transition: border 0.2s;
  }

  .form-input:focus {
    border-color: #003966;
    outline: none;
  }

  .form-button {
    background: #003966;
    color: #fff;
    padding: 12px 0;
    border: none;
    border-radius: 20px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 10px;
    transition: background 0.2s;
  }

  .form-button:hover {
    background: #00508a;
  }

  .form-link {
    color: #007bff;
    font-size: 13px;
    text-decoration: underline;
    text-align: center;
    margin-top: 10px;
    display: block;
  }

  .form-checkbox-label {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #222;
    margin-bottom: 8px;
  }

  .form-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #003966;
  }

  .required {
    color: #e53935;
    margin-left: 2px;
  }
  `
}

export const downloadImages = async (nodesToProcess, fileKey, accessToken) => {
  const imageMap = new Map()
  const imageNodeIds = new Set()

  const findImageNodes = (node) => {
    if (
      node.type === 'IMAGE' &&
      node.id &&
      typeof node.id === 'string' &&
      node.id.includes(':')
    ) {
      imageNodeIds.add(node.id)
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(findImageNodes)
    }
  }

  nodesToProcess.forEach(findImageNodes)

  if (imageNodeIds.size === 0) {
    console.log('No image nodes found to download.')
    return imageMap
  }

  try {
    const idsString = Array.from(imageNodeIds).join(',')
    console.log('Requesting images for IDs:', idsString)
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': accessToken } }
    )

    if (!response.ok) {
      let errorBody = `Status: ${response.status}`
      try {
        const errorData = await response.json()
        errorBody += `, Message: ${
          errorData.err || errorData.message || JSON.stringify(errorData)
        }`
      } catch (e) {
        /* Ignore */
      }
      throw new Error(`Failed to get image URLs (${errorBody})`)
    }

    const data = await response.json()
    if (data.err)
      throw new Error(`Figma API error getting image URLs: ${data.err}`)
    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no image URLs for the requested IDs.')
      return imageMap
    }

    console.log('Received image URLs:', data.images)
    const downloadPromises = Object.entries(data.images).map(
      async ([nodeId, imageUrl]) => {
        if (!imageUrl) {
          console.warn(`No URL returned for image node ${nodeId}`)
          return
        }
        try {
          const filenameBase =
            nodeId.split(':')[0] || nodeId.replace(/[:;]/g, '-')
          const filename = `${filenameBase}.png`
          const imageResponse = await fetch(imageUrl as string)
          if (!imageResponse.ok)
            throw new Error(
              `Download failed for ${nodeId} (Status: ${imageResponse.status})`
            )
          const blob = await imageResponse.blob()
          imageMap.set(filename, blob)
          console.log(`Successfully downloaded image: ${filename}`)
        } catch (imgError) {
          console.error(`Failed download/process image ${nodeId}:`, imgError)
        }
      }
    )
    await Promise.all(downloadPromises)
  } catch (error) {
    console.error('Failed to download images:', error)
    // Handle error appropriately in UI - toast() is not defined here
    return imageMap // Return empty map on error
  }
  console.log(`Image download complete. Map size: ${imageMap.size}`)
  return imageMap
}

// Add this function to utils.ts
export const fetchFrameThumbnails = async (fileKey, nodeIds, accessToken) => {
  if (!fileKey || !nodeIds || !nodeIds.length || !accessToken) {
    return new Map();
  }

  const thumbnailMap = new Map();
  try {
    const idsString = nodeIds.join(',');
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': accessToken } }
    );

    if (!response.ok) {
      throw new Error(`Failed to get thumbnails (Status: ${response.status})`);
    }

    const data = await response.json();
    if (data.err) {
      throw new Error(`Figma API error getting thumbnails: ${data.err}`);
    }

    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no thumbnails for the requested frames.');
      return thumbnailMap;
    }

    // Map the image URLs to their respective node IDs
    Object.entries(data.images).forEach(([nodeId, imageUrl]) => {
      if (imageUrl) {
        thumbnailMap.set(nodeId, imageUrl);
      }
    });
  } catch (error) {
    console.error('Failed to fetch thumbnails:', error);
  }

  return thumbnailMap;
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(date);
};
