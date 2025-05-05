import { isSubmitButton } from './figma-node-helpers';
// Remove this import to avoid circular dependency
// import { generateNodeClassName } from './html-generator';

// Define the function locally to avoid circular dependency
function generateNodeClassName(node) {
  if (!node || !node.id) return '';
  return `figma-${node.type.toLowerCase()}-${node.id.replace(/[:;]/g, '-')}`;
}

export function generateLoginForm(nodes, classNameFn = generateNodeClassName) {
  // Use the passed function or fallback to local implementation
  const getClassName = classNameFn || generateNodeClassName;

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

  // Generate class names for styling
  const emailLabelClass = emailLabel ? getClassName(emailLabel) : '';
  const passwordLabelClass = passwordLabel ? getClassName(passwordLabel) : '';
  const emailInputClass = emailFrame ? getClassName(emailFrame) : '';
  const passwordInputClass = passwordFrame ? getClassName(passwordFrame) : '';
  const buttonClass = loginButton ? getClassName(loginButton) : '';
  const forgotLinkClass = forgotLink ? getClassName(forgotLink) : '';
  const checkboxLabelClass = checkboxLabel ? getClassName(checkboxLabel) : '';

  // Email field
  html += `  <div class="mb-3">\n`;
  html += `    <label for="email" class="form-label ${emailLabelClass}">${emailLabel?.characters || 'Email Address*'}</label>\n`;
  html += `    <input type="email" class="form-control ${emailInputClass}" id="email" placeholder="${emailPlaceholder}">\n`;
  html += `  </div>\n`;

  // Password field with eye icon (no input-group)
  html += `  <div class="mb-3">\n`;
  html += `    <label for="password" class="form-label ${passwordLabelClass}">${passwordLabel?.characters || 'Password*'}</label>\n`;
  html += `    <div style="position:relative;">\n`;
  html += `      <input type="password" class="form-control ${passwordInputClass}" id="password" placeholder="${passwordPlaceholder}" style="padding-right: 2.5rem;">\n`;
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

export function generateEventForm(nodes, classNameFn = generateNodeClassName) {
  const getClassName = classNameFn || generateNodeClassName;

  // Find relevant nodes
  const eventNameLabel = nodes.find(
    (n) => n.type === 'TEXT' && /event\s*name/i.test(n.characters || '')
  );
  const eventDateLabel = nodes.find(
    (n) => n.type === 'TEXT' && /event\s*date/i.test(n.characters || '')
  );
  const descriptionLabel = nodes.find(
    (n) => n.type === 'TEXT' && /description/i.test(n.characters || '')
  );

  // Generate class names
  const eventNameLabelClass = eventNameLabel ? getClassName(eventNameLabel) : '';
  const eventDateLabelClass = eventDateLabel ? getClassName(eventDateLabel) : '';
  const descriptionLabelClass = descriptionLabel ? getClassName(descriptionLabel) : '';

  let html = '';
  html += `<form>\n`;
  html += `  <div class="mb-3">\n`;
  html += `    <label for="eventName" class="form-label ${eventNameLabelClass}">Event Name</label>\n`;
  html += `    <input type="text" class="form-control" id="eventName">\n`;
  html += `  </div>\n`;

  // ... rest of your form with classes applied ...
}

export function generateNotificationForm(nodes) {
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

export function generateSidebar(nodes, formType) {
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

export function generateForgotPasswordForm(nodes, generateNodeClassName = (node) => '') {
  // Find relevant nodes
  const emailLabel = nodes.find(
    (n) => n.type === 'TEXT' && /email|username/i.test(n.characters)
  );

  const emailFrame = nodes.find(
    (n) => (n.type === 'RECTANGLE' || n.type === 'FRAME') && n.name?.toLowerCase().includes('email')
  );

  const submitButton = nodes.find(
    (n) => (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
    (n.name?.toLowerCase().includes('submit') ||
     n.name?.toLowerCase().includes('send') ||
     n.name?.toLowerCase().includes('recover'))
  );

  const backToLoginLink = nodes.find(
    (n) => n.type === 'TEXT' && /back|login/i.test(n.characters)
  );

  const descriptionText = nodes.find(
    (n) => n.type === 'TEXT' &&
    /enter your email|send you a link|reset your password/i.test(n.characters) &&
    n.characters.length > 15
  );

  // Generate class names
  const emailLabelClass = emailLabel ? generateNodeClassName(emailLabel) : '';
  const emailInputClass = emailFrame ? generateNodeClassName(emailFrame) : '';
  const buttonClass = submitButton ? generateNodeClassName(submitButton) : '';
  const linkClass = backToLoginLink ? generateNodeClassName(backToLoginLink) : '';
  const descriptionClass = descriptionText ? generateNodeClassName(descriptionText) : '';

  // Find button text if available
  const buttonTextNode = submitButton?.children?.find(c => c.type === 'TEXT');
  const buttonText = buttonTextNode?.characters || 'Send Recovery Email';

  // Extract placeholder
  const emailPlaceholderNode = nodes.find(n =>
    n.type === 'TEXT' && /enter|your email|example@/i.test(n.characters)
  );
  const emailPlaceholder = emailPlaceholderNode?.characters || 'Enter email address';

  let html = '';
  html += `<form>\n`;

  // Add description text if found
  if (descriptionText) {
    html += `  <p class="text-center mb-4 ${descriptionClass}">${descriptionText.characters}</p>\n`;
  } else {
    html += `  <p class="text-center mb-4">Enter your email address and we will send you a link to reset your password.</p>\n`;
  }

  // Email field
  html += `  <div class="mb-4">\n`;
  html += `    <label for="email" class="form-label ${emailLabelClass}">${emailLabel?.characters || 'Email Address*'}</label>\n`;
  html += `    <input type="email" class="form-control ${emailInputClass}" id="email" placeholder="${emailPlaceholder}">\n`;
  html += `  </div>\n`;

  // Submit button - use primary color with proper styling
  html += `  <button type="submit" class="btn btn-primary w-100 mb-3 ${buttonClass}">${buttonText}</button>\n`;

  // Back to login link
  if (backToLoginLink) {
    html += `  <div class="text-center mt-3">\n`;
    html += `    <a href="#" class="text-decoration-none ${linkClass}">${backToLoginLink.characters}</a>\n`;
    html += `  </div>\n`;
  } else {
    html += `  <div class="text-center mt-3">\n`;
    html += `    <a href="#" class="text-decoration-none">Back to Login</a>\n`;
    html += `  </div>\n`;
  }

  html += `</form>\n`;

  return html;
}

export function generateChangePasswordForm(nodes) {
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