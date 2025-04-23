import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const toCSSUnit = (value) => {
  if (value === undefined || value === null) return '0px'
  return `${value}px`
}

export function rgbaFromColor(color, opacity = 1) {
  if (!color) return 'rgba(0, 0, 0, 0)'
  const r = Math.round(Math.max(0, Math.min(1, color.r || 0)) * 255)
  const g = Math.round(Math.max(0, Math.min(1, color.g || 0)) * 255)
  const b = Math.round(Math.max(0, Math.min(1, color.b || 0)) * 255)
  const a = Math.max(0, Math.min(1, opacity ?? color.a ?? 1))
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
}

const isInputPlaceholder = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return (
    /enter|type|your|e\.g\./.test(text) && !/\*$/.test(node.characters || '')
  )
}

const isLabel = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return (
    /email|password|confirm|name|username|subject|message|phone/.test(text) &&
    /\*$/.test(node.characters || '')
  )
}

const isSubmitButton = (node) => {
  if (
    (node.type === 'FRAME' || node.type === 'RECTANGLE') &&
    node.children?.length === 1 &&
    node.children[0].type === 'TEXT'
  ) {
    const text = node.children[0].characters?.toLowerCase().trim() || ''
    if (
      /^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(
        text
      )
    ) {
      return true
    }
  }
  if (node.type === 'TEXT') {
    const text = node.characters?.toLowerCase().trim() || ''
    if (
      /^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(
        text
      ) &&
      node.fills?.[0]?.type === 'SOLID'
    ) {
      return true
    }
  }
  return false
}

const isCheckboxLabel = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return /remember|agree|subscribe|i accept|keep me logged in/.test(text)
}

const isLink = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return /forgot|reset|privacy|terms|learn more|click here|need help/.test(text)
}

const isTitle = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase().trim() || ''
  const looksLikeButtonText =
    /^login$|^signin$|^signup$|^submit$|^register$|^send$|^continue$|^save$|^update$/.test(
      text
    )
  return (
    node.style?.fontSize >= 20 ||
    (node.style?.fontSize >= 16 &&
      node.style?.fontWeight >= 600 &&
      !looksLikeButtonText)
  )
}

