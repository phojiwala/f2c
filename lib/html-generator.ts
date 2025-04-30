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
    if (
      logoNode &&
      (formType === 'login' ||
        formType === 'forgot_password' ||
        formType === 'change_password')
    ) {
      const logoFilename = logoNode.id
        ? `${logoNode.id.split(':')[0]}.png`
        : 'logo.png'
      html += `  <div class="mb-4">\n`
      html += `    <img src="images/${logoFilename}" alt="Logo" style="max-width:180px; max-height:80px; object-fit:contain;" />\n`
      html += `  </div>\n`
    }
    html += `  <div class="col-11 col-sm-8 col-md-6 col-lg-4">\n` // Responsive column width
  }

  // --- Title generation moved ---

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

function generateLoginForm(nodes) {
  // Find frames and labels dynamically
  const emailFrame = nodes.find(
    (n) => (n.type === 'RECTANGLE' || n.type === 'FRAME') && n.name?.toLowerCase().includes('email')
  );
  const passwordFrame = nodes.find(
    (n) => (n.type === 'RECTANGLE' || n.type === 'FRAME') && n.name?.toLowerCase().includes('password')
  );
  const checkboxFrame = nodes.find(
    (n) => (n.type === 'RECTANGLE' || n.type === 'FRAME' || n.type === 'GROUP') && n.name?.toLowerCase().includes('remember')
  );
  const loginButton = nodes.find(
    (n) => (n.type === 'RECTANGLE' || n.type === 'FRAME') && (n.name?.toLowerCase().includes('login button') || isSubmitButton(n))
  );
  const forgotLink = nodes.find(
    (n) => n.type === 'TEXT' && /forgot/i.test(n.characters)
  );

  // Find text labels
  const emailLabel = nodes.find(
    (n) => n.type === 'TEXT' && /email|username/i.test(n.characters)
  );

  // --- IMPROVED: Find the password label that is closest and above the password input ---
  let passwordLabel = null;
  if (passwordFrame) {
    const possibleLabels = nodes.filter(
      (n) =>
        n.type === 'TEXT' &&
        /password/i.test(n.characters) &&
        n.absoluteBoundingBox &&
        n.absoluteBoundingBox.y < passwordFrame.absoluteBoundingBox.y + 5 // allow a little overlap
    );
    // Pick the one with the largest y (closest above)
    passwordLabel = possibleLabels.reduce((prev, curr) =>
      (!prev || curr.absoluteBoundingBox.y > prev.absoluteBoundingBox.y) ? curr : prev,
      null
    );
  }
  // Fallback: just pick any password label
  if (!passwordLabel) {
    passwordLabel = nodes.find(
      (n) => n.type === 'TEXT' && /password/i.test(n.characters)
    );
  }

  const checkboxLabel = nodes.find(
    (n) => n.type === 'TEXT' && /remember/i.test(n.characters)
  );
  const buttonTextNode = loginButton?.children?.find((c) => c.type === 'TEXT');
  const buttonText = buttonTextNode?.characters || 'Login';

  // Extract styles
  const emailLabelStyle = emailLabel?.style || {};
  const passwordLabelStyle = passwordLabel?.style || {};
  const buttonStyle = buttonTextNode?.style || {};
  const forgotLinkStyle = forgotLink?.style || {};

  // Find placeholders
  const emailPlaceholderNode = nodes.find(n =>
    n.type === 'TEXT' && /enter|your email|example@/i.test(n.characters)
  );
  const passwordPlaceholderNode = nodes.find(n =>
    n.type === 'TEXT' && /enter|your password|\*{6,}/i.test(n.characters)
  );
  const emailPlaceholder = emailPlaceholderNode?.characters || 'Enter your email address';
  const passwordPlaceholder = passwordPlaceholderNode?.characters || 'Enter password';

  // --- Build the form (NO card here, only form) ---
  let html = '';
  html += `<form>\n`;

  // Email field
  html += `  <div class="mb-3">\n`;
  html += `    <label for="email" class="form-label" style="font-weight: ${emailLabelStyle.fontWeight || 'normal'}; font-size: ${emailLabelStyle.fontSize || 12}px;">${emailLabel?.characters || 'Email Address*'}</label>\n`;
  html += `    <input type="email" class="form-control" id="email" placeholder="${emailPlaceholder}">\n`;
  html += `  </div>\n`;

  // Password field with eye icon (no input-group)
  html += `  <div class="mb-3">\n`;
  html += `    <label for="password" class="form-label" style="font-weight: ${passwordLabelStyle.fontWeight || 'normal'}; font-size: ${passwordLabelStyle.fontSize || 12}px;">${passwordLabel?.characters || 'Password*'}</label>\n`;
  html += `    <div style="position:relative;">\n`;
  html += `      <input type="password" class="form-control" id="password" placeholder="${passwordPlaceholder}" style="padding-right: 2.5rem;">\n`;
  html += `      <button type="button" id="togglePassword" style="position:absolute; top:50%; right:0.75rem; transform:translateY(-50%); border:none; background:transparent; padding:0; height:2rem; width:2rem; display:flex; align-items:center; justify-content:center;">\n`;
  html += `        <i class="bi bi-eye"></i>\n`;
  html += `      </button>\n`;
  html += `    </div>\n`;
  html += `  </div>\n`;

  // Remember me checkbox
  if (checkboxFrame || checkboxLabel) {
    html += `  <div class="mb-3 form-check">\n`;
    html += `    <input type="checkbox" class="form-check-input" id="remember">\n`;
    html += `    <label class="form-check-label" for="remember">${checkboxLabel?.characters || 'Remember me'}</label>\n`;
    html += `  </div>\n`;
  }

  // Login button
  html += `  <button type="submit" class="btn btn-primary w-100 mb-3" style="font-weight: ${buttonStyle.fontWeight || 'normal'};">${buttonText}</button>\n`;

  // Forgot password link
  if (forgotLink) {
    html += `  <div class="text-center">\n`;
    html += `    <a href="#" class="text-decoration-none" style="color: ${forgotLinkStyle.color || '#0d6efd'}; font-weight: ${forgotLinkStyle.fontWeight || 'normal'};">${forgotLink.characters}</a>\n`;
    html += `  </div>\n`;
  }

  html += `</form>\n`;

  // Password toggle script (only once per page)
  html += `<script>
    (function() {
      var togglePasswordBtn = document.querySelector('#togglePassword');
      var passwordInput = document.querySelector('#password');
      if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function () {
          var type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
          passwordInput.setAttribute('type', type);
          var icon = this.querySelector('i');
          icon.classList.toggle('bi-eye');
          icon.classList.toggle('bi-eye-slash');
        });
      }
    })();
  </script>\n`;

  return html;
}

