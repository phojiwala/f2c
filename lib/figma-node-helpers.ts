export const isInputPlaceholder = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return (
    /enter|type|your|e\.g\./.test(text) && !/\*$/.test(node.characters || '')
  )
}

export const isLabel = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return (
    /email|password|confirm|name|username|subject|message|phone/.test(text) &&
    /\*$/.test(node.characters || '')
  )
}

export const isSubmitButton = (node) => {
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

export const isCheckboxLabel = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return /remember|agree|subscribe|i accept|keep me logged in/.test(text)
}

export const isLink = (node) => {
  if (node.type !== 'TEXT') return false
  const text = node.characters?.toLowerCase() || ''
  return /forgot|reset|privacy|terms|learn more|click here|need help/.test(text)
}

export const isTitle = (node) => {
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

export function findTitleNode(nodes) {
  const styledTitle = nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.style &&
      (n.style.fontSize >= 20 ||
        (n.style.fontSize >= 16 && n.style.fontWeight >= 600)) &&
      n.characters.length < 50 &&
      !isSubmitButton(n)
  )

  if (styledTitle) return styledTitle

  // If no styled title found, look for text that might be a title based on content
  return nodes.find(
    (n) =>
      n.type === 'TEXT' &&
      n.characters &&
      /add|create|new|edit|update|manage/i.test(n.characters) &&
      /notification|push|alert|message/i.test(n.characters) &&
      n.characters.length < 50
  )
}

export function findLogoNode(nodes) {
  let logo = nodes.find((n) => n.name && /logo/i.test(n.name) && (
    (n.type === 'RECTANGLE' || n.type === 'FRAME' || n.type === 'COMPONENT') &&
    n.fills && Array.isArray(n.fills) && n.fills.some((fill) => fill.type === 'IMAGE')
  ) ||
    n.type === 'IMAGE');

  if (logo) return logo;

  logo = nodes.find((n) =>
    (n.type === 'RECTANGLE' || n.type === 'FRAME' || n.type === 'COMPONENT') &&
    n.fills && Array.isArray(n.fills) && n.fills.some((fill) => fill.type === 'IMAGE') &&
    n.absoluteBoundingBox && n.absoluteBoundingBox.y < 200
  );

  return logo;
} 

export function findInputCandidates(nodes) {
  return nodes.filter(
    (node) =>
      (node.type === 'RECTANGLE' || node.type === 'FRAME') &&
      (node.name?.toLowerCase().includes('input') ||
        node.name?.toLowerCase().includes('field') ||
        node.name?.toLowerCase().includes('email') ||
        node.name?.toLowerCase().includes('password') ||
        node.name?.toLowerCase().includes('search'))
  )
}
