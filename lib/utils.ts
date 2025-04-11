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

// --- Figma Node Processing Helpers ---

const isInputPlaceholder = (node) => {
    if (node.type !== 'TEXT') return false;
    const text = node.characters?.toLowerCase() || '';
    // Match common placeholders, avoid matching labels like "Password*"
    return /enter|type|your|e\.g\./.test(text) && !/\*$/.test(node.characters || '');
}

const isLabel = (node) => {
    if (node.type !== 'TEXT') return false;
    const text = node.characters?.toLowerCase() || '';
    // Match common label text, often ending with *
    return /email|password|confirm|name|username|subject|message|phone/.test(text) && /\*$/.test(node.characters || '');
}

const isSubmitButton = (node) => {
    // Primary check: Frame/Rectangle containing a single centered Text node with button text
    if ((node.type === 'FRAME' || node.type === 'RECTANGLE') && node.children?.length === 1 && node.children[0].type === 'TEXT') {
        const textNode = node.children[0];
        const text = textNode.characters?.toLowerCase().trim() || '';
        if (/^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(text)) {
            return true;
        }
    }
    // Stricter secondary check: Standalone Text node styled like a button
    if (node.type === 'TEXT') {
         const text = node.characters?.toLowerCase().trim() || '';
         // Requires button text AND a solid background fill to distinguish from titles
         if (/^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(text) && node.fills?.[0]?.type === 'SOLID') {
            return true;
         }
    }
    return false;
}

const isCheckboxLabel = (node) => {
    if (node.type !== 'TEXT') return false;
    const text = node.characters?.toLowerCase() || '';
    return /remember|agree|subscribe|i accept|keep me logged in/.test(text);
}

const isLink = (node) => {
    if (node.type !== 'TEXT') return false;
    const text = node.characters?.toLowerCase() || '';
    return /forgot|reset|privacy|terms|learn more|click here|need help/.test(text);
}

const isTitle = (node) => {
    if (node.type !== 'TEXT') return false;
    // Check font size and weight, ensure it doesn't match button text exactly if styled simply
    const text = node.characters?.toLowerCase().trim() || '';
    const looksLikeButtonText = /^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(text);
    // Title if large font OR medium font+bold, but NOT if it looks like button text without other styling
    return node.style?.fontSize >= 20 || (node.style?.fontSize >= 16 && node.style?.fontWeight >= 600 && !looksLikeButtonText);
}