function generateEventForm(nodes) {
  let html = ''
  html += `<form>\n`
  html += `  <div class="mb-3">\n`
  html += `    <label for="eventName" class="form-label">Event Name</label>\n`
  html += `    <input type="text" class="form-control" id="eventName">\n`
  html += `  </div>\n`
  html += `  <div class="mb-3">\n`
  html += `    <label for="eventDate" class="form-label">Event Date</label>\n`
  html += `    <input type="date" class="form-control" id="eventDate">\n`
  html += `  </div>\n`
  html += `  <div class="mb-3">\n`
  html += `    <label for="eventDescription" class="form-label">Description</label>\n`
  html += `    <textarea class="form-control" id="eventDescription" rows="3"></textarea>\n`
  html += `  </div>\n`
  html += `  <button type="submit" class="btn btn-primary">Save Event</button>\n`
  html += `</form>\n`
  return html
}

function generateNotificationForm(nodes) {
  let html = ''
  html += `<div class="card mb-4">\n`
  html += `  <div class="card-body">\n`
  html += `    <form>\n`
  html += `      <div class="mb-3">\n`
  html += `        <label for="notificationType" class="form-label">Notification Type</label>\n`
  html += `        <select class="form-select" id="notificationType">\n`
  html += `          <option>Information</option>\n`
  html += `          <option>Warning</option>\n`
  html += `          <option>Critical</option>\n`
  html += `        </select>\n`
  html += `      </div>\n`
  html += `      <div class="mb-3">\n`
  html += `        <label for="notificationText" class="form-label">Notification Text</label>\n`
  html += `        <textarea class="form-control" id="notificationText" rows="3"></textarea>\n`
  html += `      </div>\n`
  html += `      <div class="mb-3">\n`
  html += `        <label for="notificationRecipients" class="form-label">Recipients</label>\n`
  html += `        <select class="form-select" id="notificationRecipients">\n`
  html += `          <option>All Users</option>\n`
  html += `          <option>Admins Only</option>\n`
  html += `          <option>Selected Users</option>\n`
  html += `        </select>\n`
  html += `      </div>\n`
  html += `      <button type="submit" class="btn btn-primary">Send Notification</button>\n`
  html += `    </form>\n`
  html += `  </div>\n`
  html += `</div>\n`
  return html
}