export function generateHtmlFromNodes(nodes, isRoot = true) {
  function flattenNodes(nodes) {
    let result = []
    for (const node of nodes) {
      result.push(node)
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenNodes(node.children))
      }
    }
    return result
  }

  const allNodes = flattenNodes(nodes)

  // Helper: Find node by text content (case-insensitive, partial match)
  const findNodeByText = (text, exactMatch = false) =>
    allNodes.find(
      (n) =>
        n.type === 'TEXT' &&
        n.characters &&
        (exactMatch
          ? n.characters.toLowerCase().trim() === text.toLowerCase().trim()
          : n.characters.toLowerCase().includes(text.toLowerCase()))
    )

  // Helper: Find input fields (rectangles that look like form inputs)
  const findInputFields = () => {
    return allNodes.filter(
      (n) =>
        (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
        n.absoluteBoundingBox &&
        n.absoluteBoundingBox.width > 100 &&
        n.absoluteBoundingBox.height >= 30 &&
        n.absoluteBoundingBox.height <= 60 &&
        (!n.fills ||
          n.fills.length === 0 ||
          n.fills.some(
            (f) =>
              f.type === 'SOLID' &&
              f.color &&
              f.color.r > 0.9 &&
              f.color.g > 0.9 &&
              f.color.b > 0.9
          ))
    )
  }

  // Helper: Find label for an input field
  const findLabelForInput = (inputNode) => {
    if (!inputNode || !inputNode.absoluteBoundingBox) return null

    // Find text nodes that are positioned above the input
    const possibleLabels = allNodes.filter(
      (n) =>
        n.type === 'TEXT' &&
        n.absoluteBoundingBox &&
        Math.abs(n.absoluteBoundingBox.x - inputNode.absoluteBoundingBox.x) < 100 &&
        n.absoluteBoundingBox.y < inputNode.absoluteBoundingBox.y &&
        n.absoluteBoundingBox.y > inputNode.absoluteBoundingBox.y - 50
    )

    // Sort by vertical proximity to the input
    possibleLabels.sort(
      (a, b) =>
        inputNode.absoluteBoundingBox.y - a.absoluteBoundingBox.y -
        (inputNode.absoluteBoundingBox.y - b.absoluteBoundingBox.y)
    )

    return possibleLabels[0] || null
  }

  // Helper: Find checkboxes in the design
  const findCheckboxes = () => {
    return allNodes.filter(
      (n) =>
        // Look for small squares that might be checkboxes
        (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
        n.absoluteBoundingBox &&
        n.absoluteBoundingBox.width <= 24 &&
        n.absoluteBoundingBox.width >= 12 &&
        n.absoluteBoundingBox.height <= 24 &&
        n.absoluteBoundingBox.height >= 12 &&
        // Check if there's a checkbox-like label nearby
        allNodes.some(
          (label) =>
            label.type === 'TEXT' &&
            isCheckboxLabel(label) &&
            label.absoluteBoundingBox &&
            Math.abs(label.absoluteBoundingBox.x - (n.absoluteBoundingBox.x + n.absoluteBoundingBox.width)) < 50 &&
            Math.abs(label.absoluteBoundingBox.y - n.absoluteBoundingBox.y) < 20
        )
    )
  }

  // Helper: Determine input type based on label text
  const getInputTypeFromLabel = (labelText) => {
    if (!labelText) return 'text'

    const text = labelText.toLowerCase()
    if (/password/i.test(text)) return 'password'
    if (/email/i.test(text)) return 'email'
    if (/date|time/i.test(text)) return 'datetime-local'
    if (/message|description|comment|text/i.test(text)) return 'textarea'
    if (/phone|mobile/i.test(text)) return 'tel'
    if (/number|amount|quantity/i.test(text)) return 'number'
    if (/search/i.test(text)) return 'search'
    if (/url|website|link/i.test(text)) return 'url'

    return 'text'
  }

  // Helper: Find button
  const findButton = () => {
    // First look for a button-like rectangle with text
    const buttonWithText = allNodes.find(
      (n) =>
        (n.type === 'FRAME' || n.type === 'RECTANGLE') &&
        n.children?.length === 1 &&
        n.children[0].type === 'TEXT' &&
        isSubmitButton(n)
    )

    if (buttonWithText) {
      return {
        node: buttonWithText,
        text: buttonWithText.children[0].characters,
      }
    }

    // Then look for text that looks like a button
    const buttonText = allNodes.find(isSubmitButton)

    if (buttonText) {
      return {
        node: buttonText,
        text: buttonText.characters,
      }
    }

    return null
  }

  // Get frame/container node (the parent)
  const containerNode = nodes[0]
  const containerName = containerNode?.name || ''

  // Detect form types more dynamically
  const formType = detectFormType(allNodes, containerName)

  // Start building the HTML
  let html = ''

  // Check if this is a form with sidebar
  const hasSidebar = detectSidebar(allNodes)

  // Generate sidebar if needed
  if (hasSidebar) {
    html += generateSidebar(allNodes, formType)
  }

  // Determine form style based on the design
  const formClasses = formType === 'login' ? 'p-4 rounded-4 shadow bg-white' : ''
  const formStyle = formType === 'login' ? 'max-width:400px;width:100%;' : ''

  // If we have a sidebar, wrap the content in a container
  if (hasSidebar) {
    html += `<div class="flex-grow-1 p-4">\n`
  }

  // Find title node
  const titleNode = findTitleNode(allNodes)

  // Only use IMAGE node for logo if not already in sidebar
  if (!hasSidebar) {
    const logoNode = findLogoNode(allNodes, titleNode)
    if (logoNode) {
      const logoFilename = `${logoNode.id.split(':')[0]}.png`
      html += `<div style="text-align:center;margin-bottom:24px;">\n`
      html += `  <img src="images/${logoFilename}" alt="Logo" style="max-width:160px;max-height:120px;object-fit:contain;" />\n`
      html += `</div>\n`
    }
  }

  html += `<form class="${formClasses}" style="${formStyle}">\n`

  if (titleNode) {
    html += `<h2 class="mb-4 fw-bold ${hasSidebar ? '' : 'text-center'}">${titleNode.characters}</h2>\n`
  }

  // Find all input fields
  const inputFields = findInputFields()

  // Filter inputs based on form type
  const filteredInputs = formType === 'login'
    ? inputFields.filter((inputField) => {
        const label = findLabelForInput(inputField)
        const labelText = label ? label.characters.toLowerCase() : ''
        return labelText.includes('email') || labelText.includes('password')
      })
    : inputFields

  // Process each input field
  filteredInputs.forEach((inputField) => {
    const label = findLabelForInput(inputField)
    if (!label) return // Only render if label exists

    const labelText = label.characters
    const isRequired = labelText.includes('*')
    const cleanLabelText = labelText.replace('*', '').trim()

    // Special handling for notification type (checkboxes)
    if (cleanLabelText.toLowerCase().includes('notification type')) {
      html += generateCheckboxGroup(cleanLabelText, isRequired)
      return
    }

    const inputType = getInputTypeFromLabel(labelText)

    html += `<div class="mb-3">\n`
    html += `  <label class="form-label">${cleanLabelText}`
    if (isRequired) html += '<span class="text-danger">*</span>'
    html += `</label>\n`

    const placeholder =
      inputType === 'datetime-local'
        ? 'Select date & time'
        : inputType === 'password'
        ? 'Enter password'
        : inputType === 'email'
        ? 'Enter email address'
        : inputType === 'text' && cleanLabelText.toLowerCase().includes('name')
        ? 'Type name here'
        : ''

    if (inputType === 'textarea') {
      html += `  <textarea class="form-control" placeholder="Type text here"></textarea>\n`
    } else {
      html += `  <input type="${inputType}" class="form-control" placeholder="${placeholder}" />\n`
    }

    html += `</div>\n`
  })

  // Add notification text field if it's a notification form but wasn't found in inputs
  if (formType === 'notification' && !filteredInputs.some(input => {
    const label = findLabelForInput(input)
    return label && label.characters.toLowerCase().includes('text')
  })) {
    html += `<div class="mb-3">\n`
    html += `  <label class="form-label">Notification Text<span class="text-danger">*</span></label>\n`
    html += `  <textarea class="form-control" placeholder="Type text here" rows="3"></textarea>\n`
    html += `</div>\n`
  }

  // Only render one "Remember me" checkbox if present
  const checkboxes = findCheckboxes()
  let renderedRememberMe = false
  checkboxes.forEach((checkbox) => {
    if (renderedRememberMe) return
    const label = findLabelForInput(checkbox)
    const labelText = label ? label.characters.toLowerCase() : ''
    if (labelText.includes('remember')) {
      html += `<div class="form-check mb-3">\n`
      html += `  <input class="form-check-input" type="checkbox" />\n`
      html += `  <label class="form-check-label">${label.characters}</label>\n`
      html += `</div>\n`
      renderedRememberMe = true
    }
  })

  // Find "Forgot Password" link for login forms
  if (formType === 'login') {
    const forgotPasswordNode = findNodeByText('forgot password')
    if (forgotPasswordNode) {
      html += `<div class="mb-3 text-center">\n`
      html += `  <a href="#" class="text-decoration-none">Forgot Password?</a>\n`
      html += `</div>\n`
    }
  }

  // Button(s)
  const buttonInfo = findButton()
  if (buttonInfo) {
    const buttonStyle = formType === 'login'
      ? 'btn-primary w-100 rounded-pill fw-semibold py-2'
      : 'btn-primary rounded-2 fw-semibold py-2 px-4'

    const buttonMargin = formType === 'login' ? 'mt-3' : 'mt-4'

    if (formType === 'notification') {
      html += `<div class="d-flex gap-2 ${buttonMargin}">\n`
      html += `  <button type="submit" class="btn ${buttonStyle}">${buttonInfo.text}</button>\n`
      html += `  <button type="button" class="btn btn-light rounded-2 fw-semibold py-2 px-4">Cancel</button>\n`
      html += `</div>\n`
    } else {
      html += `<button type="submit" class="btn ${buttonStyle} ${buttonMargin}" style="font-size:1.1rem;">${buttonInfo.text}</button>\n`
    }
  }

  html += `</form>\n`

  // Close the container div if we opened it for the sidebar layout
  if (hasSidebar) {
    html += `</div>\n`
    html += `</div>\n`
  }

  return html
}

// Helper: Detect form type based on content and structure
function detectFormType(nodes, containerName = '') {
  // Check container name first
  if (/login|signin|log in/i.test(containerName)) {
    return 'login'
  }
  if (/notification|push/i.test(containerName)) {
    return 'notification'
  }

  // If name doesn't give us enough info, check content
  const hasPasswordField = nodes.some(n =>
    n.type === 'TEXT' &&
    /password/i.test(n.characters || '')
  )

  const hasEmailField = nodes.some(n =>
    n.type === 'TEXT' &&
    /email/i.test(n.characters || '')
  )

  const hasLoginButton = nodes.some(n =>
    n.type === 'TEXT' &&
    /login|sign in/i.test(n.characters || '')
  )

  const hasNotificationField = nodes.some(n =>
    n.type === 'TEXT' &&
    /notification|push/i.test(n.characters || '')
  )

  if (hasPasswordField && (hasEmailField || hasLoginButton)) {
    return 'login'
  } else if (hasNotificationField) {
    return 'notification'
  }

  return 'generic'
}

// Helper: Detect if design has a sidebar
function detectSidebar(nodes) {
  // Look for a narrow frame on the left side
  const sidebarFrame = nodes.find(n =>
    (n.type === 'FRAME' || n.type === 'RECTANGLE') &&
    n.absoluteBoundingBox &&
    n.absoluteBoundingBox.width < 200 &&
    n.absoluteBoundingBox.height > 400 &&
    n.absoluteBoundingBox.x < 200
  )

  // Or look for a vertical list of menu items
  const menuItems = nodes.filter(n =>
    n.type === 'TEXT' &&
    n.absoluteBoundingBox &&
    n.absoluteBoundingBox.x < 200 &&
    n.characters &&
    n.characters.length < 30
  )

  // If we have multiple menu items stacked vertically, it's likely a sidebar
  const hasVerticalMenu = menuItems.length >= 3 &&
    menuItems.every((item, i) =>
      i === 0 ||
      (item.absoluteBoundingBox.y > menuItems[i-1].absoluteBoundingBox.y + menuItems[i-1].absoluteBoundingBox.height)
    )

  return !!sidebarFrame || hasVerticalMenu
}

// Helper: Generate sidebar HTML
function generateSidebar(nodes, formType) {
  let html = `<div class="d-flex">\n`
  html += `  <div class="sidebar bg-light" style="width: 180px; min-height: 100vh; border-right: 1px solid #dee2e6; padding: 20px 0;">\n`

  // Find logo for sidebar
  const sidebarLogo = nodes.find(n =>
    (n.type === 'IMAGE' || n.type === 'VECTOR' || n.type === 'FRAME') &&
    n.absoluteBoundingBox &&
    n.absoluteBoundingBox.x < 200 &&
    n.absoluteBoundingBox.y < 100 &&
    n.absoluteBoundingBox.width > 30 &&
    n.absoluteBoundingBox.height > 30
  )

  if (sidebarLogo) {
    const logoFilename = sidebarLogo.type === 'IMAGE' ? `${sidebarLogo.id.split(':')[0]}.png` : 'logo.png'
    html += `    <div class="d-flex align-items-center px-3 mb-4">\n`
    html += `      <img src="images/${logoFilename}" alt="Logo" style="height: 40px; width: auto;" />\n`
    html += `    </div>\n`
  }

  // Find menu items
  const menuItems = nodes.filter(n =>
    n.type === 'TEXT' &&
    n.absoluteBoundingBox &&
    n.absoluteBoundingBox.x < 200 &&
    n.characters &&
    n.characters.length < 30
  ).sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y)

  // Map common menu items to icons
  const iconMap = {
    'user': 'bi-people',
    'users': 'bi-people',
    'business': 'bi-building',
    'businesses': 'bi-building',
    'event': 'bi-calendar-event',
    'events': 'bi-calendar-event',
    'schedule': 'bi-calendar-check',
    'schedules': 'bi-calendar-check',
    'notification': 'bi-bell',
    'notifications': 'bi-bell',
    'push': 'bi-bell',
    'dashboard': 'bi-speedometer2',
    'setting': 'bi-gear',
    'settings': 'bi-gear',
    'profile': 'bi-person',
    'message': 'bi-chat',
    'messages': 'bi-chat',
    'analytics': 'bi-graph-up',
    'report': 'bi-file-text',
    'reports': 'bi-file-text',
  }

  html += `    <ul class="nav flex-column">\n`

  menuItems.forEach(item => {
    const itemText = item.characters
    const itemTextLower = itemText.toLowerCase()

    // Find matching icon or use default
    let iconClass = 'bi-circle'
    for (const [key, value] of Object.entries(iconMap)) {
      if (itemTextLower.includes(key)) {
        iconClass = value
        break
      }
    }

    // Check if this item should be active
    const isActive = formType === 'notification' &&
      (itemTextLower.includes('notification') || itemTextLower.includes('push'))

    html += `      <li class="nav-item"><a class="nav-link ${isActive ? 'active' : ''} d-flex align-items-center" href="#"><i class="bi ${iconClass} me-2"></i> ${itemText}</a></li>\n`
  })

  html += `    </ul>\n`

  // Add user profile at bottom
  html += `    <div class="mt-auto px-3 py-3 border-top position-absolute bottom-0 start-0 w-100">\n`
  html += `      <div class="d-flex align-items-center">\n`
  html += `        <div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px;">U</div>\n`
  html += `        <div>User Name</div>\n`
  html += `      </div>\n`
  html += `    </div>\n`

  html += `  </div>\n`

  return html
}

