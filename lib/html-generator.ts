import {
  isInputPlaceholder,
  isLabel,
  findTitleNode,
  findLogoNode,
  isSubmitButton,
  isCheckboxLabel,
} from './figma-node-helpers'
import { detectFormType, detectSidebar } from './utils'

function detectBootstrapComponent(node) {
  if (node.type === 'FRAME' || node.type === 'RECTANGLE') {
    if (
      node.children &&
      node.children.length === 1 &&
      node.children[0].type === 'TEXT' &&
      /button|submit|send|ok|save|login|sign in|sign up/i.test(
        node.children[0].characters
      )
    ) {
      return 'button'
    }
    if (
      node.children &&
      node.children.some(
        (child) => child.type === 'TEXT' && /card|title/i.test(child.characters)
      ) &&
      node.children.some(
        (child) =>
          child.type === 'TEXT' && /body|content/i.test(child.characters)
      )
    ) {
      return 'card'
    }
  }
  return null
}

function detectTabs(nodes) {
  const tabCandidates = nodes.filter(
    n =>
      n.type === 'TEXT' &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.y < 200 &&
      n.characters.length < 15
  );
  if (tabCandidates.length >= 2) {
    const yVals = tabCandidates.map(n => n.absoluteBoundingBox.y);
    const ySpread = Math.max(...yVals) - Math.min(...yVals);
    if (ySpread < 40) return tabCandidates;
  }
  return [];
}

