#!/usr/bin/env node
/**
 * Generate a knowledge-space.v1 graph from GSE descriptor data.
 *
 * Edge topology:
 *   - prerequisite_for: strictly lower score → higher score, same (age, skill).
 *     Each objective at score X samples 3–5 predecessors from scores X-4 to X-1,
 *     with probability and weight decaying by distance. At least 1 from X-1.
 *   - supports: complete directed mesh among objectives sharing the same
 *     (age_group, skill, gse_score). Captures co-competency / co-readiness.
 *   - contains / appears_in_context / aligned_to_standard: structural.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAIN = 'english.gse';
const SOURCE_REF_ADULT = 'pearson-gse-adult-2019';
const SOURCE_REF_YOUNG = 'pearson-gse-young-learners-2022';
const SOURCE_REF_DERIVED = 'derived-gse-structure';
const REVIEW_STATUS = 'draft';

const CEFR_SLUG_MAP = {
  'Below A1': 'below-a1',
  'A1': 'a1',
  'A2': 'a2',
  'A2(+)': 'a2-plus',
  'B1': 'b1',
  'B1(+)': 'b1-plus',
  'B2': 'b2',
  'B2(+)': 'b2-plus',
  'C1': 'c1',
  'C2': 'c2',
};

const SKILL_SLUG_MAP = {
  'Reading': 'reading',
  'Listening': 'listening',
  'Speaking': 'speaking',
  'Writing': 'writing',
};

const AGE_SLUG_MAP = {
  'Adult Learners': 'adult',
  'Young Learners': 'young',
};

// Prerequisite sampling parameters
const PREREQ_MIN = 3;
const PREREQ_MAX = 5;
const PREREQ_DISTANCE_MAX = 4; // look back X-4 to X-1
const PREREQ_WEIGHT_BASE = 0.9;
const PREREQ_WEIGHT_DECAY = 0.85;
const SUPPORTS_WEIGHT = 0.85;

// ---------------------------------------------------------------------------
// Deterministic seeded PRNG (xorshift32) for reproducible sampling
// ---------------------------------------------------------------------------

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function makeRng(seedStr) {
  let state = hashString(seedStr);
  return function () {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Weighted deterministic sampling without replacement
// ---------------------------------------------------------------------------

function weightedSample(items, weights, count, rng) {
  if (items.length === 0) return [];
  const n = Math.min(count, items.length);
  const pool = items.map((item, i) => ({ item, weight: weights[i], index: i }));
  const result = [];
  for (let pick = 0; pick < n; pick++) {
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    if (totalWeight <= 0) {
      // Fallback: uniform random
      const idx = Math.floor(rng() * pool.length);
      result.push(pool[idx].item);
      pool.splice(idx, 1);
      continue;
    }
    let threshold = rng() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      threshold -= pool[i].weight;
      if (threshold <= 0) {
        result.push(pool[i].item);
        pool.splice(i, 1);
        break;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Slug utilities
// ---------------------------------------------------------------------------

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .substring(0, 40)
    .replace(/-+$/, '');
}

function makeUniqueId(base, existing) {
  if (!existing.has(base)) return base;
  let i = 1;
  let candidate;
  do {
    candidate = `${base}.${i}`;
    i++;
  } while (existing.has(candidate));
  return candidate;
}

// ---------------------------------------------------------------------------
// Node factories
// ---------------------------------------------------------------------------

function createDomainNode() {
  return {
    id: `${DOMAIN}.domain`,
    kind: 'domain',
    title: 'Pearson Global Scale of English (GSE)',
    domain: DOMAIN,
    description: 'Comprehensive English language learning objectives across Adult and Young Learner frameworks.',
    sourceRefs: [SOURCE_REF_ADULT, SOURCE_REF_YOUNG],
    reviewStatus: REVIEW_STATUS,
    metadata: { framework: 'GSE', version: 'v1' },
  };
}

function createContentGroupNode(ageGroup, skill) {
  const ageSlug = AGE_SLUG_MAP[ageGroup];
  const skillSlug = SKILL_SLUG_MAP[skill];
  return {
    id: `${DOMAIN}.group.${ageSlug}.${skillSlug}`,
    kind: 'content_group',
    title: `${ageGroup} — ${skill}`,
    domain: DOMAIN,
    sourceRefs: [ageGroup === 'Adult Learners' ? SOURCE_REF_ADULT : SOURCE_REF_YOUNG],
    reviewStatus: REVIEW_STATUS,
    metadata: { ageGroup, skill, ageSlug, skillSlug },
  };
}

function createStandardNode(cefr) {
  const cefrSlug = CEFR_SLUG_MAP[cefr];
  return {
    id: `${DOMAIN}.standard.${cefrSlug}`,
    kind: 'standard',
    title: `CEFR ${cefr}`,
    domain: DOMAIN,
    sourceRefs: [SOURCE_REF_ADULT, SOURCE_REF_YOUNG],
    reviewStatus: REVIEW_STATUS,
    metadata: { framework: 'CEFR', level: cefr, cefrSlug },
  };
}

function createInstructionalUnitNode(group, index) {
  const ageSlug = AGE_SLUG_MAP[group.age_group];
  const skillSlug = SKILL_SLUG_MAP[group.skill];
  const cefrSlug = CEFR_SLUG_MAP[group.cefr];
  const rangeSlug = group.gse_range.replace(/[–\s]/g, '-');
  return {
    id: `${DOMAIN}.unit.${ageSlug}.${skillSlug}.${cefrSlug}.${rangeSlug}`,
    kind: 'instructional_unit',
    title: `${group.age_group} ${group.skill} — ${group.cefr} (${group.gse_range})`,
    domain: DOMAIN,
    sourceRefs: [group.age_group === 'Adult Learners' ? SOURCE_REF_ADULT : SOURCE_REF_YOUNG],
    reviewStatus: REVIEW_STATUS,
    metadata: {
      ageGroup: group.age_group,
      skill: group.skill,
      cefr: group.cefr,
      gseRange: group.gse_range,
      unitIndex: index,
      ageSlug,
      skillSlug,
      cefrSlug,
    },
  };
}

function createSkillNode(objective, group, index, existingIds) {
  const ageSlug = AGE_SLUG_MAP[group.age_group];
  const skillSlug = SKILL_SLUG_MAP[group.skill];
  const cefrSlug = CEFR_SLUG_MAP[group.cefr];
  const baseSlug = toSlug(objective.text);
  const slug = baseSlug || `obj-${index}`;
  const safeSlug = /^[a-z0-9]/.test(slug) ? slug : `o-${slug}`;
  const baseId = `${DOMAIN}.skill.${ageSlug}.${skillSlug}.${objective.gse_score}.${safeSlug}`;
  const id = makeUniqueId(baseId, existingIds);
  existingIds.add(id);
  const difficulty = Math.min(1, Math.max(0, (objective.gse_score - 10) / 80));
  return {
    id,
    kind: 'skill',
    title: objective.text.replace(/\s*\([A-Za-z0-9]+\)\s*$/, '').trim(),
    domain: DOMAIN,
    description: objective.text,
    sourceRefs: [group.age_group === 'Adult Learners' ? SOURCE_REF_ADULT : SOURCE_REF_YOUNG],
    reviewStatus: REVIEW_STATUS,
    metadata: {
      gseScore: objective.gse_score,
      ageGroup: group.age_group,
      skill: group.skill,
      cefr: group.cefr,
      gseRange: group.gse_range,
      category: objective.category,
      ageSlug,
      skillSlug,
      cefrSlug,
    },
    difficulty,
  };
}

function createEdge(id, type, sourceId, targetId, weight, confidence, sourceRefs, rationale, metadata) {
  return {
    id,
    type,
    sourceId,
    targetId,
    weight,
    confidence,
    sourceRefs: sourceRefs || [SOURCE_REF_DERIVED],
    reviewStatus: REVIEW_STATUS,
    rationale,
    metadata: metadata || {},
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const CORE_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;

function validateGraph(graph) {
  const errors = [];
  const nodeIds = new Set();
  const seenEdges = new Set();

  for (const node of graph.nodes) {
    if (!CORE_ID_PATTERN.test(node.id)) errors.push(`Invalid node ID: ${node.id}`);
    if (nodeIds.has(node.id)) errors.push(`Duplicate node ID: ${node.id}`);
    nodeIds.add(node.id);
  }

  for (const edge of graph.edges) {
    if (!CORE_ID_PATTERN.test(edge.id)) errors.push(`Invalid edge ID: ${edge.id}`);
    if (!nodeIds.has(edge.sourceId)) errors.push(`Dangling source ${edge.sourceId} in ${edge.id}`);
    if (!nodeIds.has(edge.targetId)) errors.push(`Dangling target ${edge.targetId} in ${edge.id}`);
    const key = `${edge.sourceId}::${edge.targetId}::${edge.type}`;
    if (seenEdges.has(key)) errors.push(`Duplicate edge: ${key}`);
    seenEdges.add(key);
  }

  return errors;
}

function detectPrerequisiteCycles(graph) {
  const adj = new Map(graph.nodes.map(n => [n.id, []]));
  for (const edge of graph.edges) {
    if (edge.type === 'prerequisite_for') {
      adj.get(edge.sourceId).push(edge.targetId);
    }
  }
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recStack.add(node);
    for (const target of adj.get(node) || []) {
      if (recStack.has(target)) {
        const start = path.indexOf(target);
        cycles.push([...path.slice(start), target]);
      } else if (!visited.has(target)) {
        dfs(target, [...path, target]);
      }
    }
    recStack.delete(node);
  }

  for (const nodeId of adj.keys()) {
    if (!visited.has(nodeId)) dfs(nodeId, [nodeId]);
  }
  return cycles;
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

function main() {
  const inputPath = path.join(__dirname, '..', 'gse-md', 'gse-all.json');
  const outputPath = path.join(__dirname, '..', 'gse-knowledge-space.json');
  const gseData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  const nodes = [];
  const edges = [];
  const existingIds = new Set();
  let edgeCounter = 0;

  function nextEdgeId(type) {
    edgeCounter++;
    return `${DOMAIN}.edge.${type}.${edgeCounter}`;
  }

  // --- Domain ---
  const domainNode = createDomainNode();
  nodes.push(domainNode);
  existingIds.add(domainNode.id);

  // --- Content groups ---
  const ageGroups = ['Adult Learners', 'Young Learners'];
  const skills = ['Reading', 'Listening', 'Speaking', 'Writing'];
  const contentGroups = [];
  for (const age of ageGroups) {
    for (const skill of skills) {
      const cg = createContentGroupNode(age, skill);
      nodes.push(cg);
      existingIds.add(cg.id);
      contentGroups.push(cg);
      edges.push(createEdge(
        nextEdgeId('contains'),
        'contains',
        domainNode.id, cg.id,
        1.0, 'high',
        [SOURCE_REF_DERIVED],
        'Domain contains content group',
        { ageGroup: age, skill }
      ));
    }
  }

  // --- Standards ---
  const allCefrs = [...new Set(gseData.map(g => g.cefr))];
  const standards = [];
  for (const cefr of allCefrs) {
    const std = createStandardNode(cefr);
    nodes.push(std);
    existingIds.add(std.id);
    standards.push(std);
  }
  const standardByCefr = new Map(standards.map(s => [s.metadata.level, s]));
  const contentGroupByKey = new Map(contentGroups.map(cg => [`${cg.metadata.ageGroup}|${cg.metadata.skill}`, cg]));

  // --- Instructional units and skills ---
  const allSkills = [];
  const skillsByTrack = new Map(); // key: "age|skill" -> skill nodes
  const skillsByScore = new Map(); // key: "age|skill|score" -> skill nodes

  gseData.forEach((group, groupIndex) => {
    const unit = createInstructionalUnitNode(group, groupIndex);
    nodes.push(unit);
    existingIds.add(unit.id);

    const cg = contentGroupByKey.get(`${group.age_group}|${group.skill}`);
    if (cg) {
      edges.push(createEdge(
        nextEdgeId('contains'),
        'contains',
        cg.id, unit.id,
        1.0, 'high',
        [SOURCE_REF_DERIVED],
        'Content group contains instructional unit',
        { cefr: group.cefr, gseRange: group.gse_range }
      ));
    }

    group.objectives.forEach((obj, objIndex) => {
      const skillNode = createSkillNode(obj, group, objIndex, existingIds);
      nodes.push(skillNode);
      allSkills.push(skillNode);

      // Track organization
      const trackKey = `${skillNode.metadata.ageGroup}|${skillNode.metadata.skill}`;
      if (!skillsByTrack.has(trackKey)) skillsByTrack.set(trackKey, []);
      skillsByTrack.get(trackKey).push(skillNode);

      const scoreKey = `${skillNode.metadata.ageGroup}|${skillNode.metadata.skill}|${skillNode.metadata.gseScore}`;
      if (!skillsByScore.has(scoreKey)) skillsByScore.set(scoreKey, []);
      skillsByScore.get(scoreKey).push(skillNode);

      // Structural edges
      edges.push(createEdge(
        nextEdgeId('contains'),
        'contains',
        unit.id, skillNode.id,
        1.0, 'high',
        [SOURCE_REF_DERIVED],
        'Instructional unit contains skill',
        { gseScore: obj.gse_score }
      ));
      edges.push(createEdge(
        nextEdgeId('appears'),
        'appears_in_context',
        skillNode.id, unit.id,
        0.9, 'high',
        [SOURCE_REF_DERIVED],
        'Skill appears in instructional unit context',
        { gseScore: obj.gse_score }
      ));

      const std = standardByCefr.get(group.cefr);
      if (std) {
        edges.push(createEdge(
          nextEdgeId('align'),
          'aligned_to_standard',
          skillNode.id, std.id,
          1.0, 'high',
          [group.age_group === 'Adult Learners' ? SOURCE_REF_ADULT : SOURCE_REF_YOUNG],
          `Skill aligned to CEFR ${group.cefr}`,
          { cefr: group.cefr }
        ));
      }
    });
  });

  // --- Supports edges: complete directed mesh within same (age, skill, score) ---
  for (const [, scoreGroup] of skillsByScore) {
    if (scoreGroup.length < 2) continue;
    for (let i = 0; i < scoreGroup.length; i++) {
      for (let j = 0; j < scoreGroup.length; j++) {
        if (i === j) continue;
        const source = scoreGroup[i];
        const target = scoreGroup[j];
        edges.push(createEdge(
          nextEdgeId('supports'),
          'supports',
          source.id, target.id,
          SUPPORTS_WEIGHT, 'high',
          [SOURCE_REF_DERIVED],
          'Co-competency at same GSE score within same content group',
          { gseScore: source.metadata.gseScore }
        ));
      }
    }
  }

  // --- Prerequisite edges: probabilistic X-4 to X-1, same track ---
  for (const [, trackSkills] of skillsByTrack) {
    // Sort by score ascending, then title for determinism
    trackSkills.sort((a, b) => {
      if (a.metadata.gseScore !== b.metadata.gseScore) {
        return a.metadata.gseScore - b.metadata.gseScore;
      }
      return a.title.localeCompare(b.title);
    });

    // Build candidate index: for each skill, find predecessors in [score-4, score-1]
    for (let idx = 0; idx < trackSkills.length; idx++) {
      const target = trackSkills[idx];
      const targetScore = target.metadata.gseScore;
      const rng = makeRng(target.id);

      // Gather candidates from the same track with lower scores
      const candidates = [];
      const candidateDistances = [];
      for (let j = idx - 1; j >= 0; j--) {
        const source = trackSkills[j];
        const dist = targetScore - source.metadata.gseScore;
        if (dist > PREREQ_DISTANCE_MAX) break;
        if (dist >= 1) {
          candidates.push(source);
          candidateDistances.push(dist);
        }
      }

      if (candidates.length === 0) continue;

      // Group by distance to ensure at least one from the closest level
      const byDistance = new Map();
      for (let i = 0; i < candidates.length; i++) {
        const d = candidateDistances[i];
        if (!byDistance.has(d)) byDistance.set(d, []);
        byDistance.get(d).push(candidates[i]);
      }
      const sortedDistances = [...byDistance.keys()].sort((a, b) => a - b);
      const selected = new Set();

      // Mandatory: at least one from the closest available distance
      const closestDistance = sortedDistances[0];
      const closestPool = byDistance.get(closestDistance);
      const mandatoryPick = closestPool[Math.floor(rng() * closestPool.length)];
      selected.add(mandatoryPick.id);

      // Weighted sampling for the remainder
      const weights = candidates.map((c, i) => {
        const d = candidateDistances[i];
        // Inverse distance weighting: closer = higher probability
        return 1 / (d * d);
      });

      const remainingBudget = Math.min(PREREQ_MAX, candidates.length) - 1;
      if (remainingBudget > 0) {
        const available = candidates.filter(c => !selected.has(c.id));
        const availableWeights = candidates
          .map((c, i) => ({ c, w: weights[i] }))
          .filter(({ c }) => !selected.has(c.id))
          .map(({ w }) => w);

        if (available.length > 0) {
          const extra = weightedSample(available, availableWeights, remainingBudget, rng);
          for (const ex of extra) selected.add(ex.id);
        }
      }

      // Ensure minimum budget is met if possible (but not below 1, which we already have)
      // If we have fewer than PREREQ_MIN and more candidates exist, add more uniformly
      if (selected.size < PREREQ_MIN && candidates.length > selected.size) {
        const extraNeeded = Math.min(PREREQ_MIN, candidates.length) - selected.size;
        const remaining = candidates.filter(c => !selected.has(c.id));
        // Shuffle remaining deterministically
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        for (let i = 0; i < extraNeeded && i < remaining.length; i++) {
          selected.add(remaining[i].id);
        }
      }

      // Create edges
      for (const source of candidates) {
        if (!selected.has(source.id)) continue;
        const dist = targetScore - source.metadata.gseScore;
        const weight = Math.min(1, PREREQ_WEIGHT_BASE * Math.pow(PREREQ_WEIGHT_DECAY, dist - 1));
        const confidence = dist <= 2 ? 'high' : dist === 3 ? 'medium' : 'low';
        edges.push(createEdge(
          nextEdgeId('prereq'),
          'prerequisite_for',
          source.id, target.id,
          weight, confidence,
          [SOURCE_REF_DERIVED],
          `GSE progression: ${source.metadata.gseScore} → ${targetScore} (distance ${dist})`,
          { sourceScore: source.metadata.gseScore, targetScore, distance: dist }
        ));
      }
    }
  }

  // --- Build, validate, write ---
  const graph = { nodes, edges };
  const errors = validateGraph(graph);
  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const err of errors) console.error('  -', err);
    process.exit(1);
  }

  const cycles = detectPrerequisiteCycles(graph);
  if (cycles.length > 0) {
    console.error('Prerequisite cycles detected:', cycles.length);
    for (const c of cycles.slice(0, 5)) console.error('  ', c.join(' -> '));
    process.exit(1);
  }

  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

  // --- Summary ---
  console.log('Knowledge space generated successfully!');
  console.log(`  Nodes: ${nodes.length}`);
  console.log(`    - domain:             ${nodes.filter(n => n.kind === 'domain').length}`);
  console.log(`    - content_group:      ${nodes.filter(n => n.kind === 'content_group').length}`);
  console.log(`    - standard:           ${nodes.filter(n => n.kind === 'standard').length}`);
  console.log(`    - instructional_unit: ${nodes.filter(n => n.kind === 'instructional_unit').length}`);
  console.log(`    - skill:              ${nodes.filter(n => n.kind === 'skill').length}`);
  console.log(`  Edges: ${edges.length}`);
  console.log(`    - contains:            ${edges.filter(e => e.type === 'contains').length}`);
  console.log(`    - appears_in_context:  ${edges.filter(e => e.type === 'appears_in_context').length}`);
  console.log(`    - aligned_to_standard: ${edges.filter(e => e.type === 'aligned_to_standard').length}`);
  console.log(`    - supports:            ${edges.filter(e => e.type === 'supports').length}`);
  console.log(`    - prerequisite_for:    ${edges.filter(e => e.type === 'prerequisite_for').length}`);

  // Prerequisite stats
  const prereqs = edges.filter(e => e.type === 'prerequisite_for');
  const prereqsPerTarget = new Map();
  for (const e of prereqs) {
    prereqsPerTarget.set(e.targetId, (prereqsPerTarget.get(e.targetId) || 0) + 1);
  }
  const counts = [...prereqsPerTarget.values()];
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  console.log(`  Prerequisite stats:`);
  console.log(`    - skills with prerequisites: ${counts.length} / ${allSkills.length}`);
  console.log(`    - avg per skill: ${avg.toFixed(2)}`);
  console.log(`    - min: ${min}, max: ${max}`);

  // Distance distribution
  const distDist = {};
  for (const e of prereqs) {
    const d = e.metadata.distance;
    distDist[d] = (distDist[d] || 0) + 1;
  }
  console.log(`    - distance distribution:`, distDist);

  // Supports stats
  const supports = edges.filter(e => e.type === 'supports');
  const supportsPerNode = new Map();
  for (const e of supports) {
    supportsPerNode.set(e.sourceId, (supportsPerNode.get(e.sourceId) || 0) + 1);
  }
  const supCounts = [...supportsPerNode.values()];
  const supAvg = supCounts.length > 0 ? supCounts.reduce((a, b) => a + b, 0) / supCounts.length : 0;
  console.log(`  Supports stats:`);
  console.log(`    - skills with outgoing supports: ${supCounts.length}`);
  console.log(`    - avg outgoing supports per skill: ${supAvg.toFixed(2)}`);

  console.log(`  Output: ${outputPath}`);
}

main();
