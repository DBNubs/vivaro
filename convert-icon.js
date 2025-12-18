const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'vivaro-icon-final.svg');
const pngPath = path.join(__dirname, 'icon.png');
const publicDir = path.join(__dirname, 'public');

// Read the SVG file
const svg = fs.readFileSync(svgPath, 'utf8');

// Convert SVG to PNG at 1024x1024 for electron-icon-builder
const resvg = new Resvg(svg, {
  background: 'transparent',
  fitTo: {
    mode: 'width',
    value: 1024,
  },
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

// Write the PNG file
fs.writeFileSync(pngPath, pngBuffer);

console.log(`✓ Converted ${svgPath} to ${pngPath} (1024x1024)`);

// Also generate web icons for public folder
const sizes = [64, 128, 192, 512];
sizes.forEach(size => {
  const resvg = new Resvg(svg, {
    background: 'transparent',
    fitTo: {
      mode: 'width',
      value: size,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const outputPath = path.join(publicDir, `logo${size}.png`);
  fs.writeFileSync(outputPath, pngBuffer);
  console.log(`✓ Generated ${outputPath} (${size}x${size})`);
});

