import {
  generateLoginForm,
  generateEventForm,
  generateSidebar,
  generateNotificationForm,
  generateChangePasswordForm,
  generateForgotPasswordForm,
} from './common-generators'
import {
  detectBootstrapComponent,
  detectTabs,
  detectSearchInput,
  detectLoginRelatedScreen,
  detectNotificationForm,
  detectTable,
} from './detector'
import {
  isInputPlaceholder,
  isLabel,
  findTitleNode,
  findLogoNode,
  isSubmitButton,
  isCheckboxLabel,
  findInputCandidates, // Import helper to find input fields
} from './figma-node-helpers'
import { detectFormType, detectSidebar } from './utils'

export function generateHtmlFromNodes(
  nodes,
  imageUrlMap = new Map(),
  isRoot = true
) {
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
  // Improved detection logic
  const hasTable = detectTable(allNodes) !== null
  const hasNotificationForm = detectNotificationForm(allNodes)
  const isLoginRelated = detectLoginRelatedScreen(allNodes)

  // Find potential input fields and labels
  const inputCandidates = findInputCandidates(allNodes)
  const labels = allNodes.filter(isLabel)
  const hasEmailField =
    labels.some((l) => /email|username/i.test(l.characters)) ||
    inputCandidates.some((n) => n.name && /email|username/i.test(n.name))
  const hasPasswordField =
    labels.some((l) => /password|pwd/i.test(l.characters)) ||
    inputCandidates.some((n) => n.name && /password|pwd/i.test(n.name))

  // Check for specific login-related screens more accurately
  const isForgotPassword =
    allNodes.some(
      (n) =>
        n.type === 'TEXT' &&
        n.characters &&
        /forgot password|\bforgot\b|\breset password\b|recovery email/i.test(
          n.characters
        )
    ) && !hasPasswordField // Forgot password usually lacks a password field

  const isChangePassword =
    allNodes.some(
      (n) =>
        n.type === 'TEXT' &&
        n.characters &&
        /change password|new password|confirm password/i.test(n.characters)
    ) && hasPasswordField // Change password must have password fields

  // Find the main title to help with detection
  const mainTitleNode = findTitleNode(allNodes) // Ensure findTitleNode correctly identifies "Login"
  const mainTitleText = mainTitleNode?.characters || ''

  // Determine the primary content type based on what we detect
  let primaryContentType = 'unknown'
  if (isLoginRelated) {
    // Prioritize Login if both email and password fields are present
    if (hasEmailField && hasPasswordField && !isChangePassword) {
      primaryContentType = 'login'
    } else if (isForgotPassword && /forgot|reset/i.test(mainTitleText)) {
      primaryContentType = 'forgot_password'
    } else if (isChangePassword && /change|new password/i.test(mainTitleText)) {
      primaryContentType = 'change_password'
    } else if (hasEmailField && hasPasswordField) {
      // Fallback if title doesn't match but fields do
      primaryContentType = 'login'
    } else if (isForgotPassword) {
      // If only forgot password indicators are strong
      primaryContentType = 'forgot_password'
    } else if (isChangePassword) {
      // If only change password indicators are strong
      primaryContentType = 'change_password'
    } else {
      // Default to login if still ambiguous but login-related
      primaryContentType = 'login'
    }
  } else if (hasTable) {
    primaryContentType = 'table'
  } else if (hasNotificationForm) {
    primaryContentType = 'notification'
  }

  // Use the detected content type to influence form type detection
  let formType =
    primaryContentType === 'notification'
      ? 'notification'
      : primaryContentType === 'table'
      ? 'users'
      : primaryContentType === 'login'
      ? 'login'
      : primaryContentType === 'forgot_password'
      ? 'forgot_password'
      : primaryContentType === 'change_password'
      ? 'change_password'
      : detectFormType(allNodes) // Fallback detection

  // Detect layout components
  const hasSidebar = detectSidebar(allNodes) && !isLoginRelated // Don't show sidebar for login screens
  const tabs = detectTabs(allNodes)
  const searchInput = detectSearchInput(allNodes)
  const tableNode = detectTable(allNodes)

  let html = ''
  const logoNode = findLogoNode(allNodes) // Find logo node

  // --- Add detailed logging before accessing the map ---
  if (logoNode) {
    console.log(
      `HTML_GEN: Found logo node - ID: ${logoNode.id}, Name: ${logoNode.name}, Type: ${logoNode.type}`
    )
    // Log the map content to see if the ID exists as a key
    console.log(
      `HTML_GEN: ImageUrlMap received:`,
      JSON.stringify(Array.from(imageUrlMap.entries()))
    )
    console.log(`HTML_GEN: Attempting to get URL for ID: ${logoNode.id}`)
  } else {
    console.log('HTML_GEN: Logo node NOT found by findLogoNode.')
  }

  // Start with proper Bootstrap container structure
  if (hasSidebar) {
    // Create a container-fluid for full-width layout with sidebar
    html += `<div class="container-fluid p-0">\n`
    html += `  <div class="row g-0">\n`

    // Add the sidebar as the first column
    html += generateSidebar(allNodes, formType)

    // Start the main content column
    html += `    <div class="col p-4">\n`
  } else {
    // For login forms or other centered content without sidebar
    html += `<div class="container d-flex flex-column justify-content-center align-items-center" style="min-height: 100vh;">\n`
    // Add logo if found and it's a login/password screen
    // Ensure logoNode exists before trying to access its properties or the map
    if (
      logoNode &&
      (formType === 'login' ||
        formType === 'forgot_password' ||
        formType === 'change_password')
    ) {
      // Get the URL from the map using the logo node's ID
      const logoUrl = imageUrlMap.get(logoNode.id) // Use the ID found here
      console.log('HTML_GEN: Result of imageUrlMap.get(logoNode.id):', logoUrl) // Log the actual result

      if (logoUrl) {
        html += `  <div class="mb-4">\n`
        // Use the fetched logoUrl in the src attribute
        html += `    <img src="${logoUrl}" alt="Logo" style="max-width:180px; max-height:80px; object-fit:contain;" />\n`
        html += `  </div>\n`
      } else {
        // Log the ID again for clarity on failure
        console.warn(
          `HTML_GEN: Logo URL was undefined in map for node ID: ${logoNode.id}`
        )
      }
    } else if (
      !logoNode &&
      (formType === 'login' ||
        formType === 'forgot_password' ||
        formType === 'change_password')
    ) {
      // Log if logo wasn't found but was expected for this form type
      console.warn('HTML_GEN: Logo node was not found, cannot display logo.')
    }
    html += `  <div class="col-11 col-sm-8 col-md-6 col-lg-4">\n` // Responsive column width
  }

  // Wrap form content in a card for login/password screens
  if (
    formType === 'login' ||
    formType === 'forgot_password' ||
    formType === 'change_password'
  ) {
    html += `<div class="card shadow-sm">\n` // Using shadow-sm for subtlety like in image 2
    html += `  <div class="card-body p-4">\n` // Standard padding

    // --- Generate Title INSIDE the card body ---
    if (mainTitleNode) {
      const titleStyle = mainTitleNode.style || {}
      const titleCss = `font-weight: ${
        titleStyle.fontWeight || 700
      }; font-size: ${
        titleStyle.fontSize || 24
      }px; color: #000; text-align: center;`
      console.log('Detected Title Node:', mainTitleNode)
      html += `<h2 class="text-center mb-4" style="${titleCss}">${mainTitleNode.characters}</h2>\n`
    } else {
      // Fallback title inside card
      if (formType === 'login') {
        html += `<h2 class="text-center mb-4" style="font-weight: 700; font-size: 24px; color: #000;">Login</h2>\n`
      } else if (formType === 'forgot_password') {
        html += `<h2 class="text-center mb-4" style="font-weight: 700; font-size: 24px; color: #000;">Forgot Password?</h2>\n`
      } else if (formType === 'change_password') {
        html += `<h2 class="text-center mb-4" style="font-weight: 700; font-size: 24px; color: #000;">Change Password</h2>\n`
      }
      console.warn('Main title node not found, using fallback.')
    }
    // --- End Title Generation ---
  } else if (formType === 'event') {
    // Event form might also benefit from a card
    html += `<div class="card shadow-sm mb-4">\n`
    html += `  <div class="card-body p-4">\n`
    // Generate title for event form if needed (assuming it's outside card or handled differently)
    if (mainTitleNode && !isLoginRelated) {
      html += `<h2 class="fw-bold mb-4">${mainTitleNode.characters}</h2>\n`
    }
  } else {
    // Generate title for non-card layouts
    if (mainTitleNode && !isLoginRelated) {
      html += `<h2 class="fw-bold mb-4">${mainTitleNode.characters}</h2>\n`
    }
  }

  // Tabs (if present and not on login screens)
  if (tabs.length > 1 && !isLoginRelated) {
    html += `<ul class="nav nav-tabs mb-4">\n`
    tabs.forEach((tab, idx) => {
      html += `  <li class="nav-item"><a class="nav-link${
        idx === 0 ? ' active' : ''
      }" href="#">${tab.characters}</a></li>\n`
    })
    html += `</ul>\n`
  }

  // Search input (if present or for users table, but not for login screens)
  if ((searchInput || formType === 'users') && !isLoginRelated) {
    html += `<div class="d-flex justify-content-end mb-3">
      <form class="d-flex" role="search">
        <input class="form-control me-2" type="search" placeholder="Search" aria-label="Search">
        <button class="btn btn-outline-primary" type="submit">Search</button>
      </form>
    </div>\n`
  }

  // For event form, wrap fields in a card
  if (formType === 'event') {
    html += `<div class="card mb-4">\n`
    html += `  <div class="card-body">\n`
  }

  // Table (if present and not on login screens)
  if (tableNode && !isLoginRelated) {
    // Extract all text nodes from the table
    function getAllTextNodes(node) {
      let result = []
      if (node.type === 'TEXT') {
        result.push(node)
      }
      if (node.children) {
        node.children.forEach((child) => {
          result = result.concat(getAllTextNodes(child))
        })
      }
      return result
    }

    const allTableTextNodes = getAllTextNodes(tableNode)

    // Find header texts
    const headerNodes = allTableTextNodes.filter((node) =>
      /no\.|profile|photo|name|email|registered|action/i.test(node.characters)
    )

    // Sort headers by X position
    headerNodes.sort(
      (a, b) =>
        (a.absoluteBoundingBox?.x || 0) - (b.absoluteBoundingBox?.x || 0)
    )

    // Find all potential data rows (text nodes that aren't headers)
    const dataTextNodes = allTableTextNodes.filter(
      (node) => !headerNodes.includes(node)
    )

    // Group by Y position to form rows
    const rowGroups = {}
    dataTextNodes.forEach((node) => {
      if (!node.absoluteBoundingBox) return

      // Group by Y position with some tolerance (10px bands)
      const y = Math.round(node.absoluteBoundingBox.y / 10) * 10
      if (!rowGroups[y]) rowGroups[y] = []
      rowGroups[y].push(node)
    })

    // Sort each row by X position
    Object.keys(rowGroups).forEach((y) => {
      rowGroups[y].sort(
        (a, b) =>
          (a.absoluteBoundingBox?.x || 0) - (b.absoluteBoundingBox?.x || 0)
      )
    })

    // Convert to data rows
    const dataRows = Object.keys(rowGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map((y) => rowGroups[y])

    // Generate sample data if we don't have enough rows
    const sampleData = [
      ['01', 'David Wagner', 'mail@mail.com', 'MM/DD/YYYY'],
      ['02', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
      ['03', 'David Wagner', 'mail@mail.com', 'MM/DD/YYYY'],
      ['04', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
      ['05', 'David Wagner', 'mail@mail.com', 'MM/DD/YYYY'],
      ['06', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
      ['07', 'David Wagner', 'mail@mail.com', 'MM/DD/YYYY'],
      ['08', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
      ['09', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
      ['10', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
      ['11', 'Ina Hogan', 'mail@mail.com', 'MM/DD/YYYY'],
    ]

    // Generate table HTML
    html += `<div class="card mb-4">\n`
    html += `  <div class="card-body p-0">\n`
    html += `    <div class="table-responsive">\n`
    html += `      <table class="table table-hover align-middle mb-0">\n`
    html += `        <thead class="bg-light">\n`
    html += `          <tr>\n`

    // Ensure we have all standard headers
    const standardHeaders = [
      'No.',
      'Profile Photo',
      'Name',
      'Email',
      'Registered on',
      'Action',
    ]
    const foundHeaders = headerNodes.map((h) => h.characters)

    // Use found headers, but ensure we have all standard ones
    const finalHeaders = standardHeaders.map((header) => {
      const matchingHeader = foundHeaders.find((h) =>
        h.toLowerCase().includes(header.toLowerCase())
      )
      return matchingHeader || header
    })

    html += `            ${finalHeaders
      .map((h) => `<th class="px-4 py-3">${h}</th>`)
      .join('\n')}\n`
    html += `          </tr>\n`
    html += `        </thead>\n`
    html += `        <tbody>\n`

    // Use actual data rows if we have them, otherwise use sample data
    if (dataRows.length >= 5) {
      dataRows.forEach((row) => {
        html += `          <tr>\n`

        // Map row data to columns based on X position
        finalHeaders.forEach((header, index) => {
          // Find the cell that best matches this column position
          const bestMatch = row.find((cell) => {
            if (!cell.absoluteBoundingBox) return false

            // If we have header nodes with positions, try to align by X
            if (headerNodes[index] && headerNodes[index].absoluteBoundingBox) {
              const headerX = headerNodes[index].absoluteBoundingBox.x
              const cellX = cell.absoluteBoundingBox.x
              return Math.abs(headerX - cellX) < 50 // Within 50px
            }

            return false
          })

          if (bestMatch) {
            if (header.toLowerCase().includes('photo')) {
              html += `            <td class="px-4 py-3"><img src="https://via.placeholder.com/32" class="rounded-circle" alt="Profile"></td>\n`
            } else if (header.toLowerCase().includes('action')) {
              html += `            <td class="px-4 py-3"><button class="btn btn-sm btn-light rounded-circle"><i class="bi bi-arrow-repeat"></i></button></td>\n`
            } else {
              html += `            <td class="px-4 py-3">${bestMatch.characters}</td>\n`
            }
          } else {
            // Fallback for missing cells
            if (header.toLowerCase().includes('photo')) {
              html += `            <td class="px-4 py-3"><img src="https://via.placeholder.com/32" class="rounded-circle" alt="Profile"></td>\n`
            } else if (header.toLowerCase().includes('action')) {
              html += `            <td class="px-4 py-3"><button class="btn btn-sm btn-light rounded-circle"><i class="bi bi-arrow-repeat"></i></button></td>\n`
            } else {
              html += `            <td class="px-4 py-3"></td>\n`
            }
          }
        })

        html += `          </tr>\n`
      })
    } else {
      // Use sample data
      sampleData.forEach((row) => {
        html += `          <tr>\n`
        html += `            <td class="px-4 py-3">${row[0]}</td>\n`
        html += `            <td class="px-4 py-3"><img src="https://via.placeholder.com/32" class="rounded-circle" alt="Profile"></td>\n`
        html += `            <td class="px-4 py-3">${row[1]}</td>\n`
        html += `            <td class="px-4 py-3">${row[2]}</td>\n`
        html += `            <td class="px-4 py-3">${row[3]}</td>\n`
        html += `            <td class="px-4 py-3"><button class="btn btn-sm btn-light rounded-circle"><i class="bi bi-arrow-repeat"></i></button></td>\n`
        html += `          </tr>\n`
      })
    }

    html += `        </tbody>\n`
    html += `      </table>\n`
    html += `    </div>\n`

    // Pagination
    html += `    <nav aria-label="Table navigation" class="d-flex justify-content-between align-items-center p-3 border-top">\n`
    html += `      <div>Items per page: <select class="form-select form-select-sm d-inline-block w-auto"><option>10</option></select></div>\n`
    html += `      <ul class="pagination pagination-sm mb-0">\n`
    html += `        <li class="page-item disabled"><a class="page-link" href="#">Previous</a></li>\n`
    html += `        <li class="page-item active"><a class="page-link" href="#">1</a></li>\n`
    html += `        <li class="page-item"><a class="page-link" href="#">2</a></li>\n`
    html += `        <li class="page-item"><a class="page-link" href="#">Next</a></li>\n`
    html += `      </ul>\n`
    html += `    </nav>\n`
    html += `  </div>\n`
    html += `</div>\n`
  }

  // Add form fields based on form type
  if (formType === 'login') {
    html += generateLoginForm(allNodes)
  } else if (formType === 'forgot_password') {
    html += generateForgotPasswordForm(allNodes)
  } else if (formType === 'change_password') {
    html += generateChangePasswordForm(allNodes)
  } else if (formType === 'event') {
    html += generateEventForm(allNodes)
  } else if (formType === 'notification') {
    html += generateNotificationForm(allNodes)
  }

  // Close card divs if needed
  if (
    formType === 'event' ||
    formType === 'login' ||
    formType === 'forgot_password' ||
    formType === 'change_password'
  ) {
    html += `  </div>\n` // Close card-body
    html += `</div>\n` // Close card
  }

  // Close the main content column
  if (hasSidebar) {
    html += `    </div>\n`
    html += `  </div>\n`
    html += `</div>\n`
  } else {
    html += `  </div>\n`
    html += `</div>\n`
  }

  // If this is the root call, wrap in a complete HTML document
  if (isRoot) {
    return html
  }

  return html
}