function generateSidebar(nodes, formType) {
  const logoNode = nodes.find(
    (n) =>
      (n.type === 'IMAGE' || n.type === 'VECTOR' || n.type === 'FRAME') &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.x < 200 &&
      n.absoluteBoundingBox.y < 150
  )

  // Find menu items
  const menuItems = nodes
    .filter(
      (n) =>
        n.type === 'TEXT' &&
        n.absoluteBoundingBox &&
        n.absoluteBoundingBox.x < 200 && // Ensure it's in the left sidebar area
        n.absoluteBoundingBox.width < 200 && // Not too wide (to exclude table cells)
        n.characters &&
        n.characters.length < 30 &&
        !/no\.|profile|photo|email|registered|action/i.test(n.characters) && // Exclude table headers
        !/user|profile|log out|sign out/i.test(n.characters) // Exclude user profile items
    )
    .sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y)

  // Find user profile text if any
  const userProfileText = nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.x < 200 &&
      n.absoluteBoundingBox.y > 400 &&
      n.characters &&
      /user|profile|name/i.test(n.characters)
  )

  // Start sidebar HTML
  let html = `<div class="col-auto d-flex flex-column flex-shrink-0 bg-dark text-white" style="width: 240px; min-height: 100vh;">\n`

  // Add logo if found
  if (logoNode) {
    const logoFilename = logoNode.id
      ? `${logoNode.id.split(':')[0]}.png`
      : 'logo.png'
    html += `  <div class="d-flex align-items-center justify-content-center py-3 mb-3">\n`
    html += `    <img src="images/${logoFilename}" alt="Logo" style="max-width:160px;max-height:60px;object-fit:contain;" />\n`
    html += `  </div>\n`
  } else {
    html += `  <a href="/" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none p-3">\n`
    html += `    <span class="fs-4">Dashboard</span>\n`
    html += `  </a>\n`
  }

  html += `  <hr>\n`
  html += `  <ul class="nav nav-pills flex-column mb-auto p-2">\n`

  // Map common menu items to icons
  const iconMap = {
    dashboard: 'bi-speedometer2',
    home: 'bi-house-door',
    user: 'bi-people',
    users: 'bi-people',
    business: 'bi-building',
    businesses: 'bi-building',
    event: 'bi-calendar-event',
    events: 'bi-calendar-event',
    schedule: 'bi-calendar-check',
    schedules: 'bi-calendar-check',
    notification: 'bi-bell',
    notifications: 'bi-bell',
    push: 'bi-bell',
    setting: 'bi-gear',
    settings: 'bi-gear',
    profile: 'bi-person',
    message: 'bi-chat',
    messages: 'bi-chat',
    analytics: 'bi-graph-up',
    report: 'bi-file-text',
    reports: 'bi-file-text',
    logout: 'bi-box-arrow-right',
    upcoming: 'bi-calendar-week',
  }

  if (menuItems.length < 2) {
    const defaultItems = [
      { text: 'Dashboard', icon: 'bi-speedometer2', active: false },
      { text: 'Users', icon: 'bi-people', active: formType === 'users' },
      {
        text: 'Notifications',
        icon: 'bi-bell',
        active: formType === 'notification',
      },
      { text: 'Settings', icon: 'bi-gear', active: false },
    ]

    defaultItems.forEach((item) => {
      html += `    <li class="nav-item">\n`
      html += `      <a href="#" class="nav-link ${
        item.active ? 'active' : 'text-white'
      }">\n`
      html += `        <i class="bi ${item.icon} me-2"></i>\n`
      html += `        ${item.text}\n`
      html += `      </a>\n`
      html += `    </li>\n`
    })
  } else {
    menuItems.forEach((item) => {
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
      const isActive =
        (formType === 'notification' &&
          (itemTextLower.includes('notification') ||
            itemTextLower.includes('push'))) ||
        (formType === 'users' && itemTextLower.includes('user')) ||
        (formType === 'event' && itemTextLower.includes('event'))

      html += `    <li class="nav-item">\n`
      html += `      <a href="#" class="nav-link ${
        isActive ? 'active' : 'text-white'
      }">\n`
      html += `        <i class="bi ${iconClass} me-2"></i>\n`
      html += `        ${itemText}\n`
      html += `      </a>\n`
      html += `    </li>\n`
    })
  }

  html += `  </ul>\n`
  html += `  <hr>\n`

  const userName = userProfileText ? userProfileText.characters : 'User'
  html += `  <div class="dropdown p-3">\n`
  html += `    <a href="#" class="d-flex align-items-center text-white text-decoration-none dropdown-toggle" id="dropdownUser1" data-bs-toggle="dropdown" aria-expanded="false">\n`
  html += `      <img src="https://github.com/mdo.png" alt="" width="32" height="32" class="rounded-circle me-2">\n`
  html += `      <strong>${userName}</strong>\n`
  html += `    </a>\n`
  html += `    <ul class="dropdown-menu dropdown-menu-dark text-small shadow" aria-labelledby="dropdownUser1">\n`
  html += `      <li><a class="dropdown-item" href="#">Profile</a></li>\n`
  html += `      <li><a class="dropdown-item" href="#">Settings</a></li>\n`
  html += `      <li><hr class="dropdown-divider"></li>\n`
  html += `      <li><a class="dropdown-item" href="#">Sign out</a></li>\n`
  html += `    </ul>\n`
  html += `  </div>\n`
  html += `</div>\n`

  return html
}

