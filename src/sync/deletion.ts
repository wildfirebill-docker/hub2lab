export function buildDeletionContent(
  refType: 'branch' | 'tag',
  refName: string,
  sourceSide: 'github' | 'gitlab',
  sourceOrgOrGroup: string,
  targetOrgOrGroup: string,
  repo: string
): string {
  const now = new Date().toISOString();
  return [
    `# Deletion Record`,
    ``,
    `**Deleted:** ${refType} \`${refName}\``,
    `**Source:** ${sourceSide} (${sourceOrgOrGroup}/${repo})`,
    `**Target:** ${sourceSide === 'github' ? 'GitLab' : 'GitHub'} (${targetOrgOrGroup}/${repo})`,
    `**Time:** ${now}`,
    ``,
    `This ref was deleted on the source side. The target side is NOT deleted —`,
    `this marker file is written instead.`,
    ``,
    `To complete the deletion on the target side, remove this file and delete`,
    `the ref manually.`,
    ``,
  ].join('\n');
}

export function buildRepoDeletionContent(
  repoName: string,
  sourceSide: 'github' | 'gitlab',
  sourceOrgOrGroup: string,
  targetOrgOrGroup: string
): string {
  const now = new Date().toISOString();
  return [
    `# Repository Deletion Record`,
    ``,
    `**Deleted repository:** ${repoName}`,
    `**Source:** ${sourceSide} (${sourceOrgOrGroup})`,
    `**Target:** ${sourceSide === 'github' ? 'GitLab' : 'GitHub'} (${targetOrgOrGroup})`,
    `**Time:** ${now}`,
    ``,
    `This repository was deleted on the source side. The target side is NOT deleted —`,
    `this marker file is written instead.`,
    ``,
    `To complete the deletion, remove this file or the repository manually.`,
    ``,
  ].join('\n');
}
