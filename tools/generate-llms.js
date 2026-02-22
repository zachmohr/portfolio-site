#!/usr/bin/env node
// generate-llms.js
// Run from project root: node tools/generate-llms.js
// Regenerates llms-full.txt from data/projects.json
// llms.txt is hand-authored — edit it directly for bio/contact changes

const fs = require('fs');
const path = require('path');

const projectsPath = path.join(__dirname, '../data/projects.json');
const outputPath = path.join(__dirname, '../llms-full.txt');

const data = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function formatDate(dateStr) {
    const [year, month] = dateStr.split('-');
    return `${MONTHS[parseInt(month) - 1]} ${year}`;
}

function categoryLabel(id, categories) {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.label : id;
}

// Sort projects by date
const sorted = [...data.projects].sort((a, b) => a.date.localeCompare(b.date));

let out = `# Zach Mohr — Full Portfolio Reference

> This document is intended for AI agents and LLMs. It contains complete descriptions of all projects on zachmohr.work. For a summary version see /llms.txt.
> Generated: ${new Date().toISOString().split('T')[0]}

## Person
- Name: Zach Mohr
- Site: https://zachmohr.work
- Email: zach@zachmohr.work
- Status: Passively open to opportunities
- Target roles: Mechanical Engineering, Manufacturing Engineering, Product Design, Outdoor/Adventure Industry
- Willing to relocate: Yes, anywhere

## Education
- MS Innovation Design — Wichita State University, graduating May 2025
- BS Mechanical Engineering, Minor: Business/Entrepreneurship — South Dakota School of Mines & Technology, graduated 2023

## Skills & Capabilities
Engineering: Mechanical design, FEA/forming simulation (Altair HyperForm), FMEA, standard work documentation, manufacturing process engineering, lean line balancing, time study, DFM
Fabrication: MIG/TIG welding, brazing, blacksmithing, lathe operation, woodworking, joinery, epoxy techniques, jig building
Design: Original furniture design, product design, CAD, graphic design, brand identity, packaging design, photography direction

---

## Projects

`;

for (const project of sorted) {
    out += `### ${project.title}\n`;
    out += `- Date: ${formatDate(project.date)}\n`;
    out += `- Category: ${categoryLabel(project.category, data.categories)}\n`;
    out += `- Tags: ${project.tags.join(', ')}\n`;
    out += `- URL: https://zachmohr.work/projects.html#${project.id}\n`;
    out += `- Description: ${project.description}\n`;
    out += '\n---\n\n';
}

out += `## Themes & Connections
- **Brazed joinery technique**: Originated in the Napkin Holder (2020), scaled to the Claro Walnut Coffee Table, refined into the Arachno series (Coffee Table, Side Table), conceptually extended to a full furniture line in CAD
- **Sketch-to-build**: Console Table, Memorial Flag Box — designed entirely in the build, no CAD
- **Epoxy techniques**: Black Epoxy Set, Pub Table, Arachno Coffee Table, Walnut Cookie Slab Set
- **Lathe work**: Custom feet on Arachno Coffee Table and Side Table, turned from slab offcuts
- **Client work**: Console Table, Pub Table, Walnut Cookie Slab Set
- **Engineering internships**: Bobcat (manufacturing), aerospace company (hydroforming simulation)
- **First-principles problem solving**: Autonomous RC Boat (reinvented phased-array radar logic independently), Slab Mirror (structural load path design)
`;

fs.writeFileSync(outputPath, out);
console.log(`✓ llms-full.txt regenerated — ${sorted.length} projects`);
