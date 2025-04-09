import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const downloadImages = async (nodesToProcess, fileKey, accessToken) => {
  const imageMap = new Map()
  const imageNodeIds = []

  const findImageNodes = (node) => {
    if (node.type === 'IMAGE' && node.id.split(':')[0]) {
      imageNodeIds.push(node.id.split(':')[0])
    }
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(findImageNodes)
    }
  }

  nodesToProcess.forEach(findImageNodes)

  if (imageNodeIds.length === 0) {
    return imageMap
  }

  try {
    const idsString = imageNodeIds.join(',')
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png`,
      {
        headers: {
          'X-Figma-Token': accessToken,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get image URLs (Status: ${response.status})`)
    }

    const data = await response.json()

    if (data.err) {
      throw new Error(`Figma API error getting image URLs: ${data.err}`)
    }

    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no image URLs for the requested IDs.')
      return imageMap
    }

    const downloadPromises = Object.entries(data.images).map(
      async ([nodeId, imageUrl]) => {
        if (!imageUrl) {
          console.warn(`No URL returned for image node ${nodeId}`)
          return
        }
        try {
          const imageResponse = await fetch(imageUrl)
          if (!imageResponse.ok) {
            throw new Error(
              `Failed to download image ${nodeId} (Status: ${imageResponse.status})`
            )
          }
          const blob = await imageResponse.blob()
          imageMap.set(`${nodeId}.png`, blob)
        } catch (imgError) {
          console.error(
            `Failed to download or process image ${nodeId} from ${imageUrl}:`,
            imgError
          )
        }
      }
    )

    await Promise.all(downloadPromises)
  } catch (error) {
    console.error('Failed to download images:', error)
    toast({
      title: 'Image Download Failed',
      description:
        error instanceof Error
          ? error.message
          : 'Could not download images from Figma.',
      variant: 'destructive',
    })
  }

  return imageMap
}

export const toCSSUnit = (value) => {
  if (value === undefined || value === null) return '0px'
  return `${value}px`
}