// --- HTML Generation ---
export const generateHtmlFromNodes = (nodes) => {

  // Sort nodes primarily by Y, then X for consistent order
  const sortedNodes = [...nodes].sort((a, b) => {
    const ay = a.absoluteBoundingBox?.y || 0;
    const by = b.absoluteBoundingBox?.y || 0;
    if (Math.abs(ay - by) < 8) { // Increase Y threshold slightly
        const ax = a.absoluteBoundingBox?.x || 0;
        const bx = b.absoluteBoundingBox?.x || 0;
        return ax - bx;
    }
    return ay - by;
  });

  let inputCounter = 0;
  let passwordInputIndex = -1; // Track index of password input's wrapper
  const elementsData = []; // Store generated HTML and node type/info

  // --- Pass 1: Generate initial HTML strings and identify key elements ---
  sortedNodes.forEach((node, index) => {
    let elementHtml = '';
    let elementType = 'unknown'; // To help with grouping later
    const figmaId = node.id.replace(/[:;]/g, '-');
    const baseClass = `${node.type.toLowerCase()}-${figmaId}`;

    switch (node.type) {
        case 'FRAME':
        case 'GROUP':
        case 'COMPONENT':
        case 'INSTANCE':
        case 'COMPONENT_SET': {
            const hasFormElements = node.children?.some(child => isLabel(child) || isInputPlaceholder(child) || isSubmitButton(child));
            const containerClass = hasFormElements ? 'form-main-container' : 'group-container';
            const innerHtml = node.children ? generateHtmlFromNodes(node.children) : ''; // Recursive call
            elementHtml = `<div class="${containerClass} ${baseClass}">${innerHtml}</div>`;
            elementType = 'container';
            break;
        }

        case 'RECTANGLE': {
            if (isSubmitButton(node)) {
                const textNode = node.children[0];
                const text = textNode.characters?.trim() || 'Submit';
                const textNodeClass = `${textNode.type.toLowerCase()}-${textNode.id.replace(/[:;]/g, '-')}`;
                elementHtml = `<button type="submit" class="form-button ${baseClass}">
                             <span class="${textNodeClass}">${text}</span>
                           </button>`;
                elementType = 'submit-button';
            } else {
                const childrenHtml = node.children ? generateHtmlFromNodes(node.children) : '';
                // Only add class if it has content or specific styling? Maybe skip empty ones?
                if (childrenHtml || node.fills?.[0]?.visible !== false || node.strokes?.[0]?.visible !== false) {
                   elementHtml = `<div class="${baseClass} rectangle-element">${childrenHtml}</div>`;
                   elementType = 'rectangle';
                } else {
                    elementHtml = ''; // Skip empty, unstyled rectangles
                }
            }
            break;
        }

        case 'TEXT': {
            const text = node.characters?.trim() || '';
            const uniqueId = `input-${++inputCounter}`; // Increment first

            if (isTitle(node)) {
                const Tag = node.style?.fontSize >= 24 ? 'h1' : 'h2'; // Example: Use h1/h2 based on size
                elementHtml = `<${Tag} class="form-title ${baseClass}">${text}</${Tag}>`;
                elementType = 'title';
            } else if (isLabel(node)) {
                // Wrap in input-group div immediately
                elementHtml = `<div class="input-group">
                           <label for="${uniqueId}" class="form-label ${baseClass}">${text.replace('*', '')}<span class="required">*</span></label>`;
                 // Look ahead for the corresponding input (simple version: assumes next node is input)
                 const nextNode = sortedNodes[index + 1];
                 if (nextNode && isInputPlaceholder(nextNode)) {
                     const inputType = nextNode.characters.toLowerCase().includes('email') ? 'email'
                                    : nextNode.characters.toLowerCase().includes('password') ? 'password'
                                    : 'text';
                     const inputFigId = nextNode.id.replace(/[:;]/g, '-');
                     const inputBaseClass = `${nextNode.type.toLowerCase()}-${inputFigId}`;
                     elementHtml += `<input type="${inputType}" id="${uniqueId}" name="${inputType}" class="form-input ${inputBaseClass}" placeholder="${nextNode.characters}" required />`;
                     if (inputType === 'password') {
                         passwordInputIndex = elementsData.length; // Store index of this group
                     }
                     // Mark next node as processed? More complex, skip for now. Rely on filtering later.
                 }
                 elementHtml += `</div>`; // Close input-group
                 elementType = 'input-group';

            } else if (isInputPlaceholder(node)) {
                // If an input placeholder is found *without* a preceding label, generate it standalone
                // Check if the *previous* element generated was its corresponding label group
                const prevElement = elementsData[elementsData.length - 1];
                 if (!prevElement || !prevElement.html.includes(`for="${uniqueId - 1}"`)) { // Check if label was just handled
                    const type = text.toLowerCase().includes('email') ? 'email'
                               : text.toLowerCase().includes('password') ? 'password'
                               : 'text';
                    elementHtml = `<div class="input-group">
                                <input type="${type}" id="${uniqueId}" name="${type}" class="form-input ${baseClass}" placeholder="${text}" required />
                               </div>`;
                    elementType = 'input-group'; // Still treat as input-group
                     if (type === 'password') {
                         passwordInputIndex = elementsData.length;
                     }
                 } else {
                     // Input was already handled by the label logic, skip generating it again
                     elementHtml = '';
                     elementType = 'processed-input'; // Mark as processed
                 }

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
            } else if (text) { // Only generate if there's text content
                elementHtml = `<p class="text-block ${baseClass}">${text}</p>`;
                elementType = 'text-block';
            }
            break;
        }

        case 'IMAGE':
            elementHtml = `<img src="images/${node.id.split(':')[0]}.png" class="${baseClass}" alt="${node.name || 'Image'}" />`;
            elementType = 'image';
            break;

        case 'VECTOR':
        case 'BOOLEAN_OPERATION':
        case 'STAR':
        case 'LINE':
        case 'SLICE':
            elementHtml = ''; // Skip decorative/utility types
            elementType = 'skipped';
            break;

        default:
            console.warn(`Unhandled node type in HTML generation: ${node.type}`);
            elementHtml = node.children ? generateHtmlFromNodes(node.children) : '';
            elementType = 'unknown-container';
    }

    // Add non-empty elements to the data array
    if (elementHtml) {
        elementsData.push({ html: elementHtml, type: elementType, node });
    }
  });

  // --- Pass 2: Group options (Remember Me, Forgot Password) below password input ---
  const finalHtmlArray = [];
  let rememberMeHtml = '';
  let forgotLinkHtml = '';
  let optionsProcessed = false; // Flag to ensure options are added only once

  for (let i = 0; i < elementsData.length; i++) {
      const currentElement = elementsData[i];

      // Temporarily store checkbox and link if found
      if (currentElement.type === 'checkbox-label') {
          rememberMeHtml = currentElement.html;
          continue; // Skip adding it directly now
      }
      if (currentElement.type === 'link' && /forgot|reset/.test(currentElement.node.characters?.toLowerCase() || '')) {
          forgotLinkHtml = currentElement.html;
          continue; // Skip adding it directly now
      }

      // Add the current element to the final array
      finalHtmlArray.push(currentElement.html);

      // If this was the password input group, and we haven't added options yet
      if (i === passwordInputIndex && !optionsProcessed && (rememberMeHtml || forgotLinkHtml)) {
          finalHtmlArray.push(`<div class="form-options">${rememberMeHtml}${forgotLinkHtml}</div>`);
          optionsProcessed = true; // Mark options as added
          // Clear stored HTML to prevent adding again if found later somehow
          rememberMeHtml = '';
          forgotLinkHtml = '';
      }
  }

  // If options weren't added (e.g., no password field found), add them at the end before the button
  if (!optionsProcessed && (rememberMeHtml || forgotLinkHtml)) {
      let submitButtonIndex = finalHtmlArray.findIndex(html => html.includes('class="form-button'));
      if (submitButtonIndex === -1) submitButtonIndex = finalHtmlArray.length; // Add at end if no button
      finalHtmlArray.splice(submitButtonIndex, 0, `<div class="form-options">${rememberMeHtml}${forgotLinkHtml}</div>`);
  }


  return finalHtmlArray.join('\n');
};