// Helper: Find title node
function findTitleNode(nodes) {
  return nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.style &&
      (n.style.fontSize >= 20 ||
        (n.style.fontSize >= 16 && n.style.fontWeight >= 600)) &&
      n.characters.length < 50 &&
      !isSubmitButton(n)
  )
}

// Helper: Find logo node
function findLogoNode(nodes, titleNode) {
  return nodes.find(
    (n) =>
      n.type === 'IMAGE' &&
      n.absoluteBoundingBox &&
      titleNode &&
      n.absoluteBoundingBox.y + n.absoluteBoundingBox.height <
        titleNode.absoluteBoundingBox.y &&
      n.absoluteBoundingBox.width > 40 &&
      n.absoluteBoundingBox.height > 40
  )
}

// Helper: Generate checkbox group for notification type
function generateCheckboxGroup(labelText, isRequired) {
  let html = `<div class="mb-3">\n`
  html += `  <label class="form-label">${labelText}`
  if (isRequired) html += '<span class="text-danger">*</span>'
  html += `</label>\n`
  html += `  <div>\n`
  html += `    <div class="form-check form-check-inline">\n`
  html += `      <input class="form-check-input" type="checkbox" id="typeNow" checked>\n`
  html += `      <label class="form-check-label" for="typeNow">Now</label>\n`
  html += `    </div>\n`
  html += `    <div class="form-check form-check-inline">\n`
  html += `      <input class="form-check-input" type="checkbox" id="typeSchedule">\n`
  html += `      <label class="form-check-label" for="typeSchedule">Schedule</label>\n`
  html += `    </div>\n`
  html += `  </div>\n`
  html += `</div>\n`
  return html
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
    return new Map()
  }

  const thumbnailMap = new Map()
  try {
    const idsString = nodeIds.join(',')
    const response = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${idsString}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': accessToken } }
    )

    if (!response.ok) {
      throw new Error(`Failed to get thumbnails (Status: ${response.status})`)
    }

    const data = await response.json()
    if (data.err) {
      throw new Error(`Figma API error getting thumbnails: ${data.err}`)
    }

    if (!data.images || Object.keys(data.images).length === 0) {
      console.warn('Figma API returned no thumbnails for the requested frames.')
      return thumbnailMap
    }

    // Map the image URLs to their respective node IDs
    Object.entries(data.images).forEach(([nodeId, imageUrl]) => {
      if (imageUrl) {
        thumbnailMap.set(nodeId, imageUrl)
      }
    })
  } catch (error) {
    console.error('Failed to fetch thumbnails:', error)
  }

  return thumbnailMap
}

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}
