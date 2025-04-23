import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { isSubmitButton } from './figma-node-helpers'

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

export function detectFormType(nodes, containerName = '') {
  // Check container name first
  if (/login|signin|log in/i.test(containerName)) {
    return 'login'
  }
  if (/notification|push/i.test(containerName)) {
    return 'notification'
  }

  // If name doesn't give us enough info, check content
  const hasPasswordField = nodes.some(
    (n) => n.type === 'TEXT' && /password/i.test(n.characters || '')
  )

  const hasEmailField = nodes.some(
    (n) => n.type === 'TEXT' && /email/i.test(n.characters || '')
  )

  const hasLoginButton = nodes.some(
    (n) => n.type === 'TEXT' && /login|sign in/i.test(n.characters || '')
  )

  const hasNotificationField = nodes.some(
    (n) => n.type === 'TEXT' && /notification|push/i.test(n.characters || '')
  )

  if (hasPasswordField && (hasEmailField || hasLoginButton)) {
    return 'login'
  } else if (hasNotificationField) {
    return 'notification'
  }

  return 'generic'
}

export function detectSidebar(nodes) {
  // Look for a narrow frame on the left side
  const sidebarFrame = nodes.find(
    (n) =>
      (n.type === 'FRAME' || n.type === 'RECTANGLE') &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.width < 200 &&
      n.absoluteBoundingBox.height > 400 &&
      n.absoluteBoundingBox.x < 200
  )

  // Or look for a vertical list of menu items
  const menuItems = nodes.filter(
    (n) =>
      n.type === 'TEXT' &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.x < 200 &&
      n.characters &&
      n.characters.length < 30
  )

  // If we have multiple menu items stacked vertically, it's likely a sidebar
  const hasVerticalMenu =
    menuItems.length >= 3 &&
    menuItems.every(
      (item, i) =>
        i === 0 ||
        item.absoluteBoundingBox.y >
          menuItems[i - 1].absoluteBoundingBox.y +
            menuItems[i - 1].absoluteBoundingBox.height
    )

  // Also check for common sidebar menu items

  const hasSidebarMenuItems = nodes.some(
    (n) =>
      n.type === 'TEXT' &&
      n.characters &&
      /dashboard|users|settings|notifications|profile|logout|menu/i.test(
        n.characters
      )
  )

  return !!sidebarFrame || hasVerticalMenu || hasSidebarMenuItems
}
// export function detectSidebar(nodes) {
//   return nodes.some(
//     n =>
//       n.absoluteBoundingBox &&
//       n.absoluteBoundingBox.x < 50 &&
//       n.absoluteBoundingBox.width < 300 &&
//       n.type === 'FRAME' &&
//       n.children &&
//       n.children.filter(child => child.type === 'TEXT').length >= 3
//   );
// }

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

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}