// --- CSS Generation (Focus on Visuals, Not Layout) ---
export const generateCssFromStyles = (node) => {
  // ... (generateCssFromStyles function remains largely the same as previous version)
  // ... (It should NOT generate position:absolute, top, left)
  // ... (It SHOULD generate background-color, border, border-radius, color, font-*, etc.)

  if (!node || !node.id || !node.type) return '';

  const styles = [];
  const figmaId = node.id.replace(/[:;]/g, '-');
  const baseClass = `${node.type.toLowerCase()}-${figmaId}`;
  const cssRules = [];

  // Size (Apply cautiously) - Keep for now
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox;
    if (node.type !== 'TEXT' || width > 5) {
       if (width) cssRules.push(`width: ${toCSSUnit(width)}`);
    }
     if (node.type !== 'TEXT' || height > 5) {
       if (height) cssRules.push(`height: ${toCSSUnit(height)}`);
     }
  }

  // Background Color (Skip for non-button Text)
  const isTextButton = node.type === 'TEXT' && isSubmitButton(node);
  if (node.type !== 'TEXT' || isTextButton) {
      if (node.fills?.[0]?.visible !== false && node.fills?.[0]?.type === 'SOLID') {
        const fill = node.fills[0];
        cssRules.push(`background-color: ${rgbaFromColor(fill.color, fill.opacity)}`);
      }
      // TODO: Handle gradient fills if needed
  }

  // Borders
  if (node.strokes?.length > 0 && node.strokeWeight && node.strokes[0].visible !== false) {
    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID') {
      cssRules.push(`border: ${node.strokeWeight}px solid ${rgbaFromColor(stroke.color, stroke.opacity)}`);
    }
  }

  // Corner Radius
  if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
    cssRules.push(`border-radius: ${toCSSUnit(node.cornerRadius)}`);
  } else if (typeof node.rectangleCornerRadii === 'object') {
      const radii = node.rectangleCornerRadii;
      cssRules.push(`border-top-left-radius: ${toCSSUnit(radii.topLeft || 0)}`);
      cssRules.push(`border-top-right-radius: ${toCSSUnit(radii.topRight || 0)}`);
      cssRules.push(`border-bottom-right-radius: ${toCSSUnit(radii.bottomRight || 0)}`);
      cssRules.push(`border-bottom-left-radius: ${toCSSUnit(radii.bottomLeft || 0)}`);
  }

  // Typography (Only for TEXT nodes)
  if (node.type === 'TEXT' && node.style) {
    const s = node.style;
    if (s.fontFamily) cssRules.push(`font-family: "${s.fontFamily}", sans-serif`);
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`);
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`);
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`);
    else if (s.lineHeightPercent) cssRules.push(`line-height: ${s.lineHeightPercent}%`);
    if (s.textAlignHorizontal) cssRules.push(`text-align: ${s.textAlignHorizontal.toLowerCase()}`);
    if (s.letterSpacing) cssRules.push(`letter-spacing: ${s.letterSpacing}px`);
    if (s.textDecoration === 'UNDERLINE') cssRules.push(`text-decoration: underline`);
    if (s.textDecoration === 'STRIKETHROUGH') cssRules.push(`text-decoration: line-through`);

    // Text Color (Only apply if not overridden by generic styles like .form-button)
    // This is hard to determine perfectly here. Maybe skip color for known semantic elements?
    const isSemanticallyStyled = isLabel(node) || isInputPlaceholder(node) || isCheckboxLabel(node) || isLink(node) || isSubmitButton(node) || isTitle(node);
    if (!isSemanticallyStyled && s.fills?.[0]?.type === 'SOLID' && s.fills[0].visible !== false) {
       cssRules.push(`color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity)}`);
    } else if (isSemanticallyStyled && s.fills?.[0]?.type === 'SOLID' && s.fills[0].visible !== false) {
        // Apply color only if it's significantly different from default text colors? Complex.
        // For now, let generic styles handle color for semantic elements.
        // Exception: Color *is* needed for standalone text buttons.
        if (isSubmitButton(node)) {
             cssRules.push(`color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity)}`);
        }
    }
  }

  // Effects (Basic Drop Shadow)
  if (node.effects) {
      node.effects.forEach(effect => {
          if (effect.type === 'DROP_SHADOW' && effect.visible !== false) {
              const { color, offset, radius } = effect;
              cssRules.push(`box-shadow: ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(color, color.a)}`);
          }
      });
  }

  // --- Combine rules and recurse ---
  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')} }`);
  }

  if (node.children) {
    for (const child of node.children) {
      if (!['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'LINE', 'SLICE'].includes(child.type)) {
         styles.push(generateCssFromStyles(child));
      }
    }
  }

  return styles.filter(Boolean).join('\n');
};