function generateForgotPasswordForm(nodes) {
  // Find email input and related elements
  const emailLabel = nodes.find(
    (n) => n.type === 'TEXT' && n.characters && /email|mail/i.test(n.characters)
  )

  // Find submit button
  const buttonNode = nodes.find(
    (n) =>
      (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
      ((n.children &&
        n.children.some(
          (child) =>
            child.type === 'TEXT' &&
            /submit|send|reset|recover/i.test(child.characters)
        )) ||
        (n.name && /button|submit|send|reset/i.test(n.name)))
  )

  // Extract button text if available
  const buttonText =
    buttonNode && buttonNode.children
      ? buttonNode.children.find((c) => c.type === 'TEXT')?.characters ||
        'Reset Password'
      : 'Reset Password'

  // Start building the form
  let html = ''
  html += `<form>\n`

  // Email field
  html += `  <div class="mb-3">\n`
  html += `    <label for="email" class="form-label">${
    emailLabel ? emailLabel.characters : 'Email Address*'
  }</label>\n`
  html += `    <input type="email" class="form-control" id="email" placeholder="Enter your email">\n`
  html += `  </div>\n`

  // Description text
  html += `  <div class="mb-4 text-muted small">\n`
  html += `    Enter your email address and we'll send you a link to reset your password.\n`
  html += `  </div>\n`

  // Submit button
  html += `  <button type="submit" class="btn btn-primary w-100 mb-3">${buttonText}</button>\n`

  // Back to login link
  html += `  <div class="text-center">\n`
  html += `    <a href="#" class="text-decoration-none">Back to Login</a>\n`
  html += `  </div>\n`

  html += `</form>\n`
  return html
}

function generateChangePasswordForm(nodes) {
  // Find password labels
  const passwordLabels = nodes.filter(
    (n) =>
      n.type === 'TEXT' && n.characters && /password|pwd/i.test(n.characters)
  )

  // Find submit button
  const buttonNode = nodes.find(
    (n) =>
      (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
      ((n.children &&
        n.children.some(
          (child) =>
            child.type === 'TEXT' &&
            /submit|save|update|change/i.test(child.characters)
        )) ||
        (n.name && /button|submit|save|update/i.test(n.name)))
  )

  // Extract button text if available
  const buttonText =
    buttonNode && buttonNode.children
      ? buttonNode.children.find((c) => c.type === 'TEXT')?.characters ||
        'Change Password'
      : 'Change Password'

  // Start building the form
  let html = ''
  html += `<form>\n`

  // Current password field
  html += `  <div class="mb-3">\n`
  html += `    <label for="currentPassword" class="form-label">Current Password*</label>\n`
  html += `    <div>\n`
  html += `      <input type="password" class="form-control" id="currentPassword" placeholder="Enter current password">\n`
  html += `      <button class="btn btn-outline-secondary" type="button">\n`
  html += `        <i class="bi bi-eye"></i>\n`
  html += `      </button>\n`
  html += `    </div>\n`
  html += `  </div>\n`

  // New password field
  html += `  <div class="mb-3">\n`
  html += `    <label for="newPassword" class="form-label">New Password*</label>\n`
  html += `    <div>\n`
  html += `      <input type="password" class="form-control" id="newPassword" placeholder="Enter new password">\n`
  html += `      <button class="btn btn-outline-secondary" type="button">\n`
  html += `        <i class="bi bi-eye"></i>\n`
  html += `      </button>\n`
  html += `    </div>\n`
  html += `  </div>\n`

  // Confirm password field
  html += `  <div class="mb-3">\n`
  html += `    <label for="confirmPassword" class="form-label">Confirm Password*</label>\n`
  html += `    <div>\n`
  html += `      <input type="password" class="form-control" id="confirmPassword" placeholder="Confirm new password">\n`
  html += `      <button class="btn btn-outline-secondary" type="button">\n`
  html += `        <i class="bi bi-eye"></i>\n`
  html += `      </button>\n`
  html += `    </div>\n`
  html += `  </div>\n`

  // Submit button
  html += `  <button type="submit" class="btn btn-primary w-100">${buttonText}</button>\n`

  html += `</form>\n`
  return html
}
