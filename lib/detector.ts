export function detectBootstrapComponent(node) {
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

export function detectTabs(nodes) {
  const tabCandidates = nodes.filter(
    (n) =>
      n.type === 'TEXT' &&
      n.absoluteBoundingBox &&
      n.absoluteBoundingBox.y < 200 &&
      n.characters.length < 15
  )
  if (tabCandidates.length >= 2) {
    const yVals = tabCandidates.map((n) => n.absoluteBoundingBox.y)
    const ySpread = Math.max(...yVals) - Math.min(...yVals)
    if (ySpread < 40) return tabCandidates
  }
  return []
}

export function detectSearchInput(nodes) {
  return (
    nodes.find(
      (n) =>
        (n.type === 'RECTANGLE' || n.type === 'FRAME') &&
        n.absoluteBoundingBox &&
        n.absoluteBoundingBox.width > 200 &&
        (n.absoluteBoundingBox.y < 150 ||
          // Look for search text
          (n.children &&
            n.children.some(
              (child) =>
                child.type === 'TEXT' && /search/i.test(child.characters || '')
            )))
    ) ||
    // Also look for a search icon or text
    nodes.find((n) => n.type === 'TEXT' && /search/i.test(n.characters || ''))
  )
}

export function detectTable(nodes) {
  // Look for table frames with header-like text
  const tableFrames = nodes.filter(
    (n) =>
      (n.type === 'FRAME' || n.type === 'GROUP') &&
      n.children &&
      n.children.length > 5 &&
      n.children.some(
        (child) =>
          child.type === 'TEXT' &&
          /no\.|profile|photo|name|email|registered|action/i.test(
            child.characters
          )
      )
  )

  // If we found potential tables, return the one with the most children
  if (tableFrames.length > 0) {
    return tableFrames.sort(
      (a, b) => (b.children?.length || 0) - (a.children?.length || 0)
    )[0]
  }

  // Fallback: look for a collection of text nodes that might form a table
  const headerTexts = nodes.filter(
    (n) =>
      n.type === 'TEXT' &&
      /no\.|profile|photo|name|email|registered|action/i.test(n.characters)
  )

  if (headerTexts.length >= 3) {
    // Find the parent that contains these headers
    const parents = nodes.filter(
      (n) =>
        n.children &&
        n.children.some((child) =>
          headerTexts.some((header) => header.id === child.id)
        )
    )

    if (parents.length > 0) {
      return parents[0]
    }
  }

  return null
}

export function detectNotificationForm(nodes) {
  const notificationTextLabel = nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.characters &&
      /notification text/i.test(n.characters)
  )

  const notificationTypeLabel = nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.characters &&
      /notification type/i.test(n.characters)
  )

  return notificationTextLabel && notificationTypeLabel
}

export function detectLoginRelatedScreen(nodes) {
  return nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.characters &&
      /login|forgot password|change password|reset password/i.test(n.characters)
  )
}