// --- Component Type Detection and Enhancement ---

export const detectComponentType = (frame) => {
  // ... (detectComponentType remains the same as previous version) ...
  const name = frame.name?.toLowerCase() || '';
  const children = frame.children || [];

  const hasPasswordInput = children.some(node => node.type === 'TEXT' && node.characters?.toLowerCase().includes('password'));
  const hasEmailInput = children.some(node => node.type === 'TEXT' && node.characters?.toLowerCase().includes('email'));
  const hasSubmitButton = children.some(node => isSubmitButton(node) || node.children?.some(isSubmitButton));

  if ((name.includes('login') || name.includes('signin') || name.includes('log in')) && hasPasswordInput && hasSubmitButton) {
    return 'login-form';
  }
  if ((name.includes('signup') || name.includes('register') || name.includes('sign up')) && hasPasswordInput && hasEmailInput && hasSubmitButton) {
    return 'signup-form';
  }
  return 'generic-container';
};

export const enhanceComponentStyles = (componentType, generatedCss) => {
  // ... (enhanceComponentStyles remains mostly the same, ensuring styles for .form-options and .form-button are correct) ...
  let enhancedCss = generatedCss;

  enhancedCss += `
    /* Base structural styles */
    .group-container { /* Basic container for non-form groups */
      /* Add any default group styles if needed */
    }
    .form-main-container { /* Applied to the top-level frame identified as a form */
      display: flex;
      flex-direction: column;
      width: 100%; /* Take available width within wrapper */
    }
    .rectangle-element { /* Basic styling for rectangles used as backgrounds/dividers */
       /* e.g., border: 1px solid #eee; */
    }
    .text-block {
        margin-bottom: 8px;
        color: #333; /* Default text color */
    }
    img { max-width: 100%; height: auto; display: block; }
    button { cursor: pointer; } /* Basic button usability */
    a { color: #007bff; text-decoration: none; } /* Basic link usability */
    a:hover { text-decoration: underline; }
    label { display: block; /* Ensure labels take block space */ }
  `;

  if (componentType === 'login-form' || componentType === 'signup-form') {
    enhancedCss += `
      /* Form Centering & Container */
      .frame-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 20px;
        background-color: #f0f2f5;
      }

      .form-main-container { /* The white box */
        background-color: #ffffff;
        padding: 30px 40px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-width: 450px;
        width: 100%;
        display: flex; /* Use flex here */
        flex-direction: column; /* Stack elements vertically */
        align-items: stretch; /* Stretch children like input groups */
        gap: 16px;
      }

      /* Form Title */
      .form-title {
        font-size: 28px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 10px; /* Reduced margin as gap handles spacing */
        color: #333;
      }

      /* Input Groups */
      .input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
      }

      .form-label {
        font-size: 14px;
        font-weight: 500;
        color: #555;
      }

      .required { color: #d9534f; margin-left: 2px; }

      .form-input {
        padding: 10px 12px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        width: 100%;
        background-color: #fff;
        transition: border-color 0.2s ease-in-out;
      }
      .form-input:focus { border-color: #007bff; outline: none; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2); }

      /* Options Row */
      .form-options {
          display: flex;
          justify-content: space-between; /* Pushes items to ends */
          align-items: center;
          width: 100%;
          margin-top: -8px; /* Adjust spacing relative to gap */
          margin-bottom: 8px; /* Add space before button */
          gap: 10px; /* Space between items if they wrap */
          flex-wrap: wrap; /* Allow wrapping on small screens */
      }

      .form-checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #555;
        cursor: pointer;
        /* flex-grow: 1; Remove grow to prevent pushing link too far */
      }
      .form-checkbox { width: 16px; height: 16px; accent-color: #007bff; }

      .form-link {
        font-size: 13px;
        white-space: nowrap;
        /* text-align: right; No longer needed with justify-content */
      }

      /* Submit Button */
      .form-button {
        background-color: #007bff;
        color: white !important; /* Ensure text is white */
        border: none;
        border-radius: 4px;
        padding: 12px 15px;
        font-size: 16px;
        font-weight: 600;
        width: 100%;
        text-align: center;
        transition: background-color 0.2s ease-in-out;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 10px; /* Add margin above button */
      }
      .form-button span { color: white; } /* Ensure inner span text is white */
      .form-button:hover { background-color: #0056b3; }
    `;
  }

  return enhancedCss;
};


