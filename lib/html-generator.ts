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
  return nodes.find(
    n =>
      n.type === 'FRAME' &&
      n.children &&
      n.children.some(
        child =>
          child.type === 'TEXT' &&
          /no\.|profile photo|name|email|registered on|action/i.test(child.characters)
      ) &&
      n.children.length > 5
  );
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

  const hasSidebar = detectSidebar(allNodes);
  const tabs = detectTabs(allNodes);
  const searchInput = detectSearchInput(allNodes);
  const tableNode = detectTable(allNodes);

  let html = '';

  if (hasSidebar) {
    html += generateSidebar(allNodes, 'users');
    html += `<div class="container-fluid"><div class="row"><div class="col p-4">\n`;
  }

  const titleNode = allNodes.find(
    n => n.type === 'TEXT' && n.characters && n.characters.length < 30 && /users/i.test(n.characters)
  );
  if (titleNode) {
    html += `<h2 class="fw-bold mb-4">${titleNode.characters}</h2>\n`;
  }

  if (tabs.length > 1) {
    html += `<ul class="nav nav-tabs mb-3">\n`;
    tabs.forEach((tab, idx) => {
      html += `<li class="nav-item"><a class="nav-link${idx === 0 ? ' active' : ''}" href="#">${tab.characters}</a></li>\n`;
    });
    html += `</ul>\n`;
  }

  if (searchInput) {
    html += `<form class="d-flex mb-3" role="search">
      <input class="form-control me-2" type="search" placeholder="Search" aria-label="Search">
      <button class="btn btn-outline-success" type="submit">Search</button>
    </form>\n`;
  }

  if (tableNode) {
    const headerRow = tableNode.children.filter(
      child =>
        child.type === 'TEXT' &&
        /no\.|profile photo|name|email|registered on|action/i.test(child.characters)
    );
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

    html += `<div class="table-responsive"><table class="table align-middle">
      <thead>
        <tr>
          ${headerRow.map(h => `<th>${h.characters}</th>`).join('\n')}
        </tr>
      </thead>
      <tbody>
        ${dataRows
          .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
          .join('\n')}
      </tbody>
    </table></div>\n`;
  }

  // FORM (for notification text, etc.)
  const inputFields = allNodes.filter(
    n =>
      (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.width > 100 &&
      n.absoluteBoundingBox.height >= 30 &&
      n.absoluteBoundingBox.height <= 60
  );
  inputFields.forEach(inputField => {
    const label = allNodes.find(
      n =>
        n.type === 'TEXT' &&
        n.absoluteBoundingBox &&
        Math.abs(n.absoluteBoundingBox.x - inputField.absoluteBoundingBox.x) < 100 &&
        n.absoluteBoundingBox.y < inputField.absoluteBoundingBox.y &&
        n.absoluteBoundingBox.y > inputField.absoluteBoundingBox.y - 50
    );
    if (!label) return;
    const labelText = label.characters;
    const isRequired = labelText.includes('*');
    const cleanLabelText = labelText.replace('*', '').trim();
    html += `<div class="mb-3">
      <label class="form-label">${cleanLabelText}${isRequired ? '<span class="text-danger">*</span>' : ''}</label>
      <textarea class="form-control" placeholder="Type text here"></textarea>
    </div>\n`;
  });

  // CLOSE CONTAINERS
  if (hasSidebar) {
    html += `</div></div></div>\n`;
  }

  return html;
}

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
        n.absoluteBoundingBox.x < 200 &&
        n.characters &&
        n.characters.length < 30 &&
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
      { text: 'Users', icon: 'bi-people', active: formType === 'login' },
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
        (formType === 'login' && itemTextLower.includes('user'))

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