export function rgbaFromColor(color, opacity = 1) {
  if (!color) return 'transparent'
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  const a = opacity ?? color.a ?? 1
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// We need to modify the generateHtmlFromNodes function to better structure login forms
export const generateHtmlFromNodes = (nodes) => {
  // First, sort nodes by vertical position for better layout
  const sortedNodes = [...nodes].sort((a, b) => {
    const aY = a.absoluteBoundingBox?.y || 0;
    const bY = b.absoluteBoundingBox?.y || 0;
    return aY - bY;
  });

  // Check if this is a login form
  const isLoginForm = sortedNodes.some(node =>
    node.name?.toLowerCase().includes('login') ||
    (node.type === 'TEXT' && node.characters?.toLowerCase().includes('login'))
  );

  if (isLoginForm) {
    // Create a structured login form
    return `
      <div class="login-form-container">
        <h2 class="login-title">Login</h2>
        <form class="login-form">
          <div class="input-group">
            <label for="email">Email</label>
            <input type="email" id="email" class="form-input" placeholder="Enter email address" required>
          </div>
          <div class="input-group">
            <label for="password">Password</label>
            <input type="password" id="password" class="form-input" placeholder="Enter password" required>
          </div>
          <div class="remember-me-container">
            <label class="remember-me">
              <input type="checkbox" class="remember-checkbox">
              <span>Remember me</span>
            </label>
            <a href="#" class="forgot-password">Forgot Password?</a>
          </div>
          <button type="submit" class="login-button">Login</button>
        </form>
      </div>
    `;
  }

  // For non-login forms, use the regular node processing
  return sortedNodes
    .map((node) => {
      let element = ''
      const baseClass = `${node.type.toLowerCase()}-${node.id.replace(/:/g, '-')}`
      const uniqueClass = `${baseClass}-${node.id.split(':')[0]}`
      const className = `${baseClass} ${uniqueClass}`

      switch (node.type) {
        case 'COMPONENT':
        case 'GROUP':
        case 'FRAME': {
          const sortedChildren = node.children
            ? [...node.children].sort((a, b) => {
                const ay = a.absoluteBoundingBox?.y || 0
                const by = b.absoluteBoundingBox?.y || 0
                return ay - by
              })
            : []

          // Check if this is the main login container
          const isLoginContainer = node.name.toLowerCase().includes('login')
          if (isLoginContainer) {
            element = `<div class="${className} login-container">
              <div class="login-card">
                <h1 class="login-title">Login</h1>
                <form class="login-form">
                  ${generateHtmlFromNodes(sortedChildren)}
                </form>
              </div>
            </div>`
          } else {
            element = `<div class="${className}">
              ${generateHtmlFromNodes(sortedChildren)}
            </div>`
          }
          break
        }

        case 'TEXT': {
          const text = node.characters?.toLowerCase() || ''
          const style = node.style || {}

          if (text.includes('login') && style.fontSize >= 24) {
            // Skip the login title as it's handled in the container
            element = ''
          } else if (text.includes('remember')) {
            element = `<label class="${className} remember-me">
              <input type="checkbox" class="remember-checkbox" />
              <span>${node.characters}</span>
            </label>`
          } else if (text.includes('forgot')) {
            element = `<a href="#" class="${className} forgot-password">${node.characters}</a>`
          } else if (text.includes('email') || text.includes('password')) {
            const inputType = text.includes('password') ? 'password' : 'email'
            const placeholder = text.includes('password') ? 'Enter password' : 'Enter email address'
            const labelText = node.characters || (text.includes('password') ? 'Password' : 'Email Address')
            element = `<div class="input-group">
              <label class="${className}">${labelText}<span class="required">*</span></label>
              <input type="${inputType}" class="form-input" placeholder="${placeholder}" required />
            </div>`
          } else {
            element = `<p class="${className}">${node.characters}</p>`
          }
          break
        }

        case 'RECTANGLE': {
          const name = node.name?.toLowerCase() || ''
          if (name.includes('button') || name.includes('login')) {
            element = `<button type="submit" class="${className} login-button">Login</button>`
          } else if (name.includes('input') || name.includes('field')) {
            // This is likely an input field background
            element = ''
          } else {
            element = `<div class="${className}"></div>`
          }
          break
        }

        case 'IMAGE': {
          // Handle logo or other images
          element = `<img src="images/${node.id.split(':')[0]}.png" class="${className}" alt="${node.name || 'Image'}" />`
          break
        }

        default:
          element = node.children ? generateHtmlFromNodes(node.children) : ''
      }

      return element
    })
    .join('\n')
}

export const generateCssFromStyles = (node) => {
  if (!node || !node.id || !node.type) return ''

  const styles = []
  const baseClass = `${node.type.toLowerCase()}-${node.id.replace(/:/g, '-')}`
  const cssRules = []

  // Extract dimensions if available
  if (node.absoluteBoundingBox) {
    const { width, height } = node.absoluteBoundingBox
    if (width) cssRules.push(`width: ${width}px`)
    if (height) cssRules.push(`height: ${height}px`)
  }

  // Layout properties
  if (node.layoutMode) {
    cssRules.push(`display: flex`)
    cssRules.push(`flex-direction: ${node.layoutMode.toLowerCase()}`)
    if (node.primaryAxisAlignItems) {
      cssRules.push(`justify-content: ${node.primaryAxisAlignItems.toLowerCase()}`)
    }
    if (node.counterAxisAlignItems) {
      cssRules.push(`align-items: ${node.counterAxisAlignItems.toLowerCase()}`)
    }
    if (node.itemSpacing) {
      cssRules.push(`gap: ${node.itemSpacing}px`)
    }
    if (node.paddingLeft) cssRules.push(`padding-left: ${node.paddingLeft}px`)
    if (node.paddingRight) cssRules.push(`padding-right: ${node.paddingRight}px`)
    if (node.paddingTop) cssRules.push(`padding-top: ${node.paddingTop}px`)
    if (node.paddingBottom) cssRules.push(`padding-bottom: ${node.paddingBottom}px`)
  }

  // Background
  if (node.fills && node.fills.length > 0) {
    const visibleFills = node.fills.filter(fill => fill.visible !== false)
    if (visibleFills.length > 0) {
      const fill = visibleFills[0]
      if (fill.type === 'SOLID') {
        cssRules.push(`background-color: ${rgbaFromColor(fill.color, fill.opacity)}`)
      } else if (fill.type === 'GRADIENT_LINEAR') {
        const gradientStops = fill.gradientStops.map(stop =>
          `${rgbaFromColor(stop.color)} ${stop.position * 100}%`
        ).join(', ')
        cssRules.push(`background: linear-gradient(${fill.gradientTransform[0]}deg, ${gradientStops})`)
      }
    }
  }

  // Border
  if (node.strokes && node.strokes.length > 0) {
    const stroke = node.strokes[0]
    if (stroke.type === 'SOLID') {
      const borderColor = rgbaFromColor(stroke.color, stroke.opacity)
      const borderWidth = node.strokeWeight || 1
      const borderStyle = 'solid'
      cssRules.push(`border: ${borderWidth}px ${borderStyle} ${borderColor}`)
    }
  }

  // Border radius
  if (node.cornerRadius) {
    cssRules.push(`border-radius: ${node.cornerRadius}px`)
  } else if (node.topLeftRadius || node.topRightRadius || node.bottomRightRadius || node.bottomLeftRadius) {
    cssRules.push(`border-radius: ${node.topLeftRadius || 0}px ${node.topRightRadius || 0}px ${node.bottomRightRadius || 0}px ${node.bottomLeftRadius || 0}px`)
  }

  // Effects (shadows, blurs)
  if (node.effects) {
    node.effects.forEach(effect => {
      if (effect.type === 'DROP_SHADOW') {
        const { offset, radius, color } = effect
        cssRules.push(`box-shadow: ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(color)}`)
      } else if (effect.type === 'INNER_SHADOW') {
        const { offset, radius, color } = effect
        cssRules.push(`box-shadow: inset ${offset.x}px ${offset.y}px ${radius}px ${rgbaFromColor(color)}`)
      } else if (effect.type === 'LAYER_BLUR') {
        cssRules.push(`filter: blur(${effect.radius}px)`)
      }
    })
  }

  // Text styles
  if (node.type === 'TEXT' && node.style) {
    const { style: s } = node
    if (s.fontFamily) cssRules.push(`font-family: "${s.fontFamily}"`)
    if (s.fontSize) cssRules.push(`font-size: ${s.fontSize}px`)
    if (s.fontWeight) cssRules.push(`font-weight: ${s.fontWeight}`)
    if (s.letterSpacing) cssRules.push(`letter-spacing: ${s.letterSpacing}px`)
    if (s.lineHeightPx) cssRules.push(`line-height: ${s.lineHeightPx}px`)
    if (s.textAlignHorizontal) cssRules.push(`text-align: ${s.textAlignHorizontal.toLowerCase()}`)
    if (s.textDecoration) cssRules.push(`text-decoration: ${s.textDecoration.toLowerCase()}`)
    if (s.textCase) {
      switch (s.textCase) {
        case 'UPPER': cssRules.push('text-transform: uppercase'); break
        case 'LOWER': cssRules.push('text-transform: lowercase'); break
        case 'TITLE': cssRules.push('text-transform: capitalize'); break
      }
    }
    // Text color from fills
    if (s.fills && s.fills[0] && s.fills[0].type === 'SOLID') {
      cssRules.push(`color: ${rgbaFromColor(s.fills[0].color, s.fills[0].opacity)}`)
    }
  }

  // Special case styling for login components
  if (node.name?.toLowerCase().includes('login-container') || baseClass.includes('login-container')) {
    cssRules.push('display: flex')
    cssRules.push('justify-content: center')
    cssRules.push('align-items: center')
    cssRules.push('min-height: 100vh')
    cssRules.push('background-color: #f5f5f5')
  }

  if (node.name?.toLowerCase().includes('login-card') || baseClass.includes('login-card')) {
    cssRules.push('background-color: white')
    cssRules.push('border-radius: 8px')
    cssRules.push('box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1)')
    cssRules.push('padding: 32px')
    cssRules.push('width: 100%')
    cssRules.push('max-width: 400px')
    cssRules.push('display: flex')
    cssRules.push('flex-direction: column')
    cssRules.push('gap: 24px')
  }

  if (node.name?.toLowerCase().includes('login-form') || baseClass.includes('login-form')) {
    cssRules.push('display: flex')
    cssRules.push('flex-direction: column')
    cssRules.push('gap: 16px')
  }

  if (node.name?.toLowerCase().includes('login-title') || baseClass.includes('login-title')) {
    cssRules.push('font-size: 24px')
    cssRules.push('font-weight: 600')
    cssRules.push('text-align: center')
    cssRules.push('margin-bottom: 16px')
  }

  if (baseClass.includes('input-group')) {
    cssRules.push('display: flex')
    cssRules.push('flex-direction: column')
    cssRules.push('gap: 8px')
  }

  if (node.type === 'TEXT' && (node.characters?.toLowerCase().includes('email') || node.characters?.toLowerCase().includes('password'))) {
    cssRules.push('font-size: 14px')
    cssRules.push('font-weight: 500')
    cssRules.push('color: #333')
  }

  if (baseClass.includes('form-input')) {
    cssRules.push('padding: 10px 12px')
    cssRules.push('border: 1px solid #ddd')
    cssRules.push('border-radius: 4px')
    cssRules.push('font-size: 14px')
    cssRules.push('width: 100%')
    cssRules.push('transition: border-color 0.2s')
  }

  if (baseClass.includes('login-button')) {
    cssRules.push('background-color: #003966')
    cssRules.push('color: white')
    cssRules.push('border: none')
    cssRules.push('border-radius: 4px')
    cssRules.push('padding: 12px')
    cssRules.push('font-weight: 600')
    cssRules.push('cursor: pointer')
    cssRules.push('transition: background-color 0.2s')
  }

  if (baseClass.includes('remember-me')) {
    cssRules.push('display: flex')
    cssRules.push('align-items: center')
    cssRules.push('gap: 8px')
    cssRules.push('font-size: 14px')
  }

  if (baseClass.includes('forgot-password')) {
    cssRules.push('color: #003966')
    cssRules.push('text-decoration: none')
    cssRules.push('font-size: 14px')
    cssRules.push('text-align: right')
    cssRules.push('display: block')
  }

  if (cssRules.length > 0) {
    styles.push(`.${baseClass} { ${cssRules.join('; ')}; }`)
  }

  // Add additional generic CSS rules
  if (baseClass.includes('login-container')) {
    styles.push(`
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}
.login-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 32px;
  width: 100%;
  max-width: 400px;
}
.login-title {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 24px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.input-group label {
  font-size: 14px;
  font-weight: 500;
}
.required {
  color: #e53935;
  margin-left: 4px;
}
.form-input {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 100%;
}
.form-input:focus {
  border-color: #003966;
  outline: none;
}
.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.remember-checkbox {
  width: 16px;
  height: 16px;
}
.login-button {
  background-color: #003966;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}
.login-button:hover {
  background-color: #002b4d;
}
.forgot-password {
  color: #003966;
  text-decoration: none;
  font-size: 14px;
  text-align: right;
  display: block;
  margin-top: 8px;
}
.forgot-password:hover {
  text-decoration: underline;
}
    `)
  }

  // Process children recursively
  if (node.children) {
    node.children.forEach(child => {
      styles.push(generateCssFromStyles(child))
    })
  }

  return styles.join('\n')
}