function detectSearchInput(nodes) {
  return nodes.find(
    n =>
      (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.width > 200 &&
      n.absoluteBoundingBox.y < 150
  );
}

function detectTable(nodes) {
  // More robust table detection
  const tableFrames = nodes.filter(
    n =>
      (n.type === 'FRAME' || n.type === 'GROUP') &&
      n.children &&
      n.children.length > 5 &&
      // Look for header-like text nodes
      n.children.some(
        child =>
          child.type === 'TEXT' &&
          /no\.|profile|photo|name|email|registered|action/i.test(child.characters)
      )
  );
  
  // Sort by size and complexity - larger frames with more children are more likely to be tables
  if (tableFrames.length > 0) {
    return tableFrames.sort((a, b) => 
      (b.children?.length || 0) - (a.children?.length || 0)
    )[0];
  }
  
  return null;
}

// Add a function to detect if we're looking at a notification form
function detectNotificationForm(nodes) {
  const notificationTextLabel = nodes.find(
    n => 
      n.type === 'TEXT' && 
      n.characters && 
      /notification text/i.test(n.characters)
  );
  
  const notificationTypeLabel = nodes.find(
    n => 
      n.type === 'TEXT' && 
      n.characters && 
      /notification type/i.test(n.characters)
  );
  
  return notificationTextLabel && notificationTypeLabel;
}

export function generateHtmlFromNodes(nodes, isRoot = true) {
  function flattenNodes(nodes) {
    let result = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenNodes(node.children));
      }
    }
    return result;
  }

  const allNodes = flattenNodes(nodes);

  // Improved detection logic
  const hasTable = detectTable(allNodes) !== null;
  const hasNotificationForm = detectNotificationForm(allNodes);
  
  // Determine the primary content type based on what we detect
  let primaryContentType = 'unknown';
  if (hasTable) {
    primaryContentType = 'table';
  } else if (hasNotificationForm) {
    primaryContentType = 'notification';
  }
  
  // Use the detected content type to influence form type detection
  let formType = primaryContentType === 'notification' ? 'notification' : 
                 primaryContentType === 'table' ? 'users' : 
                 detectFormType(allNodes);

  // Detect layout components
  const hasSidebar = detectSidebar(allNodes);
  const tabs = detectTabs(allNodes);
  const searchInput = detectSearchInput(allNodes);
  const tableNode = detectTable(allNodes);

  let html = '';

  // Start with proper Bootstrap container structure
  if (hasSidebar) {
    // Create a container-fluid for full-width layout with sidebar
    html += `<div class="container-fluid p-0">\n`;
    html += `  <div class="row g-0">\n`;

    // Add the sidebar as the first column
    html += generateSidebar(allNodes, formType);

    // Start the main content column
    html += `    <div class="col p-4">\n`;
  } else {
    // For login forms or other centered content without sidebar
    html += `<div class="container d-flex justify-content-center align-items-center" style="min-height: 100vh;">\n`;
    html += `  <div class="col-md-6">\n`;
  }

  // Page title
  const titleNode = allNodes.find(
    n => n.type === 'TEXT' &&
         n.characters &&
         n.characters.length < 30 &&
         (/users|add event|login/i.test(n.characters))
  );

  if (titleNode) {
    if (formType === 'login') {
      html += `<h2 class="text-center mb-4">${titleNode.characters}</h2>\n`;
    } else {
      html += `<h2 class="fw-bold mb-4">${titleNode.characters}</h2>\n`;
    }
  }

  // Tabs (if present)
  if (tabs.length > 1) {
    html += `<ul class="nav nav-tabs mb-4">\n`;
    tabs.forEach((tab, idx) => {
      html += `  <li class="nav-item"><a class="nav-link${idx === 0 ? ' active' : ''}" href="#">${tab.characters}</a></li>\n`;
    });
    html += `</ul>\n`;
  }

  // Search input (if present)
  if (searchInput && formType !== 'login') {
    html += `<div class="d-flex justify-content-end mb-3">
      <form class="d-flex" role="search">
        <input class="form-control me-2" type="search" placeholder="Search" aria-label="Search">
        <button class="btn btn-outline-primary" type="submit">Search</button>
      </form>
    </div>\n`;
  }

  // For event form, wrap fields in a card
  if (formType === 'event') {
    html += `<div class="card mb-4">\n`;
    html += `  <div class="card-body">\n`;
  }

  // For login form, add form with shadow
  if (formType === 'login') {
    html += `<div class="card shadow-sm">\n`;
    html += `  <div class="card-body p-4">\n`;
  }

  // Table (if present)
  if (tableNode && formType !== 'login') {
    // Extract headers
    const headerRow = tableNode.children.filter(
      child =>
        child.type === 'TEXT' &&
        /no\.|profile photo|name|email|registered on|action/i.test(child.characters)
    );

    // Extract data rows
    const dataRows = [];
    let currentRow = [];
    tableNode.children.forEach(child => {
      if (
        child.type === 'TEXT' &&
        !/no\.|profile photo|name|email|registered on|action/i.test(child.characters)
      ) {
        currentRow.push(child.characters);
        if (currentRow.length === headerRow.length) {
          dataRows.push([...currentRow]);
          currentRow = [];
        }
      }
    });

    html += `<div class="card mb-4">\n`;
    html += `  <div class="card-body p-0">\n`;
    html += `    <div class="table-responsive">\n`;
    html += `      <table class="table table-hover align-middle mb-0">\n`;
    html += `        <thead class="bg-light">\n`;
    html += `          <tr>\n`;
    html += `            ${headerRow.map(h => `<th class="px-4 py-3">${h.characters}</th>`).join('\n')}\n`;
    html += `          </tr>\n`;
    html += `        </thead>\n`;
    html += `        <tbody>\n`;

    // If we have actual data rows, use them
    if (dataRows.length > 0) {
      html += `          ${dataRows
        .map(row => `<tr>${row.map(cell => `<td class="px-4 py-3">${cell}</td>`).join('')}</tr>`)
        .join('\n')}\n`;
    } else {
      // Otherwise generate sample data
      html += `          <tr>
            <td class="px-4 py-3">01</td>
            <td class="px-4 py-3"><img src="https://via.placeholder.com/32" class="rounded-circle" alt="Profile"></td>
            <td class="px-4 py-3">David Wagner</td>
            <td class="px-4 py-3">mail@mail.com</td>
            <td class="px-4 py-3">MM/DD/YYYY</td>
            <td class="px-4 py-3"><button class="btn btn-sm btn-light rounded-circle"><i class="bi bi-arrow-repeat"></i></button></td>
          </tr>\n`;
    }

    html += `        </tbody>\n`;
    html += `      </table>\n`;
    html += `    </div>\n`;

    // Pagination
    html += `    <nav aria-label="Table navigation" class="d-flex justify-content-between align-items-center p-3 border-top">\n`;
    html += `      <div>Items per page: <select class="form-select form-select-sm d-inline-block w-auto"><option>10</option></select></div>\n`;
    html += `      <ul class="pagination pagination-sm mb-0">\n`;
    html += `        <li class="page-item disabled"><a class="page-link" href="#">Previous</a></li>\n`;
    html += `        <li class="page-item active"><a class="page-link" href="#">1</a></li>\n`;
    html += `        <li class="page-item"><a class="page-link" href="#">2</a></li>\n`;
    html += `        <li class="page-item"><a class="page-link" href="#">Next</a></li>\n`;
    html += `      </ul>\n`;
    html += `    </nav>\n`;
    html += `  </div>\n`;
    html += `</div>\n`;
  }

  // Form fields - only show if we don't have a table or if we explicitly detected a form
  if ((formType === 'login' || formType === 'event' || formType === 'notification') && 
      (primaryContentType !== 'table' || primaryContentType === 'notification')) {
    html += `<form>\n`;

    // Detect form fields
    const formFields = detectFormFields(allNodes, formType);

    // Generate form fields HTML
    formFields.forEach(field => {
      const { label, type, required, options } = field;

      html += `  <div class="mb-3">\n`;
      html += `    <label class="form-label">${label}${required ? '<span class="text-danger">*</span>' : ''}</label>\n`;

      if (type === 'textarea') {
        html += `    <textarea class="form-control" placeholder="Type text here" rows="3"></textarea>\n`;
      } else if (type === 'select') {
        html += `    <select class="form-select">\n`;
        html += `      <option selected disabled>Select ${label.toLowerCase()}</option>\n`;
        if (options && options.length) {
          options.forEach(opt => {
            html += `      <option>${opt}</option>\n`;
          });
        }
        html += `    </select>\n`;
      } else if (type === 'radio') {
        html += `    <div>\n`;
        if (options && options.length) {
          options.forEach((opt, idx) => {
            html += `      <div class="form-check form-check-inline">\n`;
            html += `        <input class="form-check-input" type="radio" name="${label.toLowerCase().replace(/\s+/g, '_')}" id="${label.toLowerCase().replace(/\s+/g, '_')}_${idx}" ${idx === 0 ? 'checked' : ''}>\n`;
            html += `        <label class="form-check-label" for="${label.toLowerCase().replace(/\s+/g, '_')}_${idx}">${opt}</label>\n`;
            html += `      </div>\n`;
          });
        } else {
          html += `      <div class="form-check form-check-inline">\n`;
          html += `        <input class="form-check-input" type="radio" name="${label.toLowerCase().replace(/\s+/g, '_')}" id="${label.toLowerCase().replace(/\s+/g, '_')}_1" checked>\n`;
          html += `        <label class="form-check-label" for="${label.toLowerCase().replace(/\s+/g, '_')}_1">Active</label>\n`;
          html += `      </div>\n`;
          html += `      <div class="form-check form-check-inline">\n`;
          html += `        <input class="form-check-input" type="radio" name="${label.toLowerCase().replace(/\s+/g, '_')}" id="${label.toLowerCase().replace(/\s+/g, '_')}_2">\n`;
          html += `        <label class="form-check-label" for="${label.toLowerCase().replace(/\s+/g, '_')}_2">Inactive</label>\n`;
          html += `      </div>\n`;
        }
        html += `    </div>\n`;
      } else if (type === 'checkbox') {
        html += `    <div class="form-check">\n`;
        html += `      <input class="form-check-input" type="checkbox" id="${label.toLowerCase().replace(/\s+/g, '_')}">\n`;
        html += `      <label class="form-check-label" for="${label.toLowerCase().replace(/\s+/g, '_')}">${label}</label>\n`;
        html += `    </div>\n`;
      } else if (type === 'date') {
        html += `    <div class="input-group">\n`;
        html += `      <input type="date" class="form-control">\n`;
        html += `      <span class="input-group-text"><i class="bi bi-calendar"></i></span>\n`;
        html += `    </div>\n`;
      } else if (type === 'time') {
        html += `    <div class="input-group">\n`;
        html += `      <input type="time" class="form-control">\n`;
        html += `      <span class="input-group-text"><i class="bi bi-clock"></i></span>\n`;
        html += `    </div>\n`;
      } else if (type === 'file' || type === 'image') {
        html += `    <div class="text-center p-3 border rounded bg-light mb-2">\n`;
        html += `      <i class="bi bi-upload fs-3 d-block mb-2"></i>\n`;
        html += `      <button type="button" class="btn btn-sm btn-primary">Upload</button>\n`;
        html += `    </div>\n`;
      } else {
        html += `    <input type="${type}" class="form-control" placeholder="${getPlaceholder(type, label)}">\n`;
      }

      html += `  </div>\n`;
    });

    // Add Remember me checkbox for login form
    if (formType === 'login') {
      html += `  <div class="form-check mb-3">\n`;
      html += `    <input class="form-check-input" type="checkbox" id="rememberMe">\n`;
      html += `    <label class="form-check-label" for="rememberMe">Remember me</label>\n`;
      html += `  </div>\n`;
    }

    // Add buttons
    if (formType === 'login') {
      html += `  <div class="d-grid gap-2">\n`;
      html += `    <button type="submit" class="btn btn-primary py-2">Login</button>\n`;
      html += `  </div>\n`;
      html += `  <div class="text-center mt-3">\n`;
      html += `    <a href="#" class="text-decoration-none">Forgot Password?</a>\n`;
      html += `  </div>\n`;
    } else if (formType === 'event') {
      html += `  <div class="d-flex gap-2 mt-4">\n`;
      html += `    <button type="submit" class="btn btn-primary">Save</button>\n`;
      html += `    <button type="button" class="btn btn-light">Cancel</button>\n`;
      html += `  </div>\n`;
    } else {
      html += `  <div class="d-flex gap-2 mt-4">\n`;
      html += `    <button type="submit" class="btn btn-primary">Submit</button>\n`;
      html += `    <button type="button" class="btn btn-light">Cancel</button>\n`;
      html += `  </div>\n`;
    }

    html += `</form>\n`;
  }

  // Close card for event form or login form
  if (formType === 'event' || formType === 'login') {
    html += `  </div>\n`;
    html += `</div>\n`;
  }

  // Close containers
  if (hasSidebar) {
    html += `    </div>\n`;  // Close col
    html += `  </div>\n`;    // Close row
    html += `</div>\n`;      // Close container-fluid
  } else {
    html += `  </div>\n`;    // Close col-md-6
    html += `</div>\n`;      // Close container
  }

  return html;
}

