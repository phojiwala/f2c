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

export const generateHtmlFromNodes = (nodes) => {
  const sortedNodes = [...nodes].sort((a, b) => {
    const ay = a.absoluteBoundingBox?.y || 0;
    const by = b.absoluteBoundingBox?.y || 0;
    if (Math.abs(ay - by) < 8) {
      const ax = a.absoluteBoundingBox?.x || 0;
      const bx = b.absoluteBoundingBox?.x || 0;
      return ax - bx;
    }
    return ay - by;
  });

  let inputCounter = 0;
  let passwordInputIndex = -1;
  const elementsData = [];

  sortedNodes.forEach((node, index) => {
    let elementHtml = '';
    let elementType = 'unknown';
    const figmaId = node.id.replace(/[:;]/g, '-');
    const baseClass = `${node.type.toLowerCase()}-${figmaId}`;

    switch (node.type) {
      case 'TEXT': {
        const text = node.characters?.trim() || '';
        const uniqueId = `input-${++inputCounter}`;

        if (isTitle(node)) {
          const Tag = node.style?.fontSize >= 24 ? 'h1' : 'h2';
          elementHtml = `<${Tag} class="form-title ${baseClass}">${text}</${Tag}>`;
          elementType = 'title';
        } else if (isLabel(node)) {
          const nextNode = sortedNodes[index + 1];
          const inputType = nextNode?.characters?.toLowerCase().includes('password') ? 'password' : 'email';
          const inputFigId = nextNode?.id?.replace(/[:;]/g, '-') || '';
          elementHtml = `<div class="input-group">
              <label for="${uniqueId}" class="form-label ${baseClass}">${text.replace('*', '')}<span class="required">*</span></label>
              <input type="${inputType}" id="${uniqueId}" class="form-input text-${inputFigId}" placeholder="${nextNode?.characters || ''}" required />
            </div>`;
          elementType = 'input-group';
        } else if (isCheckboxLabel(node)) {
          elementHtml = `<label class="form-checkbox-label ${baseClass}">
              <input type="checkbox" class="form-checkbox" />
              <span>${text}</span>
            </label>`;
          elementType = 'checkbox-label';
        } else if (isLink(node)) {
          elementHtml = `<a href="#" class="form-link ${baseClass}">${text}</a>`;
          elementType = 'link';
        } else if (isSubmitButton(node)) {
          elementHtml = `<button type="submit" class="form-button ${baseClass}">${text}</button>`;
          elementType = 'submit-button';
        }
        break;
      }
      default:
        break;
    }

    if (elementHtml) {
      elementsData.push({ html: elementHtml, type: elementType, node });
    }
  });

  const htmlString = `<div class="form-main-container">
    ${elementsData.map((el) => el.html).join('\n')}
  </div>`;

  return htmlString;
};

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
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #f5f5f5;
  }

  .form-main-container {
    background-color: #ffffff;
    padding: 32px;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-title {
    font-size: 24px;
    font-weight: 600;
    color: #333;
    text-align: center;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label {
    font-size: 14px;
    font-weight: 500;
    color: #555;
  }

  .form-input {
    padding: 10px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    background-color: #fff;
  }

  .form-input:focus {
    border-color: #007bff;
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
  }

  .form-button {
    background-color: #003966;
    color: white;
    padding: 12px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    text-align: center;
  }

  .form-link {
    color: #007bff;
    font-size: 13px;
    text-decoration: none;
    text-align: right;
  }

  .form-link:hover {
    text-decoration: underline;
  }

  .form-checkbox-label {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #555;
  }

  .form-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #007bff;
  }

  .required {
    color: red;
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
