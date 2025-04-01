import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { fileKey } = await request.json();
    const accessToken = request.headers.get('X-Figma-Token');

    if (!fileKey || !accessToken) {
      return NextResponse.json(
        { error: 'File key and access token are required' },
        { status: 400 }
      );
    }

    // Fetch Figma file data
    const response = await axios.get(
      `https://api.figma.com/v1/files/${fileKey}`,
      {
        headers: { 'X-Figma-Token': accessToken }
      }
    );

    // Extract components
    const components = extractComponents(response.data);

    // Generate component code
    const generatedComponents = components.map(generateReactComponent);

    return NextResponse.json({
      success: true,
      components: generatedComponents,
      rawData: response.data
    });
  } catch (error) {
    console.error('Figma API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Figma data' },
      { status: 500 }
    );
  }
}

function extractComponents(figmaData: any) {
  const components: any[] = [];

  function traverse(node: any) {
    if (node.type === 'FRAME' || node.type === 'COMPONENT') {
      components.push({
        name: node.name.replace(/\s+/g, ''),
        type: node.type,
        styles: node.styles || {},
        children: node.children ? node.children.map((child: any) => child.id) : []
      });
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(figmaData.document);
  return components;
}

function generateReactComponent(component: any) {
  return {
    name: component.name,
    code: `import React from 'react';

const ${component.name} = () => {
  return (
    <div className="${component.name.toLowerCase()}">
      <h2>${component.name}</h2>
    </div>
  );
};

export default ${component.name};`
  };
}