// --- Image Download (No changes from previous version) ---
export const downloadImages = async (nodesToProcess, fileKey, accessToken) => {
  const imageMap = new Map();
  const imageNodeIds = new Set();

  const findImageNodes = (node) => {
    if (node.type === 'IMAGE' && node.id && typeof node.id === 'string' && node.id.includes(':')) {
      imageNodeIds.add(node.id);
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(findImageNodes);
    }
  };

  nodesToProcess.forEach(findImageNodes);

  if (imageNodeIds.size === 0) {
    console.log("No image nodes found to download.");
    return imageMap;
  }

  try {
    const idsString = Array.from(imageNodeIds).join(',');
    console.log("Requesting images for IDs:", idsString);
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': accessToken } }
    );

    if (!response.ok) {
      let errorBody = `Status: ${response.status}`;
      try {
          const errorData = await response.json();
          errorBody += `, Message: ${errorData.err || errorData.message || JSON.stringify(errorData)}`;
      } catch (e) { /* Ignore */ }
      throw new Error(`Failed to get image URLs (${errorBody})`);
    }

    const data = await response.json();
    if (data.err) throw new Error(`Figma API error getting image URLs: ${data.err}`);
    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no image URLs for the requested IDs.');
      return imageMap;
    }

    console.log("Received image URLs:", data.images);
    const downloadPromises = Object.entries(data.images).map(
      async ([nodeId, imageUrl]) => {
        if (!imageUrl) {
          console.warn(`No URL returned for image node ${nodeId}`); return;
        }
        try {
          const filenameBase = nodeId.split(':')[0] || nodeId.replace(/[:;]/g, '-');
          const filename = `${filenameBase}.png`;
          const imageResponse = await fetch(imageUrl as string);
          if (!imageResponse.ok) throw new Error(`Download failed for ${nodeId} (Status: ${imageResponse.status})`);
          const blob = await imageResponse.blob();
          imageMap.set(filename, blob);
          console.log(`Successfully downloaded image: ${filename}`);
        } catch (imgError) {
          console.error(`Failed download/process image ${nodeId}:`, imgError);
        }
      }
    );
    await Promise.all(downloadPromises);
  } catch (error) {
    console.error('Failed to download images:', error);
    // Handle error appropriately in UI - toast() is not defined here
    return imageMap; // Return empty map on error
  }
  console.log(`Image download complete. Map size: ${imageMap.size}`);
  return imageMap;
};