// Helper function to detect form fields based on form type
function detectFormFields(nodes, formType) {
  const fields = [];

  if (formType === 'login') {
    fields.push({ label: 'Email Address', type: 'email', required: true });
    fields.push({ label: 'Password', type: 'password', required: true });
    return fields;
  }

  if (formType === 'event') {
    fields.push({ label: 'Event Name', type: 'text', required: true });
    fields.push({ label: 'Event Date', type: 'date', required: true });
    fields.push({ label: 'Event Time', type: 'time', required: true });
    fields.push({ label: 'Payment Link', type: 'text', required: true });
    fields.push({ label: 'Region', type: 'select', required: true, options: ['North', 'South', 'East', 'West'] });
    fields.push({ label: 'Status', type: 'radio', required: true, options: ['Active', 'Inactive'] });
    fields.push({ label: 'Location', type: 'text', required: true });
    fields.push({ label: 'Event Image', type: 'file', required: false });
    return fields;
  }

  if (formType === 'notification') {
    fields.push({ label: 'Notification Text', type: 'textarea', required: true });
    fields.push({ label: 'Notification Type', type: 'radio', required: true, options: ['Now', 'Schedule'] });
    return fields;
  }

  // Default: try to detect fields from nodes
  const textNodes = nodes.filter(n => n.type === 'TEXT' && n.characters);

  textNodes.forEach(node => {
    const text = node.characters;
    if (/name|email|password|link|text|time|date|status|location|region/i.test(text) && text.length < 30) {
      const type = getInputTypeFromLabel(text);
      fields.push({
        label: text.replace('*', '').trim(),
        type: type,
        required: text.includes('*')
      });
    }
  });

  return fields;
}

