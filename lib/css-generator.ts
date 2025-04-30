import { rgbaFromColor, toCSSUnit } from './utils'

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
    } else {
      // For text elements, use color instead of background-color
      cssRules.push(
        `color: ${rgbaFromColor(fill.color, fill.opacity)}`
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

  // Enhanced style processing for all elements
  if (node.style) {
    const s = node.style

    // Typography styles
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`)
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`)
    if (s.fontFamily) cssRules.push(`font-family: '${s.fontFamily}', sans-serif`)
    if (s.fontStyle) cssRules.push(`font-style: ${s.fontStyle.toLowerCase()}`)
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`)
    if (s.letterSpacing) cssRules.push(`letter-spacing: ${s.letterSpacing}px`)

    // Text alignment
    if (s.textAlignHorizontal) {
      const alignment = s.textAlignHorizontal.toLowerCase();
      cssRules.push(`text-align: ${alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left'}`)
    }

    if (s.textAlignVertical) {
      const verticalAlign = s.textAlignVertical.toLowerCase();
      if (verticalAlign === 'center') {
        cssRules.push('display: flex');
        cssRules.push('align-items: center');
      } else if (verticalAlign === 'bottom') {
        cssRules.push('display: flex');
        cssRules.push('align-items: flex-end');
      }
    }

    // Text decoration
    if (s.textDecoration) {
      cssRules.push(`text-decoration: ${s.textDecoration.toLowerCase()}`)
    }

    // Text transform
    if (s.textCase) {
      const textCase = s.textCase.toLowerCase();
      if (textCase === 'upper') {
        cssRules.push('text-transform: uppercase');
      } else if (textCase === 'lower') {
        cssRules.push('text-transform: lowercase');
      } else if (textCase === 'title') {
        cssRules.push('text-transform: capitalize');
      }
    }
  }

  // Add padding if available
  if (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom) {
    const paddingTop = node.paddingTop || 0;
    const paddingRight = node.paddingRight || 0;
    const paddingBottom = node.paddingBottom || 0;
    const paddingLeft = node.paddingLeft || 0;

    cssRules.push(`padding: ${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`);
  }

  // Add effects like shadows
  if (node.effects && node.effects.length > 0) {
    node.effects.forEach(effect => {
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        const { offset, radius, color } = effect;
        const x = offset?.x || 0;
        const y = offset?.y || 0;
        const blur = radius || 0;
        const shadowColor = rgbaFromColor(color, effect.opacity || 1);
        const shadowType = effect.type === 'INNER_SHADOW' ? 'inset ' : '';

        cssRules.push(`box-shadow: ${shadowType}${x}px ${y}px ${blur}px ${shadowColor}`);
      } else if (effect.type === 'LAYER_BLUR') {
        cssRules.push(`filter: blur(${effect.radius}px)`);
      }
    });
  }

  // Generate the class with all CSS rules
  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')}; }`)
  }

  // Generate classes for children
  if (node.children) {
    node.children.forEach((child) => {
      styles.push(generateCssFromStyles(child))
    })
  }

  return styles.join('\n')
}

export const enhanceComponentStyles = (componentType, generatedCss) => {
  // Base styles for all components
  let enhancedStyles = `${generatedCss}

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
  }`;

  // Add component-specific styles based on the detected type
  if (componentType === 'login') {
    enhancedStyles += `
  /* Login form specific styles */
  .card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .card-body {
    padding: 24px;
  }

  h2.text-center {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 24px;
    color: #000;
  }

  .form-label {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
  }

  .form-control {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 14px;
  }

  .btn-primary {
    background-color: #003966;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    padding: 10px 0;
  }

  .btn-primary:hover {
    background-color: #00508a;
  }

  .form-check-input {
    width: 16px;
    height: 16px;
  }

  .text-decoration-none {
    color: #0078d4;
    font-size: 14px;
  }`;
  } else if (componentType === 'forgot_password') {
    enhancedStyles += `
  /* Forgot Password form specific styles */
  .card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .card-body {
    padding: 24px;
  }

  h2.text-center {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 24px;
    color: #333;
  }

  .form-label {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
  }

  .form-control {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 14px;
  }

  .text-muted {
    font-size: 13px;
    margin-bottom: 16px;
  }

  .btn-primary {
    background-color: #0078d4;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    padding: 10px 0;
  }

  .btn-primary:hover {
    background-color: #0062a9;
  }

  .text-decoration-none {
    color: #0078d4;
    font-size: 14px;
    display: block;
    text-align: center;
    margin-top: 16px;
  }`;
  } else if (componentType === 'change_password') {
    enhancedStyles += `
  /* Change Password form specific styles */
  .card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .card-body {
    padding: 24px;
  }

  h2.text-center {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 24px;
    color: #333;
  }

  .form-label {
    font-size: 14px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
  }

  .form-control {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px 12px;
    font-size: 14px;
  }

  .input-group-text {
    background-color: transparent;
    border-color: #ddd;
  }

  .btn-primary {
    background-color: #003966;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    padding: 10px 0;
    margin-top: 16px;
  }

  .btn-primary:hover {
    background-color: #00508a;
  }

  .text-center a {
    color: #0078d4;
    font-size: 14px;
    display: block;
    margin-top: 16px;
  }`;
  } else {
    // Default styles for other components
    enhancedStyles += `
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
  }`;
  }

  return enhancedStyles;
}