// Helper function to get placeholder text based on input type and label
function getPlaceholder(type, label) {
  const labelLower = label.toLowerCase();

  if (type === 'email') return 'Enter email address';
  if (type === 'password') return 'Enter password';
  if (type === 'text') {
    if (labelLower.includes('name')) return 'Enter name';
    if (labelLower.includes('link')) return 'Add payment link here';
    if (labelLower.includes('location')) return 'Type address here';
    return 'Type text here';
  }

  return '';
}

// Helper function to determine input type from label
function getInputTypeFromLabel(label) {
  const labelLower = label.toLowerCase();

  if (labelLower.includes('email')) return 'email';
  if (labelLower.includes('password')) return 'password';
  if (labelLower.includes('date')) return 'date';
  if (labelLower.includes('time')) return 'time';
  if (labelLower.includes('image') || labelLower.includes('photo')) return 'file';
  if (labelLower.includes('status')) return 'radio';
  if (labelLower.includes('region') || labelLower.includes('select')) return 'select';
  if (labelLower.includes('text') && labelLower.includes('notification')) return 'textarea';
  if (labelLower.includes('remember')) return 'checkbox';

  return 'text';
}


// Add this function after the existing functions but before generateHtmlFromNodes
function generateSidebar(nodes, formType) {
  // Find logo for sidebar
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
    .sort((a, b) => a.absoluteBoundingBox.y - b.absoluteBoundingBox.y);

